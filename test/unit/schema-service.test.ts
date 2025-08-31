import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaService, SchemaData } from '../../src/services/schema-service';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('SchemaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateAndLoad', () => {
    it('should load valid schema from JSON file', () => {
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

      const result = SchemaService.validateAndLoad('./test-schema.json');

      expect(result).toEqual({
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
    });

    it('should throw error when schema file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        SchemaService.validateAndLoad('./non-existent-schema.json');
      }).toThrow('Schema file not found: ./non-existent-schema.json');
    });

    it('should throw error when schema file is not JSON', () => {
      mockFs.existsSync.mockReturnValue(true);

      expect(() => {
        SchemaService.validateAndLoad('./schema.yaml');
      }).toThrow('Schema file must be a valid JSON file (.json extension)');
    });

    it('should throw error when schema file has invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json content');

      expect(() => {
        SchemaService.validateAndLoad('./invalid-schema.json');
      }).toThrow('Invalid JSON format in schema file:');
    });

    it('should throw error when schema is missing required fields', () => {
      const mockSchemaContent = JSON.stringify({
        chaim_version: 1,
        // Missing model_name and fields
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      expect(() => {
        SchemaService.validateAndLoad('./incomplete-schema.json');
      }).toThrow('Schema must contain required field: model_name');
    });

    it('should throw error when schema fields is not an array', () => {
      const mockSchemaContent = JSON.stringify({
        chaim_version: 1,
        model_name: 'User',
        fields: 'not an array',
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      expect(() => {
        SchemaService.validateAndLoad('./invalid-fields-schema.json');
      }).toThrow('Schema fields must be an array');
    });

    it('should throw error when schema has empty fields array', () => {
      const mockSchemaContent = JSON.stringify({
        chaim_version: 1,
        model_name: 'User',
        fields: [],
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockSchemaContent);

      expect(() => {
        SchemaService.validateAndLoad('./empty-fields-schema.json');
      }).toThrow('Schema must contain at least one field');
    });
  });
});
