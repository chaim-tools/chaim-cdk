import { IChaimCredentials } from './credentials';
import { FailureMode } from './failure-mode';

/**
 * Base properties shared by all Chaim data store binders.
 *
 * All binders require Chaim SaaS credentials for ingestion.
 */
export interface BaseBinderProps {
  /** Path to the .bprint schema file (JSON format) */
  schemaPath: string;

  /** Application ID for Chaim SaaS platform */
  appId: string;

  /**
   * Chaim API credentials.
   *
   * Use `ChaimCredentials.fromSecretsManager()` for production deployments,
   * or `ChaimCredentials.fromApiKeys()` for development/testing.
   *
   * @example
   * ```typescript
   * // Secrets Manager (recommended)
   * credentials: ChaimCredentials.fromSecretsManager('chaim/api-credentials')
   *
   * // Direct API keys
   * credentials: ChaimCredentials.fromApiKeys(apiKey, apiSecret)
   * ```
   */
  credentials: IChaimCredentials;

  /**
   * Behavior when ingestion fails.
   * @default FailureMode.BEST_EFFORT
   */
  failureMode?: FailureMode;
}

/**
 * Validates that credentials are properly configured.
 */
export function validateCredentials(props: BaseBinderProps): void {
  if (!props.credentials) {
    throw new Error(
      'Chaim SaaS credentials required. Use ChaimCredentials.fromSecretsManager() or ChaimCredentials.fromApiKeys().'
    );
  }

  const { credentialType } = props.credentials;

  if (credentialType === 'secretsManager') {
    if (!props.credentials.secretName) {
      throw new Error('secretName is required for Secrets Manager credentials.');
    }
  } else if (credentialType === 'direct') {
    if (!props.credentials.apiKey || !props.credentials.apiSecret) {
      throw new Error('apiKey and apiSecret are required for direct credentials.');
    }
  } else {
    throw new Error(`Unknown credential type: ${credentialType}`);
  }
}
