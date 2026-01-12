import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

import { SchemaData } from '@chaim-tools/chaim-bprint-spec';
import { BaseBinderProps, validateCredentials } from '../types/base-binder-props';
import { DataStoreMetadata } from '../types/data-store-metadata';
import { LocalSnapshotPayload, StackContext } from '../types/snapshot-payload';
import { SchemaService } from '../services/schema-service';
import { FailureMode } from '../types/failure-mode';
import {
  DEFAULT_CHAIM_API_BASE_URL,
  DEFAULT_MAX_SNAPSHOT_BYTES,
} from '../config/chaim-endpoints';
import {
  normalizeAccountId,
  normalizeRegion,
  normalizeResourceName,
  getSnapshotDir,
  getLocalSnapshotPath,
  ensureDirExists,
} from '../services/os-cache-paths';

/**
 * Path to the canonical Lambda handler file.
 * This handler implements the presigned upload flow for Chaim ingestion.
 */
const LAMBDA_HANDLER_PATH = path.join(__dirname, '..', 'lambda-handler', 'handler.js');

/**
 * Abstract base class for all Chaim data store binders.
 *
 * Provides shared infrastructure:
 * - Schema loading and validation
 * - Snapshot payload construction
 * - LOCAL snapshot writing during CDK synth (to OS cache)
 * - Lambda-backed custom resource for S3 presigned upload + snapshot-ref
 *
 * Subclasses implement `extractMetadata()` for store-specific metadata extraction
 * and optionally override `getTable()` for DynamoDB-like resources.
 */
export abstract class BaseChaimBinder extends Construct {
  /** Validated schema data */
  public readonly schemaData: SchemaData;

  /** Extracted data store metadata */
  public readonly dataStoreMetadata: DataStoreMetadata;

  /** Generated resource ID ({resourceName}__{entityName}[__N]) */
  public readonly resourceId: string;

  /** Base props (credentials, appId, etc.) */
  protected readonly baseProps: BaseBinderProps;

  constructor(scope: Construct, id: string, props: BaseBinderProps) {
    super(scope, id);

    this.baseProps = props;

    // Validate credentials
    validateCredentials(props);

    // Load and validate schema
    this.schemaData = SchemaService.readSchema(props.schemaPath);

    // Extract data store metadata (implemented by subclass)
    this.dataStoreMetadata = this.extractMetadata();

    // Build stack context
    const stack = cdk.Stack.of(this);
    const stackName = stack.stackName;
    const datastoreType = this.dataStoreMetadata.type;

    // Get resource and entity names
    const resourceName = this.getResourceName();
    const entityName = this.getEntityName();

    // Generate resource ID
    this.resourceId = `${resourceName}__${entityName}`;

    // Normalize values for paths (handle CDK tokens)
    const normalizedAccountId = normalizeAccountId(stack.account);
    const normalizedRegion = normalizeRegion(stack.region);
    const normalizedResourceName = normalizeResourceName(resourceName);

    // Update resource ID with normalized name to avoid special characters
    const normalizedResourceId = `${normalizedResourceName}__${entityName}`;

    // Build LOCAL snapshot payload
    const localSnapshot = this.buildLocalSnapshot({
      accountId: normalizedAccountId,
      region: normalizedRegion,
      stackName,
      datastoreType,
      resourceName: normalizedResourceName,
      resourceId: normalizedResourceId,
    });

    // Write LOCAL snapshot to OS cache for chaim-cli consumption
    this.writeLocalSnapshotToDisk(localSnapshot);

    // Get or create asset directory
    const assetDir = this.writeSnapshotAsset(localSnapshot, stackName);

    // Deploy Lambda-backed custom resource for ingestion
    this.deployIngestionResources(assetDir);
  }

  /**
   * Abstract method - subclasses implement store-specific metadata extraction.
   */
  protected abstract extractMetadata(): DataStoreMetadata;

  /**
   * Override in subclasses to provide the table construct for stable identity.
   * Default returns undefined (will fall back to construct path).
   */
  protected getTable(): dynamodb.ITable | undefined {
    return undefined;
  }

  /**
   * Get the resource name for display and filenames.
   * For DynamoDB, this is the user label (not necessarily the physical table name).
   */
  private getResourceName(): string {
    const metadata = this.dataStoreMetadata as any;
    return metadata.tableName || metadata.name || 'resource';
  }

  /**
   * Get the entity name from schema.
   * Falls back to deriving from namespace if entity.name is not present.
   */
  private getEntityName(): string {
    const entity = this.schemaData.entity as any;
    if (entity?.name) {
      return entity.name;
    }
    // Fallback: derive from namespace
    const namespace = this.schemaData.namespace;
    const parts = namespace.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  }

