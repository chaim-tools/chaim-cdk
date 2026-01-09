import { SchemaData } from '@chaim-tools/chaim-bprint-spec';
import { DataStoreMetadata } from './data-store-metadata';

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
 * Complete snapshot payload sent to Chaim SaaS ingestion API.
 * This is uploaded to S3 via presigned URL, then committed via snapshot-ref.
 */
export interface SnapshotPayload {
  /** Unique event ID (UUID v4) - one per deploy/publish */
  readonly eventId: string;

  /** Application ID from ChaimBinder props */
  readonly appId: string;

  /** Validated .bprint schema data */
  readonly schema: SchemaData;

  /** Data store metadata (DynamoDB, Aurora, etc.) */
  readonly dataStore: DataStoreMetadata;

  /** CDK stack context */
  readonly context: StackContext;

  /** ISO 8601 timestamp of snapshot creation */
  readonly timestamp: string;

  /** SHA-256 hash of the payload content */
  readonly contentHash: string;
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

