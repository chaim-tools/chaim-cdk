import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as crypto from 'crypto';

import { SchemaData } from '@chaim-tools/chaim-bprint-spec';
import { BaseBinderProps, validateCredentials } from '../types/base-binder-props';
import { DataStoreMetadata } from '../types/data-store-metadata';
import {
  PreviewSnapshotPayload,
  RegisteredSnapshotPayload,
  StackContext,
} from '../types/snapshot-payload';
import { SchemaService } from '../services/schema-service';
import { FailureMode } from '../types/failure-mode';
import { writePreviewSnapshot } from '../services/snapshot-paths';

/** Default API endpoint - can be overridden via CDK context for maintainers */
const DEFAULT_API_BASE_URL = 'https://ingest.chaim.co';

/** Default max snapshot size (10MB) - internal guardrail */
const DEFAULT_MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

/**
 * Abstract base class for all Chaim data store binders.
 *
 * Provides shared infrastructure:
 * - Schema loading and validation
 * - Snapshot payload construction
 * - Preview snapshot writing during CDK synth
 * - Lambda-backed custom resource for S3 presigned upload + snapshot-ref
 *
 * Subclasses implement `extractMetadata()` for store-specific metadata extraction.
 */
export abstract class BaseChaimBinder extends Construct {
  /** Validated schema data */
  public readonly schemaData: SchemaData;

  /** Extracted data store metadata */
  public readonly dataStoreMetadata: DataStoreMetadata;

  /** Unique event ID for this deployment */
  public readonly eventId: string;

  /** Path to the preview snapshot file written during synth */
  public readonly previewSnapshotPath: string;

  /** Base props (credentials, appId, etc.) */
  protected readonly baseProps: BaseBinderProps;

  constructor(scope: Construct, id: string, props: BaseBinderProps) {
    super(scope, id);

    this.baseProps = props;

    // Validate credentials
    validateCredentials(props);

    // Generate unique event ID
    this.eventId = crypto.randomUUID();

    // Load and validate schema
    this.schemaData = SchemaService.readSchema(props.schemaPath);

    // Extract data store metadata (implemented by subclass)
    this.dataStoreMetadata = this.extractMetadata();

    // Build and write preview snapshot (during CDK synth)
    const previewSnapshot = this.buildPreviewSnapshot();
    this.previewSnapshotPath = this.writePreviewSnapshotToDisk(previewSnapshot);

    // Build registered snapshot for deploy-time ingestion
    const registeredSnapshot = this.buildRegisteredSnapshot();

    // Deploy Lambda-backed custom resource for ingestion
    this.deployIngestionResources(registeredSnapshot);
  }

  /**
   * Abstract method - subclasses implement store-specific metadata extraction.
   */
  protected abstract extractMetadata(): DataStoreMetadata;

  /**
   * Build the base snapshot context (shared between preview and registered).
   */
  private buildStackContext(): StackContext {
    const stack = cdk.Stack.of(this);
    return {
      account: stack.account,
      region: stack.region,
      stackId: stack.stackId,
      stackName: stack.stackName,
    };
  }

  /**
   * Build a preview snapshot payload for CDK synth.
   * Does not include eventId or contentHash.
   */
  private buildPreviewSnapshot(): PreviewSnapshotPayload {
    const capturedAt = new Date().toISOString();

    return {
      snapshotMode: 'PREVIEW',
      appId: this.baseProps.appId,
      schema: this.schemaData,
      dataStore: this.dataStoreMetadata,
      context: this.buildStackContext(),
      capturedAt,
      timestamp: capturedAt, // For backwards compatibility
    };
  }

  /**
   * Build a registered snapshot payload for deploy-time ingestion.
   * Includes eventId and contentHash.
   */
  private buildRegisteredSnapshot(): RegisteredSnapshotPayload {
    const capturedAt = new Date().toISOString();

    const payloadWithoutHash = {
      snapshotMode: 'REGISTERED' as const,
      eventId: this.eventId,
      appId: this.baseProps.appId,
      schema: this.schemaData,
      dataStore: this.dataStoreMetadata,
      context: this.buildStackContext(),
      capturedAt,
      timestamp: capturedAt, // For backwards compatibility
    };

    // Compute content hash
    const contentHash = this.computeContentHash(payloadWithoutHash);

    return {
      ...payloadWithoutHash,
      contentHash,
    };
  }

