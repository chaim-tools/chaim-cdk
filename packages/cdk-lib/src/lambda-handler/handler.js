/**
 * Chaim Ingestion Lambda Handler
 * 
 * This is the CANONICAL Lambda handler for Chaim schema ingestion.
 * It implements the presigned upload flow:
 * 
 * Create/Update (UPSERT):
 *   1. Read snapshot.json from bundled asset
 *   2. Generate eventId (UUID v4) at runtime
 *   3. Compute contentHash (SHA-256 of snapshot bytes)
 *   4. POST /ingest/upload-url → get presigned S3 URL
 *   5. PUT snapshot bytes to presigned URL
 *   6. POST /ingest/snapshot-ref with action: 'UPSERT'
 * 
 * Delete:
 *   1. Read minimal metadata from snapshot.json
 *   2. Generate eventId (UUID v4)
 *   3. POST /ingest/snapshot-ref with action: 'DELETE'
 * 
 * FailureMode:
 *   - STRICT: Return FAILED to CloudFormation on any error
 *   - BEST_EFFORT: Log error but return SUCCESS to CloudFormation
 */

const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const crypto = require('crypto');

// Default configuration (can be overridden via environment variables)
const DEFAULT_API_BASE_URL = 'https://api.chaim.co';
const DEFAULT_MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

/**
 * Lambda handler entry point.
 */
exports.handler = async (event, context) => {
  console.log('CloudFormation Event:', JSON.stringify(event, null, 2));
  
  const requestType = event.RequestType; // 'Create', 'Update', or 'Delete'
  const failureMode = process.env.FAILURE_MODE || 'BEST_EFFORT';
  const apiBaseUrl = process.env.CHAIM_API_BASE_URL || DEFAULT_API_BASE_URL;
  const maxSnapshotBytes = parseInt(process.env.CHAIM_MAX_SNAPSHOT_BYTES || String(DEFAULT_MAX_SNAPSHOT_BYTES), 10);
  
  // Generate eventId at runtime (not synth-time)
  const eventId = crypto.randomUUID();
  let contentHash = '';
  
  try {
    // Read snapshot from bundled asset directory
    const snapshotBytes = fs.readFileSync('./snapshot.json', 'utf-8');
    const snapshotPayload = JSON.parse(snapshotBytes);
    
    // Compute contentHash (SHA-256 of snapshot bytes, excludes eventId)
    contentHash = 'sha256:' + crypto.createHash('sha256').update(snapshotBytes).digest('hex');
    
    // Get API credentials
    const { apiKey, apiSecret } = await getCredentials();
    
    if (requestType === 'Delete') {
      // DELETE flow: notify Chaim that binding is deactivated
      console.log('Processing Delete request - sending deactivation notification');
      
      await postSnapshotRef({
        apiBaseUrl,
        apiKey,
        apiSecret,
        payload: {
          action: 'DELETE',
          appId: snapshotPayload.appId,
          eventId,
          resourceId: snapshotPayload.resourceId,
          stackName: snapshotPayload.stackName,
          datastoreType: snapshotPayload.datastoreType,
        },
      });
      
      console.log('Deactivation notification sent successfully');
      
      return buildResponse(eventId, 'SUCCESS', 'DELETE', snapshotPayload.capturedAt);
    }
    
    // CREATE/UPDATE flow: presigned upload + commit
    console.log('Processing Create/Update request - executing ingestion workflow');
    console.log('EventId:', eventId);
    console.log('ContentHash:', contentHash);
    
    // Validate snapshot size
    if (snapshotBytes.length > maxSnapshotBytes) {
      throw new Error(
        `Snapshot size (${snapshotBytes.length} bytes) exceeds maximum allowed (${maxSnapshotBytes} bytes)`
      );
    }
    
    // Step 1: Request presigned upload URL
    console.log('Step 1: Requesting presigned upload URL...');
    const uploadUrlResponse = await postUploadUrl({
      apiBaseUrl,
      apiKey,
      apiSecret,
      payload: {
        appId: snapshotPayload.appId,
        eventId,
        contentHash,
      },
    });
    
    const { uploadUrl } = uploadUrlResponse;
    console.log('Received presigned URL');
    
    // Step 2: Upload snapshot bytes to S3
    console.log('Step 2: Uploading snapshot to S3...');
    await uploadToS3(uploadUrl, snapshotBytes);
    console.log('Snapshot uploaded to S3');
    
    // Step 3: Commit snapshot reference
    console.log('Step 3: Committing snapshot reference...');
    await postSnapshotRef({
      apiBaseUrl,
      apiKey,
      apiSecret,
      payload: {
        action: 'UPSERT',
        appId: snapshotPayload.appId,
        eventId,
        contentHash,
        datastoreType: snapshotPayload.datastoreType,
        datastoreArn: snapshotPayload.dataStore.arn,
        resourceId: snapshotPayload.resourceId,
        stackName: snapshotPayload.stackName,
      },
    });
    
    console.log('Snapshot reference committed successfully');
    
    return buildResponse(eventId, 'SUCCESS', 'UPSERT', snapshotPayload.capturedAt, contentHash);
    
  } catch (error) {
    console.error('Ingestion error:', error.message);
    console.error('Stack trace:', error.stack);
    
    if (failureMode === 'STRICT') {
      // STRICT mode: fail the CloudFormation deployment
      throw error;
    }
    
    // BEST_EFFORT mode: log error but return success to CloudFormation
    console.log('BEST_EFFORT mode: returning SUCCESS despite error');
    return buildResponse(eventId, 'FAILED', requestType === 'Delete' ? 'DELETE' : 'UPSERT', new Date().toISOString(), contentHash, error.message);
  }
};

