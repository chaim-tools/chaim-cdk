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

export {
  SnapshotPayload,
  StackContext,
  IngestResponse,
  CustomResourceResponseData,
} from './types/snapshot-payload';

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
