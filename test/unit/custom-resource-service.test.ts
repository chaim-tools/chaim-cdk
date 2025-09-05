import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CustomResourceService } from '../../src/services/custom-resource-service';
import { ChaimBinderProps } from '../../src/types/chaim-binder-props';

// Mock CDK constructs
vi.mock('aws-cdk-lib/custom-resources', () => ({
  AwsCustomResource: vi.fn().mockImplementation((scope, id, props) => ({
    node: { id },
    grantPrincipal: {
      addToPrincipalPolicy: vi.fn(),
    },
  })),
  AwsCustomResourcePolicy: {
    fromSdkCalls: vi.fn(() => ({ resources: 'ANY_RESOURCE' })),
    ANY_RESOURCE: 'ANY_RESOURCE',
  },
  PhysicalResourceId: {
    of: vi.fn((id) => id),
  },
}));

vi.mock('aws-cdk-lib/aws-lambda', () => ({
  Function: vi.fn().mockImplementation((scope, id, props) => ({
    functionArn: `arn:aws:lambda:us-east-1:123456789012:function:${id}`,
    functionName: id,
  })),
}));

vi.mock('aws-cdk-lib/aws-iam', () => ({
  PolicyStatement: vi.fn().mockImplementation((props) => props),
  Effect: {
    ALLOW: 'Allow',
  },
}));

describe('CustomResourceService', () => {
  let mockScope: any;
  let mockProps: ChaimBinderProps;
  let mockHandler: lambda.Function;
  let enhancedDataStore: string;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockScope = {
      node: { id: 'TestScope' },
    };

    mockProps = {
      schemaPath: './schemas/user.bprint',
      table: {
        tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
        tableName: 'test-table',
      } as any,
    };

    mockHandler = {
      functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:TestHandler',
      functionName: 'TestHandler',
    } as lambda.Function;

    enhancedDataStore = JSON.stringify({
      schemaVersion: '1.0.0',
      namespace: 'user',
      description: 'User schema',
      entity: {
        primaryKey: { partitionKey: 'userId' },
        fields: [{ name: 'userId', type: 'string' }],
      },
    });
  });

  describe('createCustomResource', () => {
    it('should create custom resource for OSS mode', () => {
      const customResource = CustomResourceService.createCustomResource(
        mockScope,
        mockProps,
        mockHandler,
        enhancedDataStore
      );
      
      expect(customResource).toBeDefined();
      expect(cr.AwsCustomResource).toHaveBeenCalled();
    });

    it('should create custom resource for SaaS mode', () => {
      const saasProps: ChaimBinderProps = {
        ...mockProps,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app',
      };

      const customResource = CustomResourceService.createCustomResource(
        mockScope,
        saasProps,
        mockHandler,
        enhancedDataStore
      );
      
      expect(customResource).toBeDefined();
      expect(cr.AwsCustomResource).toHaveBeenCalled();
    });
  });

  describe('grantPermissions', () => {
    it('should grant permissions to custom resource', () => {
      const mockCustomResource = {
        grantPrincipal: {
          addToPrincipalPolicy: vi.fn(),
        },
      } as any;

      CustomResourceService.grantPermissions(mockCustomResource, mockHandler);
      
      expect(mockCustomResource.grantPrincipal.addToPrincipalPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          effect: 'Allow',
          actions: ['lambda:InvokeFunction'],
          resources: [mockHandler.functionArn],
        })
      );
    });
  });

  describe('isSaaSMode', () => {
    it('should return false when no API credentials provided', () => {
      const result = CustomResourceService['isSaaSMode'](mockProps);
      expect(result).toBe(false);
    });

    it('should return true when all API credentials provided', () => {
      const saasProps: ChaimBinderProps = {
        ...mockProps,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app',
      };

      const result = CustomResourceService['isSaaSMode'](saasProps);
      expect(result).toBe(true);
    });

    it('should return false when only some API credentials provided', () => {
      const partialProps: ChaimBinderProps = {
        ...mockProps,
        apiKey: 'test-api-key',
        // Missing apiSecret and appId
      };

      const result = CustomResourceService['isSaaSMode'](partialProps);
      expect(result).toBe(false);
    });
  });

  describe('createAction', () => {
    it('should create action for OSS mode', () => {
      const action = CustomResourceService['createAction'](
        'Create',
        mockHandler,
        mockProps,
        enhancedDataStore,
        false
      );
      
      expect(action).toEqual({
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: mockHandler.functionName,
          Payload: expect.stringContaining('RequestType'),
        },
        physicalResourceId: expect.any(String),
      });
    });

    it('should create action for SaaS mode', () => {
      const saasProps: ChaimBinderProps = {
        ...mockProps,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app',
      };

      const action = CustomResourceService['createAction'](
        'Create',
        mockHandler,
        saasProps,
        enhancedDataStore,
        true
      );
      
      expect(action).toEqual({
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: mockHandler.functionName,
          Payload: expect.stringContaining('RequestType'),
        },
        physicalResourceId: expect.any(String),
      });
    });

    it('should create action for Update request type', () => {
      const action = CustomResourceService['createAction'](
        'Update',
        mockHandler,
        mockProps,
        enhancedDataStore,
        false
      );
      
      expect(action.parameters.Payload).toContain('"RequestType":"Update"');
    });

    it('should create action for Delete request type', () => {
      const action = CustomResourceService['createAction'](
        'Delete',
        mockHandler,
        mockProps,
        enhancedDataStore,
        false
      );
      
      expect(action.parameters.Payload).toContain('"RequestType":"Delete"');
    });
  });
});
