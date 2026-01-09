import { describe, it, expect } from 'vitest';
import { validateCredentials, BaseBinderProps } from '../../src/types/base-binder-props';
import { ChaimCredentials } from '../../src/types/credentials';

describe('validateCredentials', () => {
  const baseProps = {
    schemaPath: './schemas/test.bprint',
    appId: 'test-app',
  };

  describe('direct credentials', () => {
    it('should accept valid direct credentials', () => {
      const props: BaseBinderProps = {
        ...baseProps,
        credentials: ChaimCredentials.fromApiKeys('test-key', 'test-secret'),
      };

      expect(() => validateCredentials(props)).not.toThrow();
    });
  });

  describe('Secrets Manager', () => {
    it('should accept valid Secrets Manager config', () => {
      const props: BaseBinderProps = {
        ...baseProps,
        credentials: ChaimCredentials.fromSecretsManager('chaim/credentials'),
      };

      expect(() => validateCredentials(props)).not.toThrow();
    });
  });

  describe('no credentials', () => {
    it('should reject no credentials at all', () => {
      const props = {
        ...baseProps,
      } as BaseBinderProps;

      expect(() => validateCredentials(props)).toThrow('Chaim SaaS credentials required');
    });
  });
});
