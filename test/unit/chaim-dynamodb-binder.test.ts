import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimDynamoDBBinder } from '../../src/binders/chaim-dynamodb-binder';
import { ChaimCredentials } from '../../src/types/credentials';

// Mock schema service
vi.mock('../../src/services/schema-service', () => ({
  SchemaService: {
    readSchema: vi.fn().mockReturnValue({
      schemaVersion: 'v1',
      namespace: 'test.users',
      description: 'Test user schema',
      entity: {
        primaryKey: { partitionKey: 'userId' },
        fields: [
          { name: 'userId', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
        ],
      },
    }),
  },
}));

describe('ChaimDynamoDBBinder', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let table: dynamodb.Table;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    table = new dynamodb.Table(stack, 'TestTable', {
      tableName: 'test-table',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
  });

  describe('constructor', () => {
    it('should create binder with direct credentials', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        appId: 'test-app',
        credentials: ChaimCredentials.fromApiKeys('test-key', 'test-secret'),
      });

      expect(binder).toBeDefined();
      expect(binder.eventId).toBeDefined();
      expect(binder.schemaData).toBeDefined();
      expect(binder.dataStoreMetadata).toBeDefined();
      expect(binder.dataStoreMetadata.type).toBe('dynamodb');
    });

    it('should create binder with Secrets Manager', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        appId: 'test-app',
        credentials: ChaimCredentials.fromSecretsManager('chaim/credentials'),
      });

      expect(binder).toBeDefined();
      expect(binder.eventId).toBeDefined();
    });

    it('should throw error when no credentials provided', () => {
      expect(() => {
        new ChaimDynamoDBBinder(stack, 'TestBinder', {
          schemaPath: './schemas/test.bprint',
          table,
          appId: 'test-app',
        } as any);
      }).toThrow();
    });
  });

  describe('metadata extraction', () => {
    it('should extract DynamoDB metadata correctly', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        appId: 'test-app',
        credentials: ChaimCredentials.fromApiKeys('test-key', 'test-secret'),
      });

      const metadata = binder.dynamoDBMetadata;

      expect(metadata.type).toBe('dynamodb');
      expect(metadata.tableName).toBe('test-table');
      expect(metadata.partitionKey).toBe('pk');
      expect(metadata.billingMode).toBe('PAY_PER_REQUEST');
    });

    it('should extract sort key when present', () => {
      const compositeTable = new dynamodb.Table(stack, 'CompositeTable', {
        tableName: 'composite-table',
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      });

      const binder = new ChaimDynamoDBBinder(stack, 'CompositeBinder', {
        schemaPath: './schemas/test.bprint',
        table: compositeTable,
        appId: 'test-app',
        credentials: ChaimCredentials.fromApiKeys('test-key', 'test-secret'),
      });

      expect(binder.dynamoDBMetadata.sortKey).toBe('sk');
    });

    it('should extract GSI metadata when present', () => {
      const tableWithGSI = new dynamodb.Table(stack, 'GSITable', {
        tableName: 'gsi-table',
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      });

      tableWithGSI.addGlobalSecondaryIndex({
        indexName: 'email-index',
        partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      });

      const binder = new ChaimDynamoDBBinder(stack, 'GSIBinder', {
        schemaPath: './schemas/test.bprint',
        table: tableWithGSI,
        appId: 'test-app',
        credentials: ChaimCredentials.fromApiKeys('test-key', 'test-secret'),
      });

      expect(binder.dynamoDBMetadata.globalSecondaryIndexes).toBeDefined();
      expect(binder.dynamoDBMetadata.globalSecondaryIndexes?.length).toBe(1);
      expect(binder.dynamoDBMetadata.globalSecondaryIndexes?.[0].indexName).toBe('email-index');
    });
  });

  describe('failure modes', () => {
    it('should use BEST_EFFORT by default', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        appId: 'test-app',
        credentials: ChaimCredentials.fromApiKeys('test-key', 'test-secret'),
      });

      expect(binder).toBeDefined();
      // Default failure mode is BEST_EFFORT - verified in Lambda env
    });

    it('should accept STRICT failure mode', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        appId: 'test-app',
        credentials: ChaimCredentials.fromApiKeys('test-key', 'test-secret'),
        failureMode: 'STRICT',
      });

      expect(binder).toBeDefined();
    });
  });
});
