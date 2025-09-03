import { ChaimBinderProps } from '../types/chaim-binder-props';

export class PropsValidator {
  /**
   * Validates all ChaimBinder properties
   */
  static validate(props: ChaimBinderProps): void {
    this.validateSchemaPath(props.schemaPath);
    this.validateTable(props.table);
    
    // If any SaaS credentials are provided, validate all required SaaS fields
    if (this.isSaaSMode(props)) {
      this.validateApiCredentials(props);
      this.validateAppId(props);
    }
  }

  /**
   * Determines if the props indicate SaaS mode (any API credential provided)
   */
  private static isSaaSMode(props: ChaimBinderProps): boolean {
    return !!(props.apiKey || props.apiSecret || props.appId);
  }

  /**
   * Validates the schema path
   */
  private static validateSchemaPath(schemaPath: string): void {
    if (!schemaPath) {
      throw new Error('Schema path is required');
    }

    if (!schemaPath.endsWith('.bprint')) {
      throw new Error('Schema file must have a .bprint extension');
    }
  }

  /**
   * Validates the DynamoDB table
   */
  private static validateTable(table: any): void {
    if (!table) {
      throw new Error('DynamoDB table is required');
    }
  }

  /**
   * Validates API credentials for SaaS mode
   */
  private static validateApiCredentials(props: ChaimBinderProps): void {
    if (!props.apiKey) {
      throw new Error('API key is required when using SaaS mode');
    }

    if (!props.apiSecret) {
      throw new Error('API secret is required when using SaaS mode');
    }
  }

  /**
   * Validates app ID for SaaS mode
   */
  private static validateAppId(props: ChaimBinderProps): void {
    if (!props.appId) {
      throw new Error('App ID is required when using SaaS mode');
    }
  }
}
