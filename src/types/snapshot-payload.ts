import { SchemaData } from '@chaim-tools/chaim-bprint-spec';
import { DataStoreMetadata } from './data-store-metadata';
import { StableIdentity } from '../services/stable-identity';

/**
 * Stack context captured during CDK synthesis.
 */
export interface StackContext {
  /** AWS account ID */
  readonly account: string;

  /** AWS region */
  readonly region: string;

  /** CloudFormation stack ID */
  readonly stackId: string;

  /** CloudFormation stack name */
  readonly stackName: string;
}

/**
 * LOCAL snapshot payload written to OS cache during synthesis.
 * 
 * This is the primary snapshot type used for CLI code generation.
 * Written at synth-time (runs for both `cdk synth` and `cdk deploy`).
 * 
 * Note: Does NOT contain eventId or contentHash - those are generated
 * at deploy-time by the Lambda handler.
 */
export interface LocalSnapshotPayload {
  /** Cloud provider */
  readonly provider: 'aws';

  /** AWS account ID (may be 'unknown' if unresolved at synth) */
  readonly accountId: string;

  /** AWS region (may be 'unknown' if unresolved at synth) */
  readonly region: string;

  /** CDK stack name */
  readonly stackName: string;

  /** Data store type (e.g., 'dynamodb') */
  readonly datastoreType: string;

  /** User-provided display label for the resource */
  readonly resourceName: string;

  /** Generated resource ID: {resourceName}__{entityName}[__N] */
  readonly resourceId: string;

  /** Stable identity for collision detection */
  readonly identity: StableIdentity;

  /** Application ID from ChaimBinder props */
  readonly appId: string;

  /** Validated .bprint schema data */
  readonly schema: SchemaData;

  /** Data store metadata (DynamoDB, Aurora, etc.) */
  readonly dataStore: DataStoreMetadata;

  /** CDK stack context */
  readonly context: StackContext;

  /** ISO 8601 timestamp of snapshot creation */
  readonly capturedAt: string;
}

/**
 * Response from Chaim ingestion API after snapshot-ref commit.
 */
export interface IngestResponse {
  /** Event ID echoed back */
  readonly eventId: string;

  /** Ingestion status */
  readonly status: 'SUCCESS' | 'FAILED';

  /** Error message (if failed) */
  readonly errorMessage?: string;

  /** Timestamp when ingestion was processed */
  readonly processedAt: string;
}

/**
 * CloudFormation custom resource response data.
 * Kept minimal - actual payload is in S3.
 */
export interface CustomResourceResponseData {
  /** Event ID for tracking */
  readonly EventId: string;

  /** Ingestion status */
  readonly IngestStatus: 'SUCCESS' | 'FAILED';

  /** Content hash for change detection */
  readonly ContentHash: string;

  /** Timestamp */
  readonly Timestamp: string;
}
