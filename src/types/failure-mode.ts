/**
 * Behavior when schema ingestion fails during deployment.
 */
export enum FailureMode {
  /**
   * Log errors but return SUCCESS to CloudFormation.
   * Deployment continues even if ingestion fails.
   * This is the default.
   */
  BEST_EFFORT = 'BEST_EFFORT',

  /**
   * Return FAILED to CloudFormation on any ingestion error.
   * WARNING: Deployment will roll back if ingestion fails.
   */
  STRICT = 'STRICT',
}

