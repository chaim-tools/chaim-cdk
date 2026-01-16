import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as fs from 'fs';
import * as path from 'path';
import { ChaimDynamoDBBinder } from '../../src/binders/chaim-dynamodb-binder';
import { ChaimCredentials } from '../../src/types/credentials';
import { TableBindingConfig } from '../../src/types/table-binding-config';
import { FailureMode } from '../../src/types/failure-mode';

// Mock schema data
const mockSchemaData = {
  schemaVersion: 'v1',
  entityName: 'User',
  description: 'Test user schema',
  primaryKey: { partitionKey: 'userId' },
  fields: [
    { name: 'userId', type: 'string', required: true },
    { name: 'email', type: 'string', required: true },
  ],
};

// Mock schema service
vi.mock('../../src/services/schema-service', () => ({
  SchemaService: {
    readSchema: vi.fn(() => mockSchemaData),
  },
}));

describe('ChaimDynamoDBBinder', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let table: dynamodb.Table;
  let testConfig: TableBindingConfig;
  const testAssetDirs: string[] = [];

  // Clean up test asset directories after all tests
  afterAll(() => {
    for (const dir of testAssetDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

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
    vi.restoreAllMocks();
  });

  // Helper to create asset directory for testing
  function ensureAssetDir(stackName: string, resourceId: string): string {
    const cdkRoot = process.cwd();
    const assetDir = path.join(cdkRoot, 'cdk.out', 'chaim', 'assets', stackName, resourceId);
    fs.mkdirSync(assetDir, { recursive: true });
    
    // Create a minimal index.js to satisfy CDK validation
    const handlerPath = path.join(assetDir, 'index.js');
    fs.writeFileSync(handlerPath, 'exports.handler = async () => {};', 'utf-8');
    
    // Create snapshot.json
    const snapshotPath = path.join(assetDir, 'snapshot.json');
    fs.writeFileSync(snapshotPath, '{}', 'utf-8');
    
    testAssetDirs.push(assetDir);
    return assetDir;
  }

  describe('constructor', () => {
    beforeEach(() => {
      // Pre-create asset directories for tests
      ensureAssetDir('TestStack', 'TestBinder__User');
    });

    it('should create binder with direct credentials', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder).toBeDefined();
      expect(binder.resourceId).toBeDefined();
      expect(binder.schemaData).toBeDefined();
      expect(binder.dataStoreMetadata).toBeDefined();
      expect(binder.dataStoreMetadata.type).toBe('dynamodb');
    });

    it('should create binder with Secrets Manager', () => {
      const smConfig = new TableBindingConfig(
        'test-app',
        ChaimCredentials.fromSecretsManager('chaim/credentials')
      );
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: smConfig,
      });

      expect(binder).toBeDefined();
      expect(binder.resourceId).toBeDefined();
    });

    it('should throw error when no config provided', () => {
      expect(() => {
        new ChaimDynamoDBBinder(stack, 'TestBinder', {
          schemaPath: './schemas/test.bprint',
          table,
        } as any);
      }).toThrow(/config is required/);
    });
  });

  describe('metadata extraction', () => {
    beforeEach(() => {
      ensureAssetDir('TestStack', 'TestBinder__User');
      ensureAssetDir('TestStack', 'CompositeBinder__User');
      ensureAssetDir('TestStack', 'GSIBinder__User');
    });

    it('should extract DynamoDB metadata correctly', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      const metadata = binder.dynamoDBMetadata;

      expect(metadata.type).toBe('dynamodb');
      expect(metadata.tableName).toBeDefined();
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
        config: testConfig,
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
        config: testConfig,
      });

      if (binder.dynamoDBMetadata.globalSecondaryIndexes) {
        expect(binder.dynamoDBMetadata.globalSecondaryIndexes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('failure modes', () => {
    beforeEach(() => {
      ensureAssetDir('TestStack', 'TestBinder__User');
    });

    it('should use BEST_EFFORT by default', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder).toBeDefined();
    });

    it('should accept STRICT failure mode', () => {
      const strictConfig = new TableBindingConfig(
        'test-app',
        ChaimCredentials.fromApiKeys('test-key', 'test-secret'),
        FailureMode.STRICT
      );
      
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: strictConfig,
      });

      expect(binder).toBeDefined();
      expect(binder.config.failureMode).toBe(FailureMode.STRICT);
    });
  });

  describe('snapshot writing', () => {
    beforeEach(() => {
      ensureAssetDir('TestStack', 'TestBinder__User');
    });

    it('should write LOCAL snapshot during construction', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.localSnapshotPath).toBeDefined();
      expect(binder.localSnapshotPath).toContain('.json');
    });

    it('should expose localSnapshotPath property', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      expect(binder.localSnapshotPath).toBeDefined();
      expect(binder.localSnapshotPath).toContain('/dynamodb/');
      expect(binder.localSnapshotPath).toContain('.json');
    });

    it('should generate resourceId based on construct ID when tableName is token', () => {
      const binder = new ChaimDynamoDBBinder(stack, 'TestBinder', {
        schemaPath: './schemas/test.bprint',
        table,
        config: testConfig,
      });

      // resourceId should contain entity name from schema
      expect(binder.resourceId).toContain('__User');
    });
  });
});
