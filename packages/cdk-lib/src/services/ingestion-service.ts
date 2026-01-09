/**
 * Configuration for Chaim ingestion API.
 */
export interface IngestionConfig {
  /** Base URL for Chaim API */
  readonly baseUrl: string;

  /** Request timeout in milliseconds */
  readonly timeoutMs: number;

  /** Number of retry attempts */
  readonly retryAttempts: number;
}

/**
 * Default ingestion configuration.
 */
export const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
  baseUrl: 'https://api.chaim.dev',
  timeoutMs: 30000,
  retryAttempts: 3,
};

/**
 * Chaim ingestion API endpoints.
 */
export const INGESTION_ENDPOINTS = {
  /** Request presigned S3 upload URL */
  UPLOAD_URL: '/ingest/upload-url',

  /** Commit snapshot reference after S3 upload */
  SNAPSHOT_REF: '/ingest/snapshot-ref',
} as const;

/**
 * Request payload for upload-url endpoint.
 */
export interface UploadUrlRequest {
  appId: string;
  eventId: string;
  contentHash: string;
}

/**
 * Response from upload-url endpoint.
 */
export interface UploadUrlResponse {
  uploadUrl: string;
  expiresAt: string;
}

/**
 * Request payload for snapshot-ref endpoint.
 */
export interface SnapshotRefRequest {
  appId: string;
  eventId: string;
  contentHash: string;
  dataStoreType: string;
  dataStoreArn: string;
}

/**
 * Response from snapshot-ref endpoint.
 */
export interface SnapshotRefResponse {
  eventId: string;
  status: 'SUCCESS' | 'FAILED';
  processedAt: string;
  errorMessage?: string;
}

/**
 * IngestionService provides utilities for Chaim SaaS ingestion.
 * 
 * The actual HTTP requests are made by the Lambda handler at runtime.
 * This service provides compile-time types and configuration.
 */
export class IngestionService {
  /**
   * Get ingestion configuration from environment or defaults.
   */
  static getConfig(): IngestionConfig {
    return {
      baseUrl: process.env.CHAIM_API_URL || DEFAULT_INGESTION_CONFIG.baseUrl,
      timeoutMs: parseInt(process.env.CHAIM_API_TIMEOUT || String(DEFAULT_INGESTION_CONFIG.timeoutMs)),
      retryAttempts: parseInt(process.env.CHAIM_RETRY_ATTEMPTS || String(DEFAULT_INGESTION_CONFIG.retryAttempts)),
    };
  }

  /**
   * Build full URL for an ingestion endpoint.
   */
  static buildUrl(endpoint: keyof typeof INGESTION_ENDPOINTS, baseUrl?: string): string {
    const base = baseUrl || DEFAULT_INGESTION_CONFIG.baseUrl;
    return base + INGESTION_ENDPOINTS[endpoint];
  }

  /**
   * Compute HMAC-SHA256 signature for request body.
   */
  static computeSignature(body: string, secret: string): string {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }
}

