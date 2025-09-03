import { describe, it, expect, vi } from 'vitest';
import { PropsValidator } from '../../src/validators/props-validator';
import { ChaimBinderProps } from '../../src/types/chaim-binder-props';

// Mock DynamoDB table
const mockTable = {
  tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/TestTable',
  tableName: 'TestTable',
} as any;

describe('PropsValidator', () => {
  describe('OSS Mode Validation', () => {
    it('should accept valid OSS mode props', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: mockTable,
        // No API credentials - OSS mode
      };

      expect(() => PropsValidator.validate(props)).not.toThrow();
    });

    it('should accept OSS mode props with partial SaaS credentials', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: mockTable,
        apiKey: 'test-key', // Partial credentials still triggers SaaS mode validation
      };

      expect(() => PropsValidator.validate(props)).toThrow('API secret is required when using SaaS mode');
    });
  });

  describe('SaaS Mode Validation', () => {
    it('should accept valid SaaS mode props', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app',
      };

      expect(() => PropsValidator.validate(props)).not.toThrow();
    });

    it('should reject SaaS mode props with missing API key', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: mockTable,
        apiSecret: 'test-api-secret',
        appId: 'test-app',
      };

      expect(() => PropsValidator.validate(props)).toThrow('API key is required when using SaaS mode');
    });

    it('should reject SaaS mode props with missing API secret', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: mockTable,
        apiKey: 'test-api-key',
        appId: 'test-app',
      };

      expect(() => PropsValidator.validate(props)).toThrow('API secret is required when using SaaS mode');
    });

    it('should reject SaaS mode props with missing app ID', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: mockTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      };

      expect(() => PropsValidator.validate(props)).toThrow('App ID is required when using SaaS mode');
    });
  });

  describe('validateSchemaPath', () => {
    it('should accept valid .bprint file path', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: mockTable,
      };

      expect(() => PropsValidator.validate(props)).not.toThrow();
    });

    it('should reject non-.bprint file extensions', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.json',
        table: mockTable,
      };

      expect(() => PropsValidator.validate(props)).toThrow('Schema file must have a .bprint extension');
    });

    it('should reject empty schema path', () => {
      const props: ChaimBinderProps = {
        schemaPath: '',
        table: mockTable,
      };

      expect(() => PropsValidator.validate(props)).toThrow('Schema path is required');
    });

    it('should reject undefined schema path', () => {
      const props: ChaimBinderProps = {
        schemaPath: undefined as any,
        table: mockTable,
      };

      expect(() => PropsValidator.validate(props)).toThrow('Schema path is required');
    });
  });

  describe('validateTable', () => {
    it('should accept valid table', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: mockTable,
      };

      expect(() => PropsValidator.validate(props)).not.toThrow();
    });

    it('should reject undefined table', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: undefined as any,
      };

      expect(() => PropsValidator.validate(props)).toThrow('DynamoDB table is required');
    });

    it('should reject null table', () => {
      const props: ChaimBinderProps = {
        schemaPath: './schemas/user.bprint',
        table: null as any,
      };

      expect(() => PropsValidator.validate(props)).toThrow('DynamoDB table is required');
    });
  });
});
