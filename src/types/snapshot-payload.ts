import { SchemaData } from '@chaim-tools/chaim-bprint-spec';
import { DataStoreMetadata } from './data-store-metadata';

/**
 * Snapshot mode distinguishes between preview (synth-time) and registered (deploy-time) snapshots.
 */
export type SnapshotMode = 'PREVIEW' | 'REGISTERED';

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
 * Base snapshot payload containing fields common to both preview and registered snapshots.
 */
export interface BaseSnapshotPayload {
  /** Snapshot mode: PREVIEW (synth) or REGISTERED (deploy) */
  readonly snapshotMode: SnapshotMode;

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

  /**
   * @deprecated Use capturedAt instead. Kept for backwards compatibility.
   */
  readonly timestamp?: string;
}

/**
 * Preview snapshot payload created during `cdk synth`.
 * Does not include eventId or contentHash as no deployment has occurred.
 */
export interface PreviewSnapshotPayload extends BaseSnapshotPayload {
  readonly snapshotMode: 'PREVIEW';
}

/**
 * Registered snapshot payload created during `cdk deploy`.
 * Includes eventId and contentHash for tracking and idempotency.
 */
export interface RegisteredSnapshotPayload extends BaseSnapshotPayload {
  readonly snapshotMode: 'REGISTERED';

  /** Unique event ID (UUID v4) - one per deploy/publish */
  readonly eventId: string;

  /** SHA-256 hash of the payload content */
  readonly contentHash: string;
}

/**
 * Complete snapshot payload - union of preview and registered types.
 * This is the main type used throughout the codebase.
 */
export type SnapshotPayload = PreviewSnapshotPayload | RegisteredSnapshotPayload;

/**
 * Legacy snapshot payload interface for backwards compatibility.
 * @deprecated Use SnapshotPayload union type instead.
 */
export interface LegacySnapshotPayload {
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

/**
 * Type guard to check if a snapshot is a preview snapshot.
 */
export function isPreviewSnapshot(snapshot: SnapshotPayload): snapshot is PreviewSnapshotPayload {
  return snapshot.snapshotMode === 'PREVIEW';
}

/**
 * Type guard to check if a snapshot is a registered snapshot.
 */
export function isRegisteredSnapshot(snapshot: SnapshotPayload): snapshot is RegisteredSnapshotPayload {
  return snapshot.snapshotMode === 'REGISTERED';
}
