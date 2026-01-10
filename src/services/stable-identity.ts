import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as fs from 'fs';
import * as path from 'path';
import { Construct } from 'constructs';

/**
 * Stable identity for collision detection.
 * Uses synth-stable fields only (no tokens).
 */
export interface StableIdentity {
  /** Application ID (user input, always stable) */
  readonly appId: string;
  /** CDK stack name */
  readonly stackName: string;
  /** Data store type (e.g., 'dynamodb') */
  readonly datastoreType: string;
  /** Entity name from schema */
  readonly entityName: string;
  /** Best available stable resource key */
  readonly stableResourceKey: string;
}

/**
 * Check if a value looks like a CDK token (unresolved at synth-time).
 * 
 * This is ONLY used for CDK-resolved values (account/region, tableName, logicalId),
 * NOT for user inputs (resourceName, entityName, appId).
 */
export function isToken(value: string | undefined): boolean {
  if (!value) return true;
  return value.includes('${Token') || value.includes('${AWS::');
}

/**
 * Get the best available stable resource key for collision detection.
 * 
 * Preference chain:
 * 1. Physical table name (if not a token) => `tableName:<name>`
 * 2. CloudFormation logical ID (via correct CDK API) => `logicalId:<id>`
 * 3. Construct path (always available) => `path:<path>`
 * 
 * Note: resourceName is display-only; do not use as physical identity.
 * logicalId/physicalName may be unavailable; fallback to constructPath.
 */
export function getStableResourceKey(
  table: dynamodb.ITable,
  construct: Construct
): string {
  // 1. Prefer physical table name (actual DynamoDB table name, not user label)
  try {
    const tableName = table.tableName;
    if (tableName && !isToken(tableName)) {
      return `tableName:${tableName}`;
    }
  } catch {
    // tableName may not be accessible
  }
  
  // 2. Prefer CloudFormation logical ID (using correct CDK API)
  try {
    const stack = cdk.Stack.of(construct);
    const cfn = table.node.defaultChild as cdk.CfnResource | undefined;
    if (cfn) {
      const logicalId = stack.getLogicalId(cfn);
      if (logicalId && !isToken(logicalId)) {
        return `logicalId:${logicalId}`;
      }
    }
  } catch {
    // logicalId may not be available for imported tables
  }
  
  // 3. Fallback to construct path (always available)
  return `path:${construct.node.path}`;
}

/**
 * Build a match key string from stable identity fields.
 * Used for collision detection.
 */
export function buildMatchKey(identity: StableIdentity): string {
  return `${identity.appId}:${identity.stackName}:${identity.datastoreType}:${identity.entityName}:${identity.stableResourceKey}`;
}

/**
 * Parameters for generating a resource ID.
 */
export interface GenerateResourceIdParams {
  /** User-provided display label for filename */
  resourceName: string;
  /** Entity name from schema */
  entityName: string;
  /** Stable identity for collision matching */
  identity: StableIdentity;
}

/**
 * Generate a unique resource ID with collision handling.
 * 
 * Filename format: {resourceName}__{entityName}[__N]
 * 
 * Collision behavior:
 * - If file doesn't exist: use base ID
 * - If file exists with same identity: overwrite (return same ID)
 * - If file exists with different identity: allocate suffix __2, __3, etc.
 * - If existing snapshot lacks identity fields: treat as non-match (safer)
 */
export function generateResourceId(
  params: GenerateResourceIdParams,
  cacheDir: string
): string {
  const { resourceName, entityName, identity } = params;
  const baseId = `${resourceName}__${entityName}`;
  const matchKey = buildMatchKey(identity);
  
  let candidateId = baseId;
  let suffix = 1;
  
  while (true) {
    const filePath = path.join(cacheDir, `${candidateId}.json`);
    
    // No collision - use this ID
    if (!fs.existsSync(filePath)) {
      return candidateId;
    }
    
    // File exists - check if it's the same resource
    try {
      const existingContent = fs.readFileSync(filePath, 'utf-8');
      const existing = JSON.parse(existingContent);
      
      // If existing snapshot lacks identity, treat as non-match (never overwrite)
      if (!existing.identity || !existing.identity.stableResourceKey) {
        suffix++;
        candidateId = `${baseId}__${suffix}`;
        continue;
      }
      
      const existingKey = buildMatchKey(existing.identity);
      
      if (existingKey === matchKey) {
        return candidateId; // Same resource, overwrite
      }
    } catch {
      // If we can't read/parse existing file, treat as non-match
    }
    
    // Different resource or error - allocate suffix
    suffix++;
    candidateId = `${baseId}__${suffix}`;
  }
}

