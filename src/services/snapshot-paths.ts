import * as fs from 'fs';
import * as path from 'path';

/**
 * Snapshot mode enum for distinguishing preview vs registered snapshots.
 */
export type SnapshotMode = 'preview' | 'registered';

/**
 * Default base directory for all Chaim snapshots.
 * Located within the CDK output directory.
 */
const DEFAULT_BASE_DIR = 'cdk.out/chaim/snapshots';

/**
 * Get the base snapshot directory path.
 * All snapshots (preview and registered) are stored under this directory.
 *
 * @returns Absolute path to the base snapshot directory
 */
export function getBaseSnapshotDir(): string {
  return path.join(process.cwd(), DEFAULT_BASE_DIR);
}

/**
 * Get the directory path for a specific snapshot mode.
 *
 * @param mode - 'preview' or 'registered'
 * @returns Absolute path to the mode-specific directory
 */
export function getModeDir(mode: SnapshotMode): string {
  return path.join(getBaseSnapshotDir(), mode);
}

/**
 * Get the full path for a preview snapshot file.
 * Preview snapshots are created during `cdk synth` and contain schema + metadata
 * without eventId/contentHash.
 *
 * @param stackName - The CDK stack name
 * @returns Absolute path to the preview snapshot file
 *
 * @example
 * getPreviewSnapshotPath('MyStack')
 * // -> '/path/to/project/cdk.out/chaim/snapshots/preview/MyStack.json'
 */
export function getPreviewSnapshotPath(stackName: string): string {
  return path.join(getModeDir('preview'), `${stackName}.json`);
}

/**
 * Get the full path for a registered snapshot file.
 * Registered snapshots are created during `cdk deploy` and include
 * eventId and contentHash for tracking.
 *
 * @param stackName - The CDK stack name
 * @param eventId - Unique event ID (UUID v4) for the deployment
 * @returns Absolute path to the registered snapshot file
 *
 * @example
 * getRegisteredSnapshotPath('MyStack', '550e8400-e29b-41d4-a716-446655440000')
 * // -> '/path/to/project/cdk.out/chaim/snapshots/registered/MyStack-550e8400-e29b-41d4-a716-446655440000.json'
 */
export function getRegisteredSnapshotPath(stackName: string, eventId: string): string {
  return path.join(getModeDir('registered'), `${stackName}-${eventId}.json`);
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 *
 * @param dir - Directory path to ensure exists
 */
export function ensureDirectoryExists(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Write a snapshot to the specified path, ensuring the directory exists.
 *
 * @param filePath - Full path to write the snapshot
 * @param snapshot - Snapshot payload object to serialize
 */
export function writeSnapshot(filePath: string, snapshot: object): void {
  const dir = path.dirname(filePath);
  ensureDirectoryExists(dir);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
}

/**
 * Write a preview snapshot for a stack.
 *
 * @param stackName - The CDK stack name
 * @param snapshot - Snapshot payload object
 * @returns The path where the snapshot was written
 */
export function writePreviewSnapshot(stackName: string, snapshot: object): string {
  const filePath = getPreviewSnapshotPath(stackName);
  writeSnapshot(filePath, snapshot);
  return filePath;
}

/**
 * Write a registered snapshot for a stack.
 *
 * @param stackName - The CDK stack name
 * @param eventId - Unique event ID for this deployment
 * @param snapshot - Snapshot payload object
 * @returns The path where the snapshot was written
 */
export function writeRegisteredSnapshot(
  stackName: string,
  eventId: string,
  snapshot: object
): string {
  const filePath = getRegisteredSnapshotPath(stackName, eventId);
  writeSnapshot(filePath, snapshot);
  return filePath;
}

