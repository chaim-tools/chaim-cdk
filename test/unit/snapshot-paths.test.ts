import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  getBaseSnapshotDir,
  getModeDir,
  getPreviewSnapshotPath,
  getRegisteredSnapshotPath,
  ensureDirectoryExists,
  writeSnapshot,
  writePreviewSnapshot,
  writeRegisteredSnapshot,
} from '../../src/services/snapshot-paths';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

describe('snapshot-paths', () => {
  const originalCwd = process.cwd();
  const mockCwd = '/mock/project';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBaseSnapshotDir', () => {
    it('should return the correct base directory path', () => {
      const result = getBaseSnapshotDir();
      expect(result).toBe(path.join(mockCwd, 'cdk.out', 'chaim', 'snapshots'));
    });

    it('should use process.cwd() as base', () => {
      const result = getBaseSnapshotDir();
      expect(result.startsWith(mockCwd)).toBe(true);
    });
  });

  describe('getModeDir', () => {
    it('should return preview directory path for preview mode', () => {
      const result = getModeDir('preview');
      expect(result).toBe(path.join(mockCwd, 'cdk.out', 'chaim', 'snapshots', 'preview'));
    });

    it('should return registered directory path for registered mode', () => {
      const result = getModeDir('registered');
      expect(result).toBe(path.join(mockCwd, 'cdk.out', 'chaim', 'snapshots', 'registered'));
    });
  });

  describe('getPreviewSnapshotPath', () => {
    it('should return correct path for a stack name', () => {
      const result = getPreviewSnapshotPath('MyStack');
      expect(result).toBe(
        path.join(mockCwd, 'cdk.out', 'chaim', 'snapshots', 'preview', 'MyStack.json')
      );
    });

    it('should handle stack names with special characters', () => {
      const result = getPreviewSnapshotPath('My-Stack-Name');
      expect(result).toBe(
        path.join(mockCwd, 'cdk.out', 'chaim', 'snapshots', 'preview', 'My-Stack-Name.json')
      );
    });
  });

  describe('getRegisteredSnapshotPath', () => {
    it('should return correct path with stack name and eventId', () => {
      const eventId = '550e8400-e29b-41d4-a716-446655440000';
      const result = getRegisteredSnapshotPath('MyStack', eventId);
      expect(result).toBe(
        path.join(
          mockCwd,
          'cdk.out',
          'chaim',
          'snapshots',
          'registered',
          `MyStack-${eventId}.json`
        )
      );
    });

    it('should combine stack name and eventId with hyphen', () => {
      const result = getRegisteredSnapshotPath('TestStack', 'abc-123');
      expect(result).toContain('TestStack-abc-123.json');
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory recursively', () => {
      const dir = '/test/path/to/dir';
      ensureDirectoryExists(dir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    });
  });

  describe('writeSnapshot', () => {
    it('should create directory and write file', () => {
      const filePath = '/test/path/snapshot.json';
      const snapshot = { foo: 'bar' };

      writeSnapshot(filePath, snapshot);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        filePath,
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );
    });

    it('should format JSON with 2-space indentation', () => {
      const filePath = '/test/snapshot.json';
      const snapshot = { nested: { value: 123 } };

      writeSnapshot(filePath, snapshot);

      const writtenContent = (fs.writeFileSync as any).mock.calls[0][1];
      expect(writtenContent).toBe(JSON.stringify(snapshot, null, 2));
    });
  });

  describe('writePreviewSnapshot', () => {
    it('should write to preview directory with stack name', () => {
      const snapshot = { snapshotMode: 'PREVIEW', appId: 'test' };

      const result = writePreviewSnapshot('MyStack', snapshot);

      expect(result).toBe(
        path.join(mockCwd, 'cdk.out', 'chaim', 'snapshots', 'preview', 'MyStack.json')
      );
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should return the path where snapshot was written', () => {
      const result = writePreviewSnapshot('TestStack', {});
      expect(result).toContain('preview');
      expect(result).toContain('TestStack.json');
    });
  });

  describe('writeRegisteredSnapshot', () => {
    it('should write to registered directory with stack name and eventId', () => {
      const eventId = 'abc-123-def';
      const snapshot = { snapshotMode: 'REGISTERED', eventId };

      const result = writeRegisteredSnapshot('MyStack', eventId, snapshot);

      expect(result).toBe(
        path.join(
          mockCwd,
          'cdk.out',
          'chaim',
          'snapshots',
          'registered',
          `MyStack-${eventId}.json`
        )
      );
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should return the path where snapshot was written', () => {
      const result = writeRegisteredSnapshot('TestStack', 'event-id', {});
      expect(result).toContain('registered');
      expect(result).toContain('TestStack-event-id.json');
    });
  });
});

