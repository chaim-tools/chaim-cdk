const https = require('https');
const { URL: NodeURL } = require('url');

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

exports.handler = async (event: CloudFormationEvent, context: any): Promise<CloudFormationResponse> => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const requestType = event.RequestType;
  const resourceProperties = event.ResourceProperties;
  
  const apiUrl = process.env.API_URL;
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_SECRET;
  const appId = process.env.APP_ID;
  const enhancedDataStore = process.env.ENHANCED_DATA_STORE;
  
  // Validate required environment variables
  if (!apiUrl || !apiKey || !apiSecret || !appId || !enhancedDataStore) {
    throw new Error('Missing required environment variables');
  }
  
  try {
    let response: ApiResponse;
    
    switch (requestType) {
      case 'Create':
      case 'Update':
        response = await registerSchema(apiUrl, apiKey, apiSecret, appId, enhancedDataStore);
        break;
      case 'Delete':
        response = await deleteSchema(apiUrl, apiKey, apiSecret, appId);
        break;
      default:
        throw new Error(`Unsupported request type: ${requestType}`);
    }
    
    console.log('Success:', response);
    
    // Extract table info from enhanced data store for response
    const schemaData = JSON.parse(enhancedDataStore);
    const tableArn = schemaData.table_metadata?.tableArn;
    const tableName = schemaData.table_metadata?.tableName;
    
    return {
      PhysicalResourceId: `${appId}-${Date.now()}`,
      Data: {
        SchemaId: response.schemaId || appId,
        Status: response.status || 'success',
        TableArn: tableArn,
        TableName: tableName,
      },
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

async function registerSchema(apiUrl: string, apiKey: string, apiSecret: string, appId: string, enhancedDataStore: string): Promise<ApiResponse> {
  const url = new NodeURL(`${apiUrl}/api/v1/schemas`);
  
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
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res: any) => {
      let data = '';
      
      res.on('data', (chunk: any) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ status: 'success', data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error: any) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

async function deleteSchema(apiUrl: string, apiKey: string, apiSecret: string, appId: string): Promise<ApiResponse> {
  const url = new NodeURL(`${apiUrl}/api/v1/schemas/${appId}`);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'DELETE',
    headers: {
      'X-API-Key': apiKey,
      'X-API-Secret': apiSecret,
    },
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res: any) => {
      let data = '';
      
      res.on('data', (chunk: any) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: 'deleted' });
        } else {
          // Don't fail on delete if schema doesn't exist
          resolve({ status: 'deleted' });
        }
      });
    });
    
    req.on('error', (error: any) => {
      reject(error);
    });
    
    req.end();
  });
}
