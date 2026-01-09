import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { ChaimDynamoDBBinder } from '../../src/binders/chaim-dynamodb-binder';
import { ChaimDynamoDBBinderProps } from '../../src/binders/chaim-dynamodb-binder';
import { ChaimCredentials, IChaimCredentials } from '../../src/types/credentials';

/**
 * Options for creating a test stack
 */
export interface TestStackOptions {
  /** Stack name/id */
  id?: string;
  /** Stack props */
  props?: cdk.StackProps;
}

/**
 * Options for creating a test DynamoDB table
 */
export interface TestTableOptions {
  /** Table name/id */
  id?: string;
  /** Partition key name */
  partitionKeyName?: string;
  /** Partition key type */
  partitionKeyType?: dynamodb.AttributeType;
  /** Sort key name (optional) */
  sortKeyName?: string;
  /** Sort key type (optional) */
  sortKeyType?: dynamodb.AttributeType;
  /** Table name */
  tableName?: string;
  /** Billing mode */
  billingMode?: dynamodb.BillingMode;
}

/**
 * Options for creating a ChaimDynamoDBBinder
 */
export interface ChaimBinderOptions {
  /** Construct id */
  id?: string;
  /** Schema file path */
  schemaPath: string;
  /** DynamoDB table */
  table: dynamodb.ITable;
  /** Application ID */
  appId: string;
  /** Credentials (use ChaimCredentials factory) */
  credentials: IChaimCredentials;
  /** Failure mode */
  failureMode?: 'BEST_EFFORT' | 'STRICT';
}

/**
 * Creates a CDK App and Stack for testing
 *
 * @param options - Stack creation options
 * @returns Object containing app and stack
 */
export function createTestStack(options: TestStackOptions = {}): {
  app: cdk.App;
  stack: cdk.Stack;
} {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, options.id || 'TestStack', options.props);
  return { app, stack };
}

/**
 * Creates a DynamoDB table for testing
 *
 * @param scope - The construct scope (usually a Stack)
 * @param options - Table creation options
 * @returns The created DynamoDB table
 */
export function createTestTable(
  scope: Construct,
  options: TestTableOptions = {}
): dynamodb.Table {
  const tableId = options.id || 'TestTable';
  const partitionKeyName = options.partitionKeyName || 'id';
  const partitionKeyType = options.partitionKeyType || dynamodb.AttributeType.STRING;

  const tableProps: dynamodb.TableProps = {
    tableName: options.tableName || `${tableId.toLowerCase()}-table`,
    partitionKey: {
      name: partitionKeyName,
      type: partitionKeyType,
    },
    billingMode: options.billingMode || dynamodb.BillingMode.PAY_PER_REQUEST,
  };

  // Add sort key if provided
  if (options.sortKeyName && options.sortKeyType) {
    tableProps.sortKey = {
      name: options.sortKeyName,
      type: options.sortKeyType,
    };
  }

  return new dynamodb.Table(scope, tableId, tableProps);
}

/**
 * Creates a ChaimDynamoDBBinder construct with direct API credentials
 *
 * @param scope - The construct scope (usually a Stack)
 * @param options - ChaimBinder creation options (without credentials)
 * @param apiKey - API key
 * @param apiSecret - API secret
 * @returns The created ChaimDynamoDBBinder construct
 */
export function createChaimBinderWithApiKeys(
  scope: Construct,
  options: Omit<ChaimBinderOptions, 'credentials'>,
  apiKey: string,
  apiSecret: string
): ChaimDynamoDBBinder {
  const props: ChaimDynamoDBBinderProps = {
    schemaPath: options.schemaPath,
    table: options.table,
    appId: options.appId,
    credentials: ChaimCredentials.fromApiKeys(apiKey, apiSecret),
    failureMode: options.failureMode,
  };

  return new ChaimDynamoDBBinder(scope, options.id || 'TestChaimBinder', props);
}

/**
 * Creates a ChaimDynamoDBBinder construct with Secrets Manager credentials
 *
 * @param scope - The construct scope (usually a Stack)
 * @param options - ChaimBinder creation options (without credentials)
 * @param secretName - Secrets Manager secret name
 * @returns The created ChaimDynamoDBBinder construct
 */
export function createChaimBinderWithSecretsManager(
  scope: Construct,
  options: Omit<ChaimBinderOptions, 'credentials'>,
  secretName: string
): ChaimDynamoDBBinder {
  const props: ChaimDynamoDBBinderProps = {
    schemaPath: options.schemaPath,
    table: options.table,
    appId: options.appId,
    credentials: ChaimCredentials.fromSecretsManager(secretName),
    failureMode: options.failureMode,
  };

  return new ChaimDynamoDBBinder(scope, options.id || 'TestChaimBinder', props);
}

/**
 * Creates test credentials using direct API keys
 */
export function createTestCredentials(
  apiKey: string = 'test-api-key',
  apiSecret: string = 'test-api-secret'
): IChaimCredentials {
  return ChaimCredentials.fromApiKeys(apiKey, apiSecret);
}

/**
 * Creates test credentials using Secrets Manager
 */
export function createTestSecretsManagerCredentials(
  secretName: string = 'chaim/test-credentials'
): IChaimCredentials {
  return ChaimCredentials.fromSecretsManager(secretName);
}
