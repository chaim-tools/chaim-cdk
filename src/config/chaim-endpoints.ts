/**
 * Chaim API endpoint configuration.
 * 
 * This is the single source of truth for all Chaim API URLs.
 */

/**
 * Default Chaim API base URL.
 * Can be overridden via:
 * - CDK context: `chaimApiBaseUrl`
 * - Environment variable: `CHAIM_API_BASE_URL`
 */
export const DEFAULT_CHAIM_API_BASE_URL = 'https://api.chaim.co';

/**
 * Chaim ingestion API endpoints (relative paths).
 */
export const CHAIM_ENDPOINTS = {
  /** Request presigned S3 upload URL with HMAC authentication */
  PRESIGN: '/ingest/presign',
} as const;

/**
 * Default request timeout in milliseconds.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

/**
 * Default maximum snapshot size in bytes (10MB).
 */
export const DEFAULT_MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

/**
 * Current schema version for snapshot payloads.
 * Increment when making changes to LocalSnapshotPayload.
 * 
 * @see LocalSnapshotPayload.schemaVersion
 */
export const SNAPSHOT_SCHEMA_VERSION = '1.0' as const;
