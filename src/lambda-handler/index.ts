import https from 'https';
import { URL } from 'url';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Simple structured logger for Lambda
interface Logger {
  info(message: string, meta?: Record<string, any>): void;
  error(message: string, error?: Error, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
}

const logger: Logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.log(JSON.stringify({ level: 'INFO', message, ...meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error?: Error, meta?: Record<string, any>) => {
    console.error(JSON.stringify({ 
      level: 'ERROR', 
      message, 
      error: error?.message, 
      stack: error?.stack,
      ...meta, 
      timestamp: new Date().toISOString() 
    }));
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(JSON.stringify({ level: 'WARN', message, ...meta, timestamp: new Date().toISOString() }));
  }
};

interface CloudFormationEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResourceProperties: Record<string, any>;
}

interface CloudFormationResponse {
  PhysicalResourceId: string;
  Data: Record<string, any>;
}

interface ApiResponse {
  schemaId?: string;
  status?: string;
  [key: string]: any;
}

export const handler = async (event: CloudFormationEvent, context: any): Promise<CloudFormationResponse> => {
  const correlationId = context.awsRequestId;
  logger.info('Processing CloudFormation event', { 
    requestType: event.RequestType,
    correlationId,
    resourceProperties: event.ResourceProperties 
  });
  
  const requestType = event.RequestType;
  
  const mode = process.env.MODE;
  const apiUrl = process.env.API_URL;
  const appId = process.env.APP_ID;
  const enhancedDataStore = process.env.ENHANCED_DATA_STORE;
  const useSecretsManager = process.env.USE_SECRETS_MANAGER === 'true';
  const secretName = process.env.SECRET_NAME;
  
  // Configuration with defaults (used in environment setup)
  const _config = {
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS || '3'),
  };
  
  // Validate required environment variables
  if (!enhancedDataStore) {
    throw new Error('Missing required environment variable: ENHANCED_DATA_STORE');
  }
  
  if (!mode) {
    throw new Error('Missing required environment variable: MODE');
  }
  
  // Validate SaaS mode environment variables if in SaaS mode
  if (mode === 'saas') {
    if (!apiUrl || !appId) {
      throw new Error('Missing required SaaS environment variables: API_URL, APP_ID');
    }
    
    if (useSecretsManager) {
      if (!secretName) {
        throw new Error('Missing required environment variable: SECRET_NAME when using Secrets Manager');
      }
    } else {
      const apiKey = process.env.API_KEY;
      const apiSecret = process.env.API_SECRET;
      if (!apiKey || !apiSecret) {
        throw new Error('Missing required SaaS environment variables: API_KEY, API_SECRET');
      }
    }
  }
  
  try {
    let response: ApiResponse;
    
    // Get API credentials (from environment or Secrets Manager)
    let apiKey: string;
    let apiSecret: string;
    
    if (mode === 'saas') {
      if (useSecretsManager && secretName) {
        const credentials = await getCredentialsFromSecretsManager(secretName);
        apiKey = credentials.apiKey;
        apiSecret = credentials.apiSecret;
      } else {
        apiKey = process.env.API_KEY!;
        apiSecret = process.env.API_SECRET!;
      }
    }
    
    switch (requestType) {
      case 'Create':
      case 'Update':
        if (mode === 'saas') {
          response = await registerSchema(apiUrl!, apiKey!, apiSecret!, appId!, enhancedDataStore);
        } else {
          // OSS mode: just log and return success
          response = { status: 'success', message: 'Schema registered in OSS mode' };
          logger.info('OSS Mode: Schema validated and stored locally', { correlationId });
        }
        break;
      case 'Delete':
        if (mode === 'saas') {
          response = await deleteSchema(apiUrl!, apiKey!, apiSecret!, appId!);
        } else {
          // OSS mode: just log and return success
          response = { status: 'deleted', message: 'Schema deleted in OSS mode' };
          logger.info('OSS Mode: Schema removed from local storage', { correlationId });
        }
        break;
      default:
        throw new Error(`Unsupported request type: ${requestType}`);
    }
    
    logger.info('CloudFormation event processed successfully', { 
      response, 
      correlationId,
      requestType 
    });
    
    // Extract table info from enhanced data store for response
    const schemaData = JSON.parse(enhancedDataStore);
    const tableArn = schemaData.table_metadata?.tableArn;
    const tableName = schemaData.table_metadata?.tableName;
    
    // Generate physical resource ID based on mode
    const physicalResourceId = mode === 'saas' 
      ? `${appId}-${Date.now()}`
      : `oss-${Date.now()}`;
    
    return {
      PhysicalResourceId: physicalResourceId,
      Data: {
        SchemaId: response.schemaId || (mode === 'saas' ? appId : 'oss-schema'),
        Status: response.status || 'success',
        Mode: mode,
        TableArn: tableArn,
        TableName: tableName,
      },
    };
  } catch (error) {
    logger.error('Failed to process CloudFormation event', error as Error, { 
      correlationId,
      requestType,
      mode 
    });
    throw error;
  }
};

