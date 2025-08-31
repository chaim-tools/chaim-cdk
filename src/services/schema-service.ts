import * as fs from 'fs';

export interface SchemaData {
  chaim_version: number;
  model_name: string;
  fields: any[];
  [key: string]: any;
}

export class SchemaService {
  /**
   * Validates and loads a schema from a file path
   */
  public static validateAndLoad(schemaPath: string): SchemaData {
    this.validateSchemaPath(schemaPath);
    const schemaContent = this.readSchemaFile(schemaPath);
    const schemaData = this.parseSchemaContent(schemaContent, schemaPath);
    this.validateSchemaStructure(schemaData);
    return schemaData;
  }

  private static validateSchemaPath(schemaPath: string): void {
    if (!schemaPath) {
      throw new Error('Schema path is required');
    }

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    if (!schemaPath.endsWith('.json')) {
      throw new Error('Schema file must be a valid JSON file (.json extension)');
    }
  }

  private static readSchemaFile(schemaPath: string): string {
    try {
      return fs.readFileSync(schemaPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read schema file: ${error}`);
    }
  }

  private static parseSchemaContent(content: string, schemaPath: string): SchemaData {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON format in schema file: ${error}`);
    }
  }

  private static validateSchemaStructure(schemaData: SchemaData): void {
    const requiredFields = ['chaim_version', 'model_name', 'fields'];
    
    for (const field of requiredFields) {
      if (!schemaData[field]) {
        throw new Error(`Schema must contain required field: ${field}`);
      }
    }

    if (!Array.isArray(schemaData.fields)) {
      throw new Error('Schema fields must be an array');
    }

    if (schemaData.fields.length === 0) {
      throw new Error('Schema must contain at least one field');
    }
  }
}
