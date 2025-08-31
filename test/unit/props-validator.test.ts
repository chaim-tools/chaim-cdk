import { describe, it, expect } from 'vitest';
import { PropsValidator, ChaimBinderProps } from '../../src/validators/props-validator';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';

describe('PropsValidator', () => {
  let mockTable: dynamodb.ITable;

  beforeEach(() => {
    // Create a mock table for testing
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    mockTable = new dynamodb.Table(stack, 'TestTable', {
      tableName: 'test-table',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
  });

  describe('validate', () => {
    it('should pass validation for valid props', () => {
      const validProps: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(validProps)).not.toThrow();
    });

    it('should throw error when props is null', () => {
      expect(() => PropsValidator.validate(null as any)).toThrow('Props are required');
    });

    it('should throw error when props is undefined', () => {
      expect(() => PropsValidator.validate(undefined as any)).toThrow('Props are required');
    });
  });

  describe('validateSchemaPath', () => {
    it('should throw error when schemaPath is missing', () => {
      const props: ChaimBinderProps = {
        schemaPath: '',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('Schema path is required');
    });

    it('should throw error when schemaPath is not a string', () => {
      const props = {
        schemaPath: 123,
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props as any)).toThrow('Schema path must be a string');
    });

    it('should throw error when schemaPath is empty string', () => {
      const props: ChaimBinderProps = {
        schemaPath: '   ',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('Schema path cannot be empty');
    });

    it('should throw error when schemaPath does not end with .json', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.yaml',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('Schema path must be a valid JSON file (.json extension)');
    });
  });

  describe('validateTable', () => {
    it('should throw error when table is missing', () => {
      const props = {
        schemaPath: './test-schema.json',
        table: null,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props as any)).toThrow('Table is required');
    });

    it('should throw error when table is not a concrete Table construct', () => {
      const mockTableInterface = {} as dynamodb.ITable;
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTableInterface,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('Table must be a concrete DynamoDB Table construct');
    });
  });

  describe('validateApiCredentials', () => {
    it('should throw error when apiKey is missing', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: '',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('API key is required');
    });

    it('should throw error when apiKey is not a string', () => {
      const props = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 123,
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props as any)).toThrow('API key must be a string');
    });

    it('should throw error when apiKey is empty string', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: '   ',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('API key cannot be empty');
    });

    it('should throw error when apiSecret is missing', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: '',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('API secret is required');
    });

    it('should throw error when apiSecret is not a string', () => {
      const props = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 123,
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props as any)).toThrow('API secret must be a string');
    });

    it('should throw error when apiSecret is empty string', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: '   ',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('API secret cannot be empty');
    });
  });

  describe('validateAppId', () => {
    it('should throw error when appId is missing', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: '',
      };

      expect(() => PropsValidator.validate(props)).toThrow('App ID is required');
    });

    it('should throw error when appId is not a string', () => {
      const props = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 123,
      };

      expect(() => PropsValidator.validate(props as any)).toThrow('App ID must be a string');
    });

    it('should throw error when appId is empty string', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: '   ',
      };

      expect(() => PropsValidator.validate(props)).toThrow('App ID cannot be empty');
    });

    it('should throw error when appId contains invalid characters', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test_app_id',
      };

      expect(() => PropsValidator.validate(props)).toThrow('App ID must contain only alphanumeric characters and hyphens');
    });

    it('should pass validation for valid appId with hyphens', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      };

      expect(() => PropsValidator.validate(props)).not.toThrow();
    });

    it('should pass validation for valid appId with numbers', () => {
      const props: ChaimBinderProps = {
        schemaPath: './test-schema.json',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-123',
      };

      expect(() => PropsValidator.validate(props)).not.toThrow();
    });
  });
});
