import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

/**
 * Properties for the ChaimBinder construct.
 * 
 * @property schemaPath - Path to the .bprint schema file (JSON format)
 * @property table - DynamoDB Table resource to bind with the schema
 * @property apiKey - API key from the Chaim SaaS UI
 * @property apiSecret - API secret from the Chaim SaaS UI
 * @property appId - Application identifier shown in the SaaS platform
 */
export interface ChaimBinderProps {
  /** Path to the .bprint schema file (JSON format) */
  schemaPath: string;
  
  /** DynamoDB Table resource to bind with the schema */
  table: dynamodb.ITable;
  
  /** API key from the Chaim SaaS UI */
  apiKey: string;
  
  /** API secret from the Chaim SaaS UI */
  apiSecret: string;
  
  /** Application identifier shown in the SaaS platform */
  appId: string;
}
