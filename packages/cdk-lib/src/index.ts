// Main construct exports
export { ChaimDynamoDBBinder, ChaimDynamoDBBinderProps } from './binders/chaim-dynamodb-binder';

// Base class export (for extension by future data store binders)
export { BaseChaimBinder } from './binders/base-chaim-binder';

// Credentials factory
export {
  ChaimCredentials,
  IChaimCredentials,
} from './types/credentials';

// Failure mode enum
export { FailureMode } from './types/failure-mode';

// Type exports
export {
  BaseBinderProps,
  validateCredentials,
} from './types/base-binder-props';

export {
  BaseDataStoreMetadata,
  DynamoDBMetadata,
  GSIMetadata,
  LSIMetadata,
  DataStoreMetadata,
} from './types/data-store-metadata';

// Snapshot payload types
export {
  LocalSnapshotPayload,
  StackContext,
  IngestResponse,
  CustomResourceResponseData,
} from './types/snapshot-payload';

// Ingest contract types
export {
  SnapshotAction,
  UploadUrlRequest,
  UploadUrlResponse,
  SnapshotRefUpsertRequest,
  SnapshotRefDeleteRequest,
  SnapshotRefRequest,
  SnapshotRefResponse,
  CloudFormationRequestType,
} from './types/ingest-contract';

// Config exports
export {
  DEFAULT_CHAIM_API_BASE_URL,
  CHAIM_ENDPOINTS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_SNAPSHOT_BYTES,
} from './config/chaim-endpoints';

// Service exports
export { SchemaService } from './services/schema-service';
export {
  IngestionService,
  IngestionConfig,
  INGESTION_ENDPOINTS,
  DEFAULT_INGESTION_CONFIG,
} from './services/ingestion-service';

// Re-export schema types from bprint-spec for convenience
export { SchemaData, Entity, Field, PrimaryKey } from '@chaim-tools/chaim-bprint-spec';
