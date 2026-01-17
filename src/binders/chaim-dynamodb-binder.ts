import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { BaseChaimBinder } from './base-chaim-binder';
import { BaseBinderProps } from '../types/base-binder-props';
import {
  DynamoDBMetadata,
  GSIMetadata,
  LSIMetadata,
} from '../types/data-store-metadata';

/**
 * Properties for ChaimDynamoDBBinder construct.
 */
export interface ChaimDynamoDBBinderProps extends BaseBinderProps {
  /** DynamoDB table to bind with the schema */
  table: dynamodb.ITable;
}

/**
 * CDK construct for binding a .bprint schema to a DynamoDB table.
 *
 * Publishes schema and table metadata to Chaim SaaS platform via
 * S3 presigned upload and snapshot-ref commit.
 *
 * @example
 * ```typescript
 * import { ChaimDynamoDBBinder, ChaimCredentials, FailureMode } from '@chaim-tools/cdk-lib';
 *
 * const table = new dynamodb.Table(this, 'UsersTable', {
 *   partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
 * });
 *
 * // failureMode defaults to BEST_EFFORT
 * new ChaimDynamoDBBinder(this, 'UserSchema', {
 *   schemaPath: './schemas/user.bprint',
 *   table,
 *   appId: 'my-app',
 *   credentials: ChaimCredentials.fromSecretsManager('chaim/api-credentials'),
 *   failureMode: FailureMode.STRICT,  // Optional - rolls back on failure
 * });
 * ```
 */
export class ChaimDynamoDBBinder extends BaseChaimBinder {
  /** The DynamoDB table being bound */
  public readonly table: dynamodb.ITable;

  /** DynamoDB-specific metadata */
  public readonly dynamoDBMetadata: DynamoDBMetadata;

  private readonly dynamoDBProps: ChaimDynamoDBBinderProps;

  constructor(scope: Construct, id: string, props: ChaimDynamoDBBinderProps) {
    // Store props before calling super (which calls extractMetadata)
    super(scope, id, props);

    this.dynamoDBProps = props;
    this.table = props.table;
    this.dynamoDBMetadata = this.dataStoreMetadata as DynamoDBMetadata;
  }

  /**
   * Override to resolve the actual table name when possible.
   * 
   * Uses stack.resolve() to convert CDK tokens to actual values for explicit table names
   * (e.g., 'acme-product-catalog') and dynamic names (e.g., `${stack.stackName}-orders`).
   * Falls back to construct node ID for auto-generated names or cross-stack references.
   * 
   * Note: This is called from BaseChaimBinder constructor before this.table is set,
   * so we access the table from baseProps instead.
   */
  protected getResourceName(): string {
    const props = this.baseProps as ChaimDynamoDBBinderProps;
    const cfnTable = props.table.node.defaultChild as dynamodb.CfnTable;
    const stack = cdk.Stack.of(this);
    
    // Try to resolve the table name token
    // This works for explicit names like 'acme-product-catalog'
    // and dynamic names like `${stack.stackName}-orders`
    const resolvedName = stack.resolve(cfnTable.tableName);
    
    // Check if it's still an unresolved token
    if (!resolvedName || cdk.Token.isUnresolved(resolvedName)) {
      // Fallback to construct ID for auto-generated names
      return props.table.node.id;
    }
    
    // Return the actual resolved table name
    return resolvedName;
  }

  /**
   * Extract DynamoDB table metadata.
   */
  protected extractMetadata(): DynamoDBMetadata {
    const props = this.baseProps as ChaimDynamoDBBinderProps;
    const table = props.table;
    const stack = cdk.Stack.of(this);

    // Validate table
    this.validateTable(table);

    // Get CloudFormation resource for detailed metadata
    const cfnTable = this.getCfnTable(table);

    // Extract key schema
    const { partitionKey, sortKey } = this.extractKeySchema(cfnTable);

    // Extract indexes
    const globalSecondaryIndexes = this.extractGSIs(cfnTable);
    const localSecondaryIndexes = this.extractLSIs(cfnTable);

    // Extract TTL
    const ttlAttribute = this.extractTTL(cfnTable);

    // Extract stream info
    const { streamEnabled, streamViewType } = this.extractStreamInfo(cfnTable);

    // Extract billing mode
    const billingMode = this.extractBillingMode(cfnTable);

    // Resolve table name from token (same logic as getResourceName)
    const resolvedTableName = stack.resolve(cfnTable.tableName);
    const tableName = (!resolvedTableName || cdk.Token.isUnresolved(resolvedTableName)) 
      ? table.tableName  // Keep token if can't resolve
      : resolvedTableName;

    return {
      type: 'dynamodb',
      // Removed duplicate fields in v1.1:
      // - arn (use tableArn instead)
      // - name (use tableName instead)
      // - account (use top-level accountId instead)
      tableName,
      tableArn: table.tableArn,
      region: stack.region,
      partitionKey,
      sortKey,
      globalSecondaryIndexes,
      localSecondaryIndexes,
      ttlAttribute,
      streamEnabled,
      streamViewType,
      billingMode,
      encryptionKeyArn: table.encryptionKey?.keyArn,
    };
  }

