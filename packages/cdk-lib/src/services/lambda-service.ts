import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ChaimBinderProps } from '../types/chaim-binder-props';

export interface BaseEnvironment {
  ENHANCED_DATA_STORE: string;
  MODE: string;
}

export interface OSSEnvironment extends BaseEnvironment {
  MODE: 'oss';
}

export interface SaaSEnvironment extends BaseEnvironment {
  MODE: 'saas';
  API_URL: string;
  API_KEY: string;
  API_SECRET: string;
  APP_ID: string;
}

export type LambdaEnvironment = OSSEnvironment | SaaSEnvironment;

export class LambdaService {
  /**
   * Creates a Lambda function for the Chaim binder custom resource
   */
  public static createHandler(
    scope: Construct,
    props: ChaimBinderProps,
    enhancedDataStore: string
  ): lambda.Function {
    // Use inline code for tests, asset bundling for production
    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    
    const handler = new lambda.Function(scope, 'ChaimBinderHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: isTestEnvironment 
        ? lambda.Code.fromInline(this.getInlineHandlerCode())
        : lambda.Code.fromAsset('src/lambda-handler', {
            bundling: {
              image: lambda.Runtime.NODEJS_20_X.bundlingImage,
              command: [
                'bash', '-c',
                'npm install --silent && npx tsc index.ts --outDir /asset-output --target es2020 --module commonjs --moduleResolution node --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck && cp package.json /asset-output/ 2>/dev/null || true'
              ],
            },
          }),
      timeout: cdk.Duration.minutes(5),
      environment: this.createEnvironment(props, enhancedDataStore),
    });

    this.addLoggingPermissions(handler);
    this.addSecretsManagerPermissions(handler, props);
    return handler;
  }

  private static createEnvironment(props: ChaimBinderProps, enhancedDataStore: string): { [key: string]: string } {
    const isSaaSMode = this.isSaaSMode(props);
    const config = this.getConfiguration();
    
    if (isSaaSMode) {
      const environment: { [key: string]: string } = {
        ENHANCED_DATA_STORE: enhancedDataStore,
        MODE: 'saas',
        API_URL: config.apiUrl,
        API_TIMEOUT: config.timeout.toString(),
        API_RETRY_ATTEMPTS: config.retryAttempts.toString(),
        APP_ID: props.appId!,
      };

      // Use Secrets Manager if enabled, otherwise use direct credentials
      if (props.useSecretsManager && props.secretName) {
        environment.USE_SECRETS_MANAGER = 'true';
        environment.SECRET_NAME = props.secretName;
      } else {
        environment.API_KEY = props.apiKey!;
        environment.API_SECRET = props.apiSecret!;
      }

      return environment;
    } else {
      return {
        ENHANCED_DATA_STORE: enhancedDataStore,
        MODE: 'oss',
        API_TIMEOUT: config.timeout.toString(),
        API_RETRY_ATTEMPTS: config.retryAttempts.toString(),
      };
    }
  }

  private static getConfiguration() {
    return {
      apiUrl: process.env.CHAIM_API_URL || 'https://api.chaim.co',
      timeout: parseInt(process.env.CHAIM_API_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.CHAIM_RETRY_ATTEMPTS || '3'),
    };
  }

  /**
   * Determines if the construct is running in SaaS mode (with API credentials)
   */
  private static isSaaSMode(props: ChaimBinderProps): boolean {
    return !!(props.apiKey && props.apiSecret && props.appId);
  }

  private static addLoggingPermissions(handler: lambda.Function): void {
    handler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['*'],
    }));
  }

  private static addSecretsManagerPermissions(handler: lambda.Function, props: ChaimBinderProps): void {
    if (props.useSecretsManager && props.secretName) {
      // Grant permission to read the specific secret
      handler.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:*:*:secret:${props.secretName}*`
        ],
      }));
    }
  }

  private static getInlineHandlerCode(): string {
    // Simplified inline handler code for testing
    return `
const https = require('https');
const { URL } = require('url');

exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const requestType = event.RequestType;
  const mode = process.env.MODE;
  const enhancedDataStore = process.env.ENHANCED_DATA_STORE;
  
  if (!enhancedDataStore) {
    throw new Error('Missing required environment variable: ENHANCED_DATA_STORE');
  }
  
  if (!mode) {
    throw new Error('Missing required environment variable: MODE');
  }
  
  try {
    let response;
    
    switch (requestType) {
      case 'Create':
      case 'Update':
        if (mode === 'saas') {
          response = { status: 'success', message: 'Schema registered in SaaS mode (test)' };
        } else {
          response = { status: 'success', message: 'Schema registered in OSS mode' };
        }
        break;
      case 'Delete':
        if (mode === 'saas') {
          response = { status: 'deleted', message: 'Schema deleted in SaaS mode (test)' };
        } else {
          response = { status: 'deleted', message: 'Schema deleted in OSS mode' };
        }
        break;
      default:
        throw new Error(\`Unsupported request type: \${requestType}\`);
    }
    
    console.log('Success:', response);
    
    const schemaData = JSON.parse(enhancedDataStore);
    const tableArn = schemaData.table_metadata?.tableArn;
    const tableName = schemaData.table_metadata?.tableName;
    
    const physicalResourceId = mode === 'saas' 
      ? \`test-\${Date.now()}\`
      : \`oss-\${Date.now()}\`;
    
    return {
      PhysicalResourceId: physicalResourceId,
      Data: {
        SchemaId: response.schemaId || (mode === 'saas' ? 'test-schema' : 'oss-schema'),
        Status: response.status || 'success',
        Mode: mode,
        TableArn: tableArn,
        TableName: tableName,
      },
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
    `;
  }

}
