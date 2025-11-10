import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { ChaimBinder } from '../../src/chaim-binder';
import { ChaimBinderProps } from '../../src/types/chaim-binder-props';

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
 * Options for creating a ChaimBinder in OSS mode
 */
export interface ChaimBinderOSSOptions {
  /** Construct id */
  id?: string;
  /** Schema file path */
  schemaPath: string;
  /** DynamoDB table */
  table: dynamodb.ITable;
}

/**
 * Options for creating a ChaimBinder in SaaS mode
 */
export interface ChaimBinderSaaSOptions extends ChaimBinderOSSOptions {
  /** API key */
  apiKey: string;
  /** API secret */
  apiSecret: string;
  /** Application ID */
  appId: string;
  /** Use Secrets Manager (optional) */
  useSecretsManager?: boolean;
  /** Secret name (optional) */
  secretName?: string;
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
 * Creates a ChaimBinder construct in OSS mode
 * 
 * @param scope - The construct scope (usually a Stack)
 * @param options - ChaimBinder creation options
 * @returns The created ChaimBinder construct
 */
export function createChaimBinderOSS(
  scope: Construct,
  options: ChaimBinderOSSOptions
): ChaimBinder {
  const props: ChaimBinderProps = {
    schemaPath: options.schemaPath,
    table: options.table,
  };
  
  return new ChaimBinder(scope, options.id || 'TestChaimBinderOSS', props);
}

/**
 * Creates a ChaimBinder construct in SaaS mode
 * 
 * @param scope - The construct scope (usually a Stack)
 * @param options - ChaimBinder creation options
 * @returns The created ChaimBinder construct
 */
export function createChaimBinderSaaS(
  scope: Construct,
  options: ChaimBinderSaaSOptions
): ChaimBinder {
  const props: ChaimBinderProps = {
    schemaPath: options.schemaPath,
    table: options.table,
    apiKey: options.apiKey,
    apiSecret: options.apiSecret,
    appId: options.appId,
    useSecretsManager: options.useSecretsManager,
    secretName: options.secretName,
  };
  
  return new ChaimBinder(scope, options.id || 'TestChaimBinderSaaS', props);
}