  /**
   * Build the base snapshot context (shared across snapshots).
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
   * Build a LOCAL snapshot payload for CLI consumption.
   * Does not include eventId or contentHash - those are generated at deploy-time.
   */
  private buildLocalSnapshot(params: {
    accountId: string;
    region: string;
    stackName: string;
    datastoreType: string;
    resourceName: string;
    resourceId: string;
  }): LocalSnapshotPayload {
    const capturedAt = new Date().toISOString();

    return {
      provider: 'aws',
      accountId: params.accountId,
      region: params.region,
      stackName: params.stackName,
      datastoreType: params.datastoreType,
      resourceName: params.resourceName,
      resourceId: params.resourceId,
      appId: this.baseProps.appId,
      schema: this.schemaData,
      dataStore: this.dataStoreMetadata,
      context: this.buildStackContext(),
      capturedAt,
    };
  }

  /**
   * Write LOCAL snapshot to OS cache for chaim-cli consumption.
   * Uses hierarchical path: aws/{accountId}/{region}/{stackName}/{datastoreType}/{resourceId}.json
   * 
   * @param snapshot - The snapshot payload to write
   * @returns The path where snapshot was written
   */
  private writeLocalSnapshotToDisk(snapshot: LocalSnapshotPayload): string {
    const dir = getSnapshotDir({
      accountId: snapshot.accountId,
      region: snapshot.region,
      stackName: snapshot.stackName,
      datastoreType: snapshot.datastoreType,
    });
    
    ensureDirExists(dir);
    
    const filePath = getLocalSnapshotPath({
      accountId: snapshot.accountId,
      region: snapshot.region,
      stackName: snapshot.stackName,
      datastoreType: snapshot.datastoreType,
      resourceId: snapshot.resourceId,
    });
    
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    
    return filePath;
  }


  /**
   * Find the CDK project root by walking up from current module.
   */
  private findCdkProjectRoot(): string {
    let currentDir = __dirname;
    for (let i = 0; i < 10; i++) {
      const cdkJsonPath = path.join(currentDir, 'cdk.json');
      if (fs.existsSync(cdkJsonPath)) {
        return currentDir;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
    // Fallback to cwd
    return process.cwd();
  }

  /**
   * Write snapshot and Lambda handler to isolated CDK asset directory for Lambda bundling.
   * 
   * Asset directory is per {stackName}/{resourceId} and MUST NOT be shared.
   * The Lambda reads ./snapshot.json from its bundle, NOT from env vars or OS cache.
   * 
   * The handler is copied from the canonical handler file (src/lambda-handler/handler.js)
   * rather than being generated inline - this ensures a single source of truth.
   *
   * @returns The asset directory path
   */
  private writeSnapshotAsset(snapshot: LocalSnapshotPayload, stackName: string): string {
    const cdkRoot = this.findCdkProjectRoot();
    const assetDir = path.join(cdkRoot, 'cdk.out', 'chaim', 'assets', stackName, this.resourceId);
    ensureDirExists(assetDir);

    // Write snapshot.json (OVERWRITE each synth)
    const snapshotPath = path.join(assetDir, 'snapshot.json');
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    // Copy canonical Lambda handler (OVERWRITE each synth)
    const handlerDestPath = path.join(assetDir, 'index.js');
    fs.copyFileSync(LAMBDA_HANDLER_PATH, handlerDestPath);

    return assetDir;
  }

  /**
   * Deploy Lambda function and custom resource for ingestion.
   */
  private deployIngestionResources(assetDir: string): void {
    const handler = this.createIngestionLambda(assetDir);
    this.createCustomResource(handler);
  }

  /**
   * Create Lambda function for ingestion workflow.
   * Lambda reads snapshot from its bundled asset directory.
   */
  private createIngestionLambda(assetDir: string): lambda.Function {
    const handler = new lambda.Function(this, 'IngestionHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(assetDir),
      timeout: cdk.Duration.minutes(5),
      environment: this.buildLambdaEnvironment(),
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
   * Note: Snapshot is NOT passed via env - Lambda reads from bundled asset.
   */
  private buildLambdaEnvironment(): Record<string, string> {
    const { credentials } = this.baseProps;

    // Allow maintainer override via CDK context, otherwise use default
    const apiBaseUrl = this.node.tryGetContext('chaimApiBaseUrl') ?? DEFAULT_CHAIM_API_BASE_URL;

    const env: Record<string, string> = {
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
  private createCustomResource(handler: lambda.Function): void {
    const provider = new cr.Provider(this, 'IngestionProvider', {
      onEventHandler: handler,
    });

    // Use resource ID for physical resource ID (stable across deploys)
    new cdk.CustomResource(this, 'IngestionResource', {
      serviceToken: provider.serviceToken,
      properties: {
        ResourceId: this.resourceId,
        // ContentHash is computed at Lambda runtime
      },
    });
  }
}
