import { describe, it, expect } from 'vitest';
import { TableMetadata } from '../../src/types/table-metadata';

describe('TableMetadata', () => {
  describe('constructor', () => {
    it('should create TableMetadata with all required fields', () => {
      const metadata = new TableMetadata(
        'test-table',
        'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        'us-east-1',
        '123456789012'
      );

      expect(metadata.tableName).toBe('test-table');
      expect(metadata.tableArn).toBe('arn:aws:dynamodb:us-east-1:123456789012:table/test-table');
      expect(metadata.region).toBe('us-east-1');
      expect(metadata.account).toBe('123456789012');
      expect(metadata.encryptionKey).toBeUndefined();
    });

    it('should create TableMetadata with encryption key', () => {
      const metadata = new TableMetadata(
        'test-table',
        'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        'us-east-1',
        '123456789012',
        'arn:aws:kms:us-east-1:123456789012:key/test-key'
      );

      expect(metadata.encryptionKey).toBe('arn:aws:kms:us-east-1:123456789012:key/test-key');
    });
  });

  describe('toJSON', () => {
    it('should return JSON object without encryption key when not provided', () => {
      const metadata = new TableMetadata(
        'test-table',
        'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        'us-east-1',
        '123456789012'
      );

      const json = metadata.toJSON();

      expect(json).toEqual({
        tableName: 'test-table',
        tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        region: 'us-east-1',
        account: '123456789012',
      });
      expect(json).not.toHaveProperty('encryptionKey');
    });

    it('should return JSON object with encryption key when provided', () => {
      const metadata = new TableMetadata(
        'test-table',
        'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        'us-east-1',
        '123456789012',
        'arn:aws:kms:us-east-1:123456789012:key/test-key'
      );

      const json = metadata.toJSON();

      expect(json).toEqual({
        tableName: 'test-table',
        tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        region: 'us-east-1',
        account: '123456789012',
        encryptionKey: 'arn:aws:kms:us-east-1:123456789012:key/test-key',
      });
    });
  });

  describe('fromJSON', () => {
    it('should create TableMetadata from JSON object', () => {
      const jsonData = {
        tableName: 'test-table',
        tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        region: 'us-east-1',
        account: '123456789012',
        encryptionKey: 'arn:aws:kms:us-east-1:123456789012:key/test-key',
      };

      const metadata = TableMetadata.fromJSON(jsonData);

      expect(metadata.tableName).toBe('test-table');
      expect(metadata.tableArn).toBe('arn:aws:dynamodb:us-east-1:123456789012:table/test-table');
      expect(metadata.region).toBe('us-east-1');
      expect(metadata.account).toBe('123456789012');
      expect(metadata.encryptionKey).toBe('arn:aws:kms:us-east-1:123456789012:key/test-key');
    });

    it('should create TableMetadata from JSON object without encryption key', () => {
      const jsonData = {
        tableName: 'test-table',
        tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        region: 'us-east-1',
        account: '123456789012',
      };

      const metadata = TableMetadata.fromJSON(jsonData);

      expect(metadata.tableName).toBe('test-table');
      expect(metadata.tableArn).toBe('arn:aws:dynamodb:us-east-1:123456789012:table/test-table');
      expect(metadata.region).toBe('us-east-1');
      expect(metadata.account).toBe('123456789012');
      expect(metadata.encryptionKey).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should pass validation for valid metadata', () => {
      const metadata = new TableMetadata(
        'test-table',
        'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        'us-east-1',
        '123456789012'
      );

      expect(() => metadata.validate()).not.toThrow();
    });

    it('should throw error when tableName is missing', () => {
      const metadata = new TableMetadata(
        '',
        'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        'us-east-1',
        '123456789012'
      );

      expect(() => metadata.validate()).toThrow('Table name is required');
    });

    it('should throw error when tableArn is missing', () => {
      const metadata = new TableMetadata(
        'test-table',
        '',
        'us-east-1',
        '123456789012'
      );

      expect(() => metadata.validate()).toThrow('Table ARN is required');
    });

    it('should throw error when region is missing', () => {
      const metadata = new TableMetadata(
        'test-table',
        'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        '',
        '123456789012'
      );

      expect(() => metadata.validate()).toThrow('Region is required');
    });

    it('should throw error when account is missing', () => {
      const metadata = new TableMetadata(
        'test-table',
        'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        'us-east-1',
        ''
      );

      expect(() => metadata.validate()).toThrow('Account is required');
    });
  });
});
