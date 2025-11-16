import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

/**
 * Properties for the ChaimBinder construct.
 * 
 * @property schemaPath - Path to the .bprint schema file (JSON format) - Required
 * @property table - DynamoDB Table resource to bind with the schema - Required
 * @property apiKey - API key from the Chaim SaaS UI - Optional for SaaS mode
 * @property apiSecret - API secret from the Chaim SaaS UI - Optional for SaaS mode
 * @property appId - Application identifier shown in the SaaS platform - Optional for SaaS mode
 * @property useSecretsManager - Whether to use AWS Secrets Manager for API credentials - Optional
 * @property secretName - Name of the secret in AWS Secrets Manager - Optional
 */
export interface ChaimBinderProps {
  /** Path to the .bprint schema file (JSON format) - Required */
  schemaPath: string;
  
  /** DynamoDB Table resource to bind with the schema - Required */
  table: dynamodb.ITable;
  
  /** API key from the Chaim SaaS UI - Optional for SaaS mode */
  apiKey?: string;
  
  /** API secret from the Chaim SaaS UI - Optional for SaaS mode */
  apiSecret?: string;
  
  /** Application identifier shown in the SaaS platform - Optional for SaaS mode */
  appId?: string;
  
  /** Whether to use AWS Secrets Manager for API credentials - Optional */
  useSecretsManager?: boolean;
  
  /** Name of the secret in AWS Secrets Manager - Optional */
  secretName?: string;
}
