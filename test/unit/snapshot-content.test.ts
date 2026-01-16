/**
 * Snapshot Content Tests
 * 
 * Tests that verify the ChaimDynamoDBBinder construct generates
 * correct metadata and properties for ingestion.
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as fs from 'fs';
import * as path from 'path';
import { ChaimDynamoDBBinder } from '../../src/binders/chaim-dynamodb-binder';
import { ChaimCredentials } from '../../src/types/credentials';
import { TableBindingConfig } from '../../src/types/table-binding-config';

// Mock schema data for testing
const mockSchemaData = {
  schemaVersion: '1.0.0',
  entityName: 'User',
  description: 'Test user schema',
  primaryKey: { partitionKey: 'userId' },
  fields: [
    { name: 'userId', type: 'string', required: true },
    { name: 'email', type: 'string', required: true },
    { name: 'createdAt', type: 'number' },
  ],
};

// Mock the SchemaService
vi.mock('../../src/services/schema-service', () => ({
  SchemaService: {
    readSchema: vi.fn(() => mockSchemaData),
  },
}));

describe('Snapshot Content Tests', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let table: dynamodb.Table;
  let testConfig: TableBindingConfig;
  const testAssetDirs: string[] = [];

  // Helper to ensure asset directory exists
  function ensureAssetDir(stackName: string, resourceId: string): string {
    const cdkRoot = process.cwd();
    const assetDir = path.join(cdkRoot, 'cdk.out', 'chaim', 'assets', stackName, resourceId);
    fs.mkdirSync(assetDir, { recursive: true });
    
    // Create minimal files for CDK validation
    fs.writeFileSync(path.join(assetDir, 'index.js'), 'exports.handler = async () => {};', 'utf-8');
    fs.writeFileSync(path.join(assetDir, 'snapshot.json'), '{}', 'utf-8');
    
    testAssetDirs.push(assetDir);
    return assetDir;
  }

  // Helper to get snapshot from the binder's local snapshot path
  function getSnapshotFromBinder(binder: ChaimDynamoDBBinder): any {
    if (fs.existsSync(binder.localSnapshotPath)) {
      return JSON.parse(fs.readFileSync(binder.localSnapshotPath, 'utf-8'));
    }
    return null;
  }

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    table = new dynamodb.Table(stack, 'TestTable', {
      tableName: 'test-table',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    testConfig = new TableBindingConfig(
      'test-app',
      ChaimCredentials.fromApiKeys('test-key', 'test-secret')
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Clean up test asset directories
    for (const dir of testAssetDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Binder properties', () => {
    it('should generate resourceId containing entity name', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.resourceId).toContain('__User');
    });

    it('should expose schemaData with correct namespace', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.schemaData).toBeDefined();
      expect(binder.schemaData.entityName).toBe(mockSchemaData.entityName);
    });

    it('should expose dynamoDBMetadata with type', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.dynamoDBMetadata).toBeDefined();
      expect(binder.dynamoDBMetadata.type).toBe('dynamodb');
    });

    it('should expose localSnapshotPath', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.localSnapshotPath).toBeDefined();
      expect(binder.localSnapshotPath).toContain('User');
    });

    it('should generate snapshot with action field set to UPSERT', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot).toBeDefined();
      expect(snapshot.action).toBe('UPSERT');
    });
  });

  describe('DynamoDB metadata extraction', () => {
    it('should extract partition key correctly', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.dynamoDBMetadata.partitionKey).toBe('pk');
    });

    it('should extract sort key when present', () => {
      const compositeTable = new dynamodb.Table(stack, 'CompositeTable', {
        tableName: 'composite-table',
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      });

      ensureAssetDir('TestStack', 'composite-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'CompositeBinder', {
        schemaPath: './schemas/test.bprint',
        table: compositeTable,
        config: testConfig,
      });

      expect(binder.dynamoDBMetadata.partitionKey).toBe('pk');
      expect(binder.dynamoDBMetadata.sortKey).toBe('sk');
    });

    it('should extract billing mode correctly', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.dynamoDBMetadata.billingMode).toBe('PAY_PER_REQUEST');
    });

    it('should extract table ARN', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.dynamoDBMetadata.arn).toBeDefined();
      expect(binder.dynamoDBMetadata.tableArn).toBeDefined();
    });

    it('should extract table name', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.dynamoDBMetadata.tableName).toBeDefined();
    });
  });

  describe('Local snapshot file', () => {
    it('should write snapshot with provider field', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot).toBeDefined();
      expect(snapshot.provider).toBe('aws');
    });

    it('should write snapshot with accountId', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.accountId).toBe('123456789012');
    });

    it('should write snapshot with region', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.region).toBe('us-east-1');
    });

    it('should write snapshot with stackName', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.stackName).toBe('TestStack');
    });

    it('should write snapshot with appId', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const customConfig = new TableBindingConfig(
        'my-custom-app',
        ChaimCredentials.fromApiKeys('test-key', 'test-secret')
      );
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: customConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.appId).toBe('my-custom-app');
    });

    it('should write snapshot with datastoreType', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.datastoreType).toBe('dynamodb');
    });

    it('should write snapshot with embedded schema', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.schema).toBeDefined();
      expect(snapshot.schema.entityName).toBe('User');
      expect(snapshot.schema.primaryKey).toBeDefined();
      expect(snapshot.schema.fields).toBeDefined();
    });

    it('should write snapshot with dataStore metadata', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.dataStore).toBeDefined();
      expect(snapshot.dataStore.type).toBe('dynamodb');
      expect(snapshot.dataStore.partitionKey).toBe('pk');
    });

    it('should write snapshot with context', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.context).toBeDefined();
      expect(snapshot.context.account).toBe('123456789012');
      expect(snapshot.context.region).toBe('us-east-1');
      expect(snapshot.context.stackName).toBe('TestStack');
    });

    it('should write snapshot with capturedAt timestamp', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.capturedAt).toBeDefined();
      expect(() => new Date(snapshot.capturedAt)).not.toThrow();
    });

    it('should write snapshot with schemaVersion', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.schemaVersion).toBe('1.0');
    });

    it('should write snapshot with identity for stable collision handling', () => {
      ensureAssetDir('TestStack', 'test-table__User');
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const snapshot = getSnapshotFromBinder(binder);
      
      expect(snapshot.identity).toBeDefined();
      expect(snapshot.identity.appId).toBe('test-app');
      expect(snapshot.identity.stackName).toBe('TestStack');
      expect(snapshot.identity.datastoreType).toBe('dynamodb');
      expect(snapshot.identity.entityName).toBe('User');
    });
  });
});