  /**
   * Write the preview snapshot to disk during CDK synth.
   * @returns The path where the snapshot was written
   */
  private writePreviewSnapshotToDisk(snapshot: PreviewSnapshotPayload): string {
    const stack = cdk.Stack.of(this);
    return writePreviewSnapshot(stack.stackName, snapshot);
  }

  /**
   * Compute SHA-256 hash of payload content.
   */
  private computeContentHash(payload: object): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(payload));
    return 'sha256:' + hash.digest('hex');
  }

  /**
   * Deploy Lambda function and custom resource for ingestion.
   */
  private deployIngestionResources(snapshot: RegisteredSnapshotPayload): void {
    const handler = this.createIngestionLambda(snapshot);
    this.createCustomResource(handler, snapshot);
  }

  /**
   * Create Lambda function for ingestion workflow.
   */
  private createIngestionLambda(snapshot: RegisteredSnapshotPayload): lambda.Function {
    const handler = new lambda.Function(this, 'IngestionHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.getIngestionHandlerCode()),
      timeout: cdk.Duration.minutes(5),
      environment: this.buildLambdaEnvironment(snapshot),
    });

    // Grant CloudWatch Logs permissions
    handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      })
    );

    // Grant Secrets Manager permissions if using secrets
    const { credentials } = this.baseProps;
    if (credentials.credentialType === 'secretsManager' && credentials.secretName) {
      handler.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['secretsmanager:GetSecretValue'],
          resources: [`arn:aws:secretsmanager:*:*:secret:${credentials.secretName}*`],
        })
      );
    }

    return handler;
  }

  /**
   * Build Lambda environment variables.
   */
  private buildLambdaEnvironment(snapshot: RegisteredSnapshotPayload): Record<string, string> {
    const { credentials } = this.baseProps;

    // Allow maintainer override via CDK context, otherwise use default
    const apiBaseUrl = this.node.tryGetContext('chaimApiBaseUrl') ?? DEFAULT_API_BASE_URL;

    const env: Record<string, string> = {
      SNAPSHOT_PAYLOAD: JSON.stringify(snapshot),
      APP_ID: this.baseProps.appId,
      FAILURE_MODE: this.baseProps.failureMode ?? FailureMode.BEST_EFFORT,
      CHAIM_API_BASE_URL: apiBaseUrl,
      CHAIM_MAX_SNAPSHOT_BYTES: String(DEFAULT_MAX_SNAPSHOT_BYTES),
    };

    if (credentials.credentialType === 'secretsManager') {
      env.SECRET_NAME = credentials.secretName!;
    } else {
      env.API_KEY = credentials.apiKey!;
      env.API_SECRET = credentials.apiSecret!;
    }

    return env;
  }

  /**
   * Create CloudFormation custom resource.
   */
  private createCustomResource(handler: lambda.Function, snapshot: RegisteredSnapshotPayload): void {
    const provider = new cr.Provider(this, 'IngestionProvider', {
      onEventHandler: handler,
    });

    new cdk.CustomResource(this, 'IngestionResource', {
      serviceToken: provider.serviceToken,
      properties: {
        EventId: this.eventId,
        ContentHash: snapshot.contentHash,
        Timestamp: snapshot.capturedAt,
      },
    });
  }

  /**
   * Inline Lambda handler code for ingestion.
   * Handles: presigned URL request → S3 upload → snapshot-ref commit
   */
  private getIngestionHandlerCode(): string {
    return `
const https = require('https');
const { URL } = require('url');

exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const requestType = event.RequestType;
  const failureMode = process.env.FAILURE_MODE || 'BEST_EFFORT';
  const apiBaseUrl = process.env.CHAIM_API_BASE_URL || 'https://ingest.chaim.co';
  const maxSnapshotBytes = parseInt(process.env.CHAIM_MAX_SNAPSHOT_BYTES || '10485760');
  const snapshotPayload = JSON.parse(process.env.SNAPSHOT_PAYLOAD);
  
  try {
    let apiKey, apiSecret;
    
    // Get credentials - check if SECRET_NAME is set for Secrets Manager mode
    if (process.env.SECRET_NAME) {
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const client = new SecretsManagerClient();
      const response = await client.send(new GetSecretValueCommand({
        SecretId: process.env.SECRET_NAME,
      }));
      const secret = JSON.parse(response.SecretString);
      apiKey = secret.apiKey;
      apiSecret = secret.apiSecret;
    } else {
      apiKey = process.env.API_KEY;
      apiSecret = process.env.API_SECRET;
    }
    
    if (requestType === 'Delete') {
      console.log('Delete request - no action needed');
      return {
        PhysicalResourceId: snapshotPayload.eventId,
        Data: {
          EventId: snapshotPayload.eventId,
          IngestStatus: 'SUCCESS',
          ContentHash: snapshotPayload.contentHash,
          Timestamp: snapshotPayload.capturedAt || snapshotPayload.timestamp,
        },
      };
    }
    
    // For Create/Update: Execute ingestion workflow
    console.log('Executing ingestion workflow...');
    
    // Check snapshot size against guardrail
    const snapshotBytes = JSON.stringify(snapshotPayload);
    if (snapshotBytes.length > maxSnapshotBytes) {
      throw new Error(\`Snapshot size (\${snapshotBytes.length} bytes) exceeds maximum allowed (\${maxSnapshotBytes} bytes)\`);
    }
    
    // Step 1: Request presigned upload URL
    const uploadUrlResponse = await httpRequest({
      method: 'POST',
      url: apiBaseUrl + '/ingest/upload-url',
      headers: {
        'Content-Type': 'application/json',
        'x-chaim-key': apiKey,
      },
      body: JSON.stringify({
        appId: snapshotPayload.appId,
        eventId: snapshotPayload.eventId,
        contentHash: snapshotPayload.contentHash,
      }),
      apiSecret,
    });
    
    const { uploadUrl } = JSON.parse(uploadUrlResponse);
    console.log('Got presigned URL');
    
    // Step 2: Upload snapshot to S3
    await httpRequest({
      method: 'PUT',
      url: uploadUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      body: snapshotBytes,
    });
    console.log('Uploaded snapshot to S3');
    
    // Step 3: Commit snapshot reference
    const commitResponse = await httpRequest({
      method: 'POST',
      url: apiBaseUrl + '/ingest/snapshot-ref',
      headers: {
        'Content-Type': 'application/json',
        'x-chaim-key': apiKey,
      },
      body: JSON.stringify({
        appId: snapshotPayload.appId,
        eventId: snapshotPayload.eventId,
        contentHash: snapshotPayload.contentHash,
        dataStoreType: snapshotPayload.dataStore.type,
        dataStoreArn: snapshotPayload.dataStore.arn,
      }),
      apiSecret,
    });
    
    console.log('Committed snapshot reference');
    
    return {
      PhysicalResourceId: snapshotPayload.eventId,
      Data: {
        EventId: snapshotPayload.eventId,
        IngestStatus: 'SUCCESS',
        ContentHash: snapshotPayload.contentHash,
        Timestamp: snapshotPayload.capturedAt || snapshotPayload.timestamp,
      },
    };
    
  } catch (error) {
    console.error('Ingestion error:', error);
    
    if (failureMode === 'STRICT') {
      throw error;
    }
    
    // BEST_EFFORT: Return success to CloudFormation but log the error
    return {
      PhysicalResourceId: snapshotPayload.eventId,
      Data: {
        EventId: snapshotPayload.eventId,
        IngestStatus: 'FAILED',
        ContentHash: snapshotPayload.contentHash,
        Timestamp: snapshotPayload.capturedAt || snapshotPayload.timestamp,
        Error: error.message,
      },
    };
  }
};

async function httpRequest({ method, url, headers, body, apiSecret }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const finalHeaders = { ...headers };
    
    // Add HMAC signature if apiSecret provided
    if (apiSecret && body) {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(body)
        .digest('hex');
      finalHeaders['x-chaim-signature'] = signature;
    }
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: finalHeaders,
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(\`HTTP \${res.statusCode}: \${data}\`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (body) {
      req.write(body);
    }
    req.end();
  });
}
`;
  }
}