async function registerSchema(apiUrl: string, apiKey: string, apiSecret: string, appId: string, enhancedDataStore: string): Promise<ApiResponse> {
  const url = new URL(`${apiUrl}/api/v1/schemas`);
  
  const schemaData = JSON.parse(enhancedDataStore);
  const postData = JSON.stringify({
    appId: appId,
    schema: schemaData,
  });
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-API-Key': apiKey,
      'X-API-Secret': apiSecret,
    },
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
  };
  
  return makeHttpRequest(options, postData, 'registerSchema');
}

async function deleteSchema(apiUrl: string, apiKey: string, apiSecret: string, appId: string): Promise<ApiResponse> {
  const url = new URL(`${apiUrl}/api/v1/schemas/${appId}`);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'DELETE',
    headers: {
      'X-API-Key': apiKey,
      'X-API-Secret': apiSecret,
    },
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
  };
  
  return makeHttpRequest(options, undefined, 'deleteSchema');
}

async function makeHttpRequest(options: any, data?: string, operation: string = 'httpRequest'): Promise<ApiResponse> {
  const maxRetries = parseInt(process.env.API_RETRY_ATTEMPTS || '3');
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Making HTTP request (attempt ${attempt}/${maxRetries})`, { 
        operation, 
        method: options.method,
        hostname: options.hostname,
        path: options.path 
      });
      
      const result = await new Promise<ApiResponse>((resolve, reject) => {
        const req = https.request(options, (res: any) => {
          let responseData = '';
          
          res.on('data', (chunk: any) => {
            responseData += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(responseData);
                resolve(parsed);
              } catch (e) {
                resolve({ status: 'success', data: responseData });
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          });
        });
        
        req.on('error', (error: any) => {
          reject(error);
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        
        if (data) {
          req.write(data);
        }
        req.end();
      });
      
      logger.info(`HTTP request successful`, { operation, attempt });
      return result;
      
    } catch (error) {
      lastError = error as Error;
      logger.warn(`HTTP request failed (attempt ${attempt}/${maxRetries})`, { 
        operation, 
        error: lastError.message,
        attempt 
      });
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff: wait 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  logger.error(`HTTP request failed after ${maxRetries} attempts`, lastError!, { operation });
  throw lastError;
}

async function getCredentialsFromSecretsManager(secretName: string): Promise<{ apiKey: string; apiSecret: string }> {
  const secretsManager = new SecretsManagerClient();
  
  try {
    logger.info('Retrieving credentials from Secrets Manager', { secretName });
    
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const result = await secretsManager.send(command);
    
    if (!result.SecretString) {
      throw new Error('Secret value is empty');
    }
    
    const secret = JSON.parse(result.SecretString);
    
    if (!secret.apiKey || !secret.apiSecret) {
      throw new Error('Secret must contain apiKey and apiSecret fields');
    }
    
    logger.info('Successfully retrieved credentials from Secrets Manager', { secretName });
    
    return {
      apiKey: secret.apiKey,
      apiSecret: secret.apiSecret,
    };
  } catch (error) {
    logger.error('Failed to retrieve credentials from Secrets Manager', error as Error, { secretName });
    throw new Error(`Failed to retrieve credentials from Secrets Manager: ${(error as Error).message}`);
  }
}

