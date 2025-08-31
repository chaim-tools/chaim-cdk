import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimBinderProps } from '../types/chaim-binder-props';

export class PropsValidator {
  /**
   * Validates all required properties for ChaimBinder
   */
  public static validate(props: ChaimBinderProps): void {
    this.validateBasicProps(props);
    this.validateSchemaPath(props.schemaPath);
    this.validateTable(props.table);
    this.validateApiCredentials(props);
    this.validateAppId(props.appId);
  }

  private static validateBasicProps(props: ChaimBinderProps): void {
    if (!props) {
      throw new Error('Props are required');
    }
  }

  private static validateSchemaPath(schemaPath: string): void {
    if (!schemaPath) {
      throw new Error('Schema path is required');
    }

    if (typeof schemaPath !== 'string') {
      throw new Error('Schema path must be a string');
    }

    if (schemaPath.trim() === '') {
      throw new Error('Schema path cannot be empty');
    }

    if (!schemaPath.endsWith('.json')) {
      throw new Error('Schema path must be a valid JSON file (.json extension)');
    }
  }

  private static validateTable(table: dynamodb.ITable): void {
    if (!table) {
      throw new Error('Table is required');
    }

    if (!(table instanceof dynamodb.Table)) {
      throw new Error('Table must be a concrete DynamoDB Table construct');
    }
  }

  private static validateApiCredentials(props: ChaimBinderProps): void {
    if (!props.apiKey) {
      throw new Error('API key is required');
    }

    if (typeof props.apiKey !== 'string') {
      throw new Error('API key must be a string');
    }

    if (props.apiKey.trim() === '') {
      throw new Error('API key cannot be empty');
    }

    if (!props.apiSecret) {
      throw new Error('API secret is required');
    }

    if (typeof props.apiSecret !== 'string') {
      throw new Error('API secret must be a string');
    }

    if (props.apiSecret.trim() === '') {
      throw new Error('API secret cannot be empty');
    }
  }

  private static validateAppId(appId: string): void {
    if (!appId) {
      throw new Error('App ID is required');
    }

    if (typeof appId !== 'string') {
      throw new Error('App ID must be a string');
    }

    if (appId.trim() === '') {
      throw new Error('App ID cannot be empty');
    }

    // Validate app ID format (alphanumeric and hyphens only)
    if (!/^[a-zA-Z0-9-]+$/.test(appId)) {
      throw new Error('App ID must contain only alphanumeric characters and hyphens');
    }
  }
}
