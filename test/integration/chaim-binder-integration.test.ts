import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimBinder } from '../../src/chaim-binder';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('ChaimBinder Integration', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let userTable: dynamodb.Table;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    
    userTable = new dynamodb.Table(stack, 'UserTable', {
      tableName: 'user-table',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('OSS Mode', () => {
    it('should create ChaimBinder in OSS mode without errors', () => {
      // Mock schema file content
      const mockSchemaContent = JSON.stringify({
        schemaVersion: '1.0.0',
        namespace: 'user',
        description: 'User entity schema',
        entity: {
          primaryKey: { partitionKey: 'userId' },
          fields: [
            { name: 'userId', type: 'string', required: true },
            { name: 'email', type: 'string', required: true }
          ]
        }
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      // Create the construct in OSS mode
      const chaimBinder = new ChaimBinder(stack, 'TestChaimBinderOSS', {
        schemaPath: './schemas/user.bprint',
        table: userTable,
        // No API credentials - OSS mode
      });

      // Verify the construct was created successfully
      expect(chaimBinder.mode).toBe('oss');
      expect(chaimBinder.node.id).toBe('TestChaimBinderOSS');
      
      // Verify the stack has the construct
      expect(stack.node.children).toContain(chaimBinder);
    });
  });

  describe('SaaS Mode', () => {
    it('should create ChaimBinder in SaaS mode without errors', () => {
      // Mock schema file content
      const mockSchemaContent = JSON.stringify({
        schemaVersion: '1.0.0',
        namespace: 'user',
        description: 'User entity schema',
        entity: {
          primaryKey: { partitionKey: 'userId' },
          fields: [
            { name: 'userId', type: 'string', required: true },
            { name: 'email', type: 'string', required: true }
          ]
        }
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      // Create the construct in SaaS mode
      const chaimBinder = new ChaimBinder(stack, 'TestChaimBinderSaaS', {
        schemaPath: './schemas/user.bprint',
        table: userTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      });

      // Verify the construct was created successfully
      expect(chaimBinder.mode).toBe('saas');
      expect(chaimBinder.node.id).toBe('TestChaimBinderSaaS');
      
      // Verify the stack has the construct
      expect(stack.node.children).toContain(chaimBinder);
    });
  });

  describe('Complex Schema Handling', () => {
    it('should handle complex schema with multiple field types', () => {
      // Mock complex schema file content
      const mockSchemaContent = JSON.stringify({
        schemaVersion: '1.0.0',
        namespace: 'order',
        description: 'Order entity schema with complex fields',
        entity: {
          primaryKey: { partitionKey: 'orderId' },
          fields: [
            { name: 'orderId', type: 'string', required: true },
            { name: 'userId', type: 'string', required: true },
            { name: 'items', type: 'string', required: true },
            { name: 'totalAmount', type: 'number', required: true },
            { name: 'status', type: 'string', required: true, enum: ['pending', 'confirmed', 'shipped', 'delivered'] },
            { name: 'createdAt', type: 'timestamp', required: true },
            { name: 'updatedAt', type: 'timestamp', required: true }
          ]
        }
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      // Create the construct in OSS mode
      const chaimBinder = new ChaimBinder(stack, 'TestChaimBinderComplex', {
        schemaPath: './schemas/order.bprint',
        table: userTable,
        // No API credentials - OSS mode
      });

      // Verify the construct was created successfully
      expect(chaimBinder.mode).toBe('oss');
      expect(chaimBinder.node.id).toBe('TestChaimBinderComplex');
      
      // Verify the stack has the construct
      expect(stack.node.children).toContain(chaimBinder);
    });
  });
});
