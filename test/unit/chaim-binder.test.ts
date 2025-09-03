import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimBinder } from '../../src/chaim-binder';
import { ChaimBinderProps } from '../../src/types/chaim-binder-props';

// Mock all the services
vi.mock('../../src/services/schema-service');
vi.mock('../../src/services/table-metadata-service');
vi.mock('../../src/services/lambda-service');
vi.mock('../../src/services/custom-resource-service');

// Import the mocked modules
import { SchemaService } from '../../src/services/schema-service';
import { TableMetadataService } from '../../src/services/table-metadata-service';
import { LambdaService } from '../../src/services/lambda-service';
import { CustomResourceService } from '../../src/services/custom-resource-service';

// Get the mocked instances
const mockSchemaService = vi.mocked(SchemaService);
const mockTableMetadataService = vi.mocked(TableMetadataService);
const mockLambdaService = vi.mocked(LambdaService);
const mockCustomResourceService = vi.mocked(CustomResourceService);

describe('ChaimBinder', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let userTable: dynamodb.Table;
  let orderTable: dynamodb.Table;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    
    userTable = new dynamodb.Table(stack, 'UserTable', {
      tableName: 'user-table',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    orderTable = new dynamodb.Table(stack, 'OrderTable', {
      tableName: 'order-table',
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Set up mock implementations
    mockSchemaService.readSchema.mockReturnValue({
      schemaVersion: '1.0.0',
      namespace: 'user',
      description: 'User entity schema',
      entity: {
        primaryKey: 'userId',
        fields: { userId: { type: 'string' } }
      }
    });

    const mockTableMetadata = {
      tableName: 'user-table',
      tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/user-table',
      region: 'us-east-1',
      account: '123456789012',
      toJSON: () => ({
        tableName: 'user-table',
        tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/user-table',
        region: 'us-east-1',
        account: '123456789012'
      }),
      validate: () => {}
    };

    mockTableMetadataService.validateAndExtract.mockReturnValue(mockTableMetadata as any);
    mockLambdaService.createHandler.mockReturnValue({} as any);
    mockCustomResourceService.createCustomResource.mockReturnValue({} as any);
  });

  describe('OSS Mode', () => {
    it('should create ChaimBinder in OSS mode when no credentials provided', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: userTable,
        // No API credentials - OSS mode
      };

      const chaimBinder = new ChaimBinder(stack, 'UserSchemaOSS', props);

      expect(chaimBinder.mode).toBe('oss');
      expect(chaimBinder.node.id).toBe('UserSchemaOSS');
    });

    it('should create CloudFormation outputs in OSS mode', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: userTable,
      };

      new ChaimBinder(stack, 'UserSchemaOSS', props);

      // Verify that outputs were created instead of Lambda/custom resources
      expect(mockLambdaService.createHandler).not.toHaveBeenCalled();
      expect(mockCustomResourceService.createCustomResource).not.toHaveBeenCalled();
    });

    it('should not create Lambda or custom resources in OSS mode', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: userTable,
      };

      new ChaimBinder(stack, 'UserSchemaOSS', props);

      // Verify no Lambda or custom resources were created
      expect(mockLambdaService.createHandler).not.toHaveBeenCalled();
      expect(mockCustomResourceService.createCustomResource).not.toHaveBeenCalled();
    });
  });

  describe('SaaS Mode', () => {
    it('should create ChaimBinder in SaaS mode when credentials provided', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/order.bprint',
        table: orderTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app',
      };

      const chaimBinder = new ChaimBinder(stack, 'OrderSchemaSaaS', props);

      expect(chaimBinder.mode).toBe('saas');
      expect(chaimBinder.node.id).toBe('OrderSchemaSaaS');
    });

    it('should create Lambda and custom resources in SaaS mode', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/order.bprint',
        table: orderTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app',
      };

      new ChaimBinder(stack, 'OrderSchemaSaaS', props);

      // Verify that Lambda and custom resources were created
      expect(mockLambdaService.createHandler).toHaveBeenCalled();
      expect(mockCustomResourceService.createCustomResource).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should throw error for invalid schema path', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.json', // Invalid extension
        table: userTable,
      };

      expect(() => new ChaimBinder(stack, 'InvalidSchema', props)).toThrow();
    });

    it('should throw error for missing table', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: undefined as any,
      };

      expect(() => new ChaimBinder(stack, 'MissingTable', props)).toThrow();
    });

    it('should throw error for missing schema path', () => {
      const props: ChaimBinderProps = {
        schemaPath: '',
        table: userTable,
      };

      expect(() => new ChaimBinder(stack, 'MissingSchema', props)).toThrow();
    });

    it('should throw error for partial SaaS credentials - missing appId', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: userTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        // Missing appId
      };

      expect(() => new ChaimBinder(stack, 'PartialCredentials', props)).toThrow(
        'App ID is required when using SaaS mode'
      );
    });

    it('should throw error for partial SaaS credentials - missing apiSecret', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: userTable,
        apiKey: 'test-api-key',
        // Missing apiSecret
        appId: 'test-app',
      };

      expect(() => new ChaimBinder(stack, 'PartialCredentials2', props)).toThrow(
        'API secret is required when using SaaS mode'
      );
    });

    it('should throw error for partial SaaS credentials - missing apiKey', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: userTable,
        // Missing apiKey
        apiSecret: 'test-api-secret',
        appId: 'test-app',
      };

      expect(() => new ChaimBinder(stack, 'PartialCredentials3', props)).toThrow(
        'API key is required when using SaaS mode'
      );
    });
  });

  describe('File Extensions', () => {
    it('should accept .bprint files', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: userTable,
      };

      expect(() => new ChaimBinder(stack, 'ValidBprint', props)).not.toThrow();
    });

    it('should reject non-.bprint files', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.json',
        table: userTable,
      };

      expect(() => new ChaimBinder(stack, 'InvalidExtension', props)).toThrow('Schema file must have a .bprint extension');
    });
  });
});