  /**
   * Validate that the table is a concrete DynamoDB Table construct.
   */
  private validateTable(table: dynamodb.ITable): void {
    if (!table) {
      throw new Error('DynamoDB table is required');
    }

    if (!(table instanceof dynamodb.Table)) {
      throw new Error(
        'Table must be a concrete DynamoDB Table construct. Imported tables are not supported.'
      );
    }

    if (!table.tableName) {
      throw new Error('Table must have a valid table name');
    }

    if (!table.tableArn) {
      throw new Error('Table must have a valid table ARN');
    }
  }

  /**
   * Get the underlying CloudFormation table resource.
   */
  private getCfnTable(table: dynamodb.ITable): dynamodb.CfnTable {
    if (!(table instanceof dynamodb.Table)) {
      throw new Error('Cannot access CloudFormation resource for imported table');
    }

    const cfnTable = table.node.defaultChild as dynamodb.CfnTable;
    if (!cfnTable) {
      throw new Error('Cannot access CloudFormation resource for table');
    }

    return cfnTable;
  }

  /**
   * Extract partition key and sort key from key schema.
   */
  private extractKeySchema(cfnTable: dynamodb.CfnTable): {
    partitionKey: string;
    sortKey?: string;
  } {
    const keySchema = cfnTable.keySchema;

    if (!keySchema || !Array.isArray(keySchema) || keySchema.length === 0) {
      throw new Error('Table must have a key schema');
    }

    let partitionKey: string | undefined;
    let sortKey: string | undefined;

    for (const key of keySchema) {
      if (typeof key === 'object' && 'attributeName' in key && 'keyType' in key) {
        if (key.keyType === 'HASH') {
          partitionKey = key.attributeName;
        } else if (key.keyType === 'RANGE') {
          sortKey = key.attributeName;
        }
      }
    }

    if (!partitionKey) {
      throw new Error('Cannot extract partition key from table key schema');
    }

    return { partitionKey, sortKey };
  }

  /**
   * Extract Global Secondary Index metadata.
   */
  private extractGSIs(cfnTable: dynamodb.CfnTable): GSIMetadata[] | undefined {
    const gsis = cfnTable.globalSecondaryIndexes;
    if (!gsis || !Array.isArray(gsis) || gsis.length === 0) {
      return undefined;
    }

    return gsis.map((gsi: any) => {
      const keySchema = gsi.keySchema || [];
      let partitionKey = '';
      let sortKey: string | undefined;

      for (const key of keySchema) {
        if (key.keyType === 'HASH') {
          partitionKey = key.attributeName;
        } else if (key.keyType === 'RANGE') {
          sortKey = key.attributeName;
        }
      }

      return {
        indexName: gsi.indexName,
        partitionKey,
        sortKey,
        projectionType: gsi.projection?.projectionType || 'ALL',
        nonKeyAttributes: gsi.projection?.nonKeyAttributes,
      };
    });
  }

  /**
   * Extract Local Secondary Index metadata.
   */
  private extractLSIs(cfnTable: dynamodb.CfnTable): LSIMetadata[] | undefined {
    const lsis = cfnTable.localSecondaryIndexes;
    if (!lsis || !Array.isArray(lsis) || lsis.length === 0) {
      return undefined;
    }

    return lsis.map((lsi: any) => {
      const keySchema = lsi.keySchema || [];
      let sortKey = '';

      for (const key of keySchema) {
        if (key.keyType === 'RANGE') {
          sortKey = key.attributeName;
        }
      }

      return {
        indexName: lsi.indexName,
        sortKey,
        projectionType: lsi.projection?.projectionType || 'ALL',
        nonKeyAttributes: lsi.projection?.nonKeyAttributes,
      };
    });
  }

  /**
   * Extract TTL attribute name.
   */
  private extractTTL(cfnTable: dynamodb.CfnTable): string | undefined {
    const ttlSpec = cfnTable.timeToLiveSpecification;
    if (ttlSpec && typeof ttlSpec === 'object' && 'enabled' in ttlSpec) {
      if (ttlSpec.enabled && 'attributeName' in ttlSpec) {
        return ttlSpec.attributeName as string;
      }
    }
    return undefined;
  }

  /**
   * Extract stream configuration.
   */
  private extractStreamInfo(cfnTable: dynamodb.CfnTable): {
    streamEnabled?: boolean;
    streamViewType?: string;
  } {
    const streamSpec = cfnTable.streamSpecification;
    if (streamSpec && typeof streamSpec === 'object' && 'streamViewType' in streamSpec) {
      return {
        streamEnabled: true,
        streamViewType: streamSpec.streamViewType as string,
      };
    }
    return { streamEnabled: false };
  }

  /**
   * Extract billing mode.
   */
  private extractBillingMode(cfnTable: dynamodb.CfnTable): 'PAY_PER_REQUEST' | 'PROVISIONED' | undefined {
    const billingMode = cfnTable.billingMode;
    if (billingMode === 'PAY_PER_REQUEST' || billingMode === 'PROVISIONED') {
      return billingMode;
    }
    return undefined;
  }
}

