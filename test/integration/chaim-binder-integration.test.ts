import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Template } from 'aws-cdk-lib/assertions';
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
    stack = new cdk.Stack(app, 'IntegrationTestStack');
    
    // Create a test DynamoDB table
    userTable = new dynamodb.Table(stack, 'UserTable', {
      tableName: 'users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Complete Flow', () => {
    it('should create all required resources for a complete deployment', () => {
      // Mock schema file content
      const mockSchemaContent = JSON.stringify({
        chaim_version: 1,
        model_name: 'User',
        fields: [
          {
            name: 'id',
            type: 'string',
            required: true,
            partition_key: true,
          },
          {
            name: 'email',
            type: 'string',
            required: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            required: false,
          },
        ],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      // Create the construct
      new ChaimBinder(stack, 'TestChaimBinder', {
        schemaPath: './schemas/user.json',
        table: userTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      });

      // Assert the template
      const template = Template.fromStack(stack);
      
      // Should create a Lambda function
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
        Handler: 'index.handler',
        Timeout: 300,
        Environment: {
          Variables: {
            API_URL: 'https://api.chaim.co',
            API_KEY: 'test-api-key',
            API_SECRET: 'test-api-secret',
            APP_ID: 'test-app-id',
          },
        },
      });

      // Should create a custom resource
      template.hasResource('Custom::AWS', {});

      // Should create IAM roles and policies
      template.hasResource('AWS::IAM::Role', {});
      template.hasResource('AWS::IAM::Policy', {});
    });

    it('should handle complex schema with multiple field types', () => {
      // Mock complex schema file content
      const mockSchemaContent = JSON.stringify({
        chaim_version: 1,
        model_name: 'Product',
        fields: [
          {
            name: 'id',
            type: 'string',
            required: true,
            partition_key: true,
          },
          {
            name: 'category',
            type: 'string',
            required: true,
            sort_key: true,
          },
          {
            name: 'name',
            type: 'string',
            required: true,
          },
          {
            name: 'price',
            type: 'number',
            required: true,
          },
          {
            name: 'tags',
            type: 'list',
            item_type: 'string',
            required: false,
          },
          {
            name: 'metadata',
            type: 'map',
            required: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            required: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            required: false,
          },
        ],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      // Create the construct
      new ChaimBinder(stack, 'ProductChaimBinder', {
        schemaPath: './schemas/product.json',
        table: userTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'product-app-id',
      });

      // Assert the template
      const template = Template.fromStack(stack);
      
      // Should create Lambda function with correct environment
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            APP_ID: 'product-app-id',
          },
        },
      });
    });

    it('should handle table with encryption', () => {
      // Create a table with encryption
      const encryptedTable = new dynamodb.Table(stack, 'EncryptedTable', {
        tableName: 'encrypted-users',
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      });

      const mockSchemaContent = JSON.stringify({
        chaim_version: 1,
        model_name: 'EncryptedUser',
        fields: [
          {
            name: 'id',
            type: 'string',
            required: true,
            partition_key: true,
          },
        ],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      // Create the construct
      new ChaimBinder(stack, 'EncryptedChaimBinder', {
        schemaPath: './schemas/encrypted-user.json',
        table: encryptedTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'encrypted-app-id',
      });

      // Assert the template
      const template = Template.fromStack(stack);
      
      // Should create Lambda function
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            APP_ID: 'encrypted-app-id',
          },
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle schema file not found gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        new ChaimBinder(stack, 'TestChaimBinder', {
          schemaPath: './non-existent-schema.json',
          table: userTable,
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
          appId: 'test-app-id',
        });
      }).toThrow('Schema file not found: ./non-existent-schema.json');
    });

    it('should handle invalid JSON schema gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json content');

      expect(() => {
        new ChaimBinder(stack, 'TestChaimBinder', {
          schemaPath: './invalid-schema.json',
          table: userTable,
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
          appId: 'test-app-id',
        });
      }).toThrow('Invalid JSON format in schema file:');
    });

    it('should handle missing required schema fields gracefully', () => {
      const mockSchemaContent = JSON.stringify({
        chaim_version: 1,
        // Missing model_name and fields
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      expect(() => {
        new ChaimBinder(stack, 'TestChaimBinder', {
          schemaPath: './incomplete-schema.json',
          table: userTable,
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
          appId: 'test-app-id',
        });
      }).toThrow('Schema must contain required field: model_name');
    });
  });

  describe('Resource Dependencies', () => {
    it('should create proper resource dependencies', () => {
      const mockSchemaContent = JSON.stringify({
        chaim_version: 1,
        model_name: 'User',
        fields: [
          {
            name: 'id',
            type: 'string',
            required: true,
            partition_key: true,
          },
        ],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      // Create the construct
      new ChaimBinder(stack, 'TestChaimBinder', {
        schemaPath: './schemas/user.json',
        table: userTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      });

      // Assert the template
      const template = Template.fromStack(stack);
      
      // Should have Lambda function
      template.hasResource('AWS::Lambda::Function', {});
      
      // Should have custom resource
      template.hasResource('Custom::AWS', {});
      
      // Should have IAM resources
      template.hasResource('AWS::IAM::Role', {});
      template.hasResource('AWS::IAM::Policy', {});
    });
  });
});