/**
 * Build CloudFormation custom resource response.
 */
function buildResponse(eventId, status, action, timestamp, contentHash, errorMessage) {
  const response = {
    PhysicalResourceId: eventId,
    Data: {
      EventId: eventId,
      IngestStatus: status,
      Action: action,
      Timestamp: timestamp,
    },
  };
  
  if (contentHash) {
    response.Data.ContentHash = contentHash;
  }
  
  if (errorMessage) {
    response.Data.Error = errorMessage;
  }
  
  return response;
}

/**
 * Get API credentials from Secrets Manager or environment variables.
 */
async function getCredentials() {
  const secretName = process.env.SECRET_NAME;
  
  if (secretName) {
    // Secrets Manager mode
    console.log('Retrieving credentials from Secrets Manager...');
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient();
    
    const response = await client.send(new GetSecretValueCommand({
      SecretId: secretName,
    }));
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }
    
    const secret = JSON.parse(response.SecretString);
    
    if (!secret.apiKey || !secret.apiSecret) {
      throw new Error('Secret must contain apiKey and apiSecret fields');
    }
    
    console.log('Successfully retrieved credentials from Secrets Manager');
    return { apiKey: secret.apiKey, apiSecret: secret.apiSecret };
  }
  
  // Direct credentials mode
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('Missing credentials: provide SECRET_NAME or API_KEY/API_SECRET');
  }
  
  return { apiKey, apiSecret };
}

/**
 * POST to /ingest/upload-url endpoint.
 */
async function postUploadUrl({ apiBaseUrl, apiKey, apiSecret, payload }) {
  const url = `${apiBaseUrl}/ingest/upload-url`;
  const body = JSON.stringify(payload);
  
  const responseText = await httpRequest({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      'x-chaim-key': apiKey,
    },
    body,
    apiSecret,
  });
  
  return JSON.parse(responseText);
}

/**
 * PUT snapshot bytes to S3 presigned URL.
 */
async function uploadToS3(presignedUrl, snapshotBytes) {
  await httpRequest({
    method: 'PUT',
    url: presignedUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    body: snapshotBytes,
    // No HMAC signature for S3 presigned URL
  });
}

/**
 * POST to /ingest/snapshot-ref endpoint.
 */
async function postSnapshotRef({ apiBaseUrl, apiKey, apiSecret, payload }) {
  const url = `${apiBaseUrl}/ingest/snapshot-ref`;
  const body = JSON.stringify(payload);
  
  const responseText = await httpRequest({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      'x-chaim-key': apiKey,
    },
    body,
    apiSecret,
  });
  
  return JSON.parse(responseText);
}

/**
 * Make an HTTP/HTTPS request.
 * 
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method
 * @param {string} options.url - Full URL
 * @param {Object} options.headers - Request headers
 * @param {string} [options.body] - Request body
 * @param {string} [options.apiSecret] - API secret for HMAC signature
 * @returns {Promise<string>} Response body
 */
async function httpRequest({ method, url, headers, body, apiSecret }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const finalHeaders = { ...headers };
    
    // Add HMAC signature if apiSecret provided and body exists
    if (apiSecret && body) {
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(body)
        .digest('hex');
      finalHeaders['x-chaim-signature'] = signature;
    }
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: finalHeaders,
    };
    
    const protocol = parsedUrl.protocol === 'https:' ? https : require('http');
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    req.setTimeout(DEFAULT_REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

