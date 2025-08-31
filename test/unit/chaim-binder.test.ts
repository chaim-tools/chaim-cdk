import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimBinder } from '../../src/chaim-binder';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('ChaimBinder', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let userTable: dynamodb.Table;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    
    // Create a test DynamoDB table
    userTable = new dynamodb.Table(stack, 'UserTable', {
      tableName: 'users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should create the construct with required props', () => {
    // Mock schema file content
    const mockSchemaContent = JSON.stringify({
      chaim_version: 1,
      model_name: 'User',
      fields: [
        {
          name: 'id',
          type: 'string',
          required: true,
          partition_key: true,
        },
      ],
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(mockSchemaContent);

    // Create the construct
    new ChaimBinder(stack, 'TestChaimBinder', {
      schemaPath: './test-schema.json',
      table: userTable,
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      appId: 'test-app-id',
    });

    // Assert the template
    const template = Template.fromStack(stack);
    
    // Should create a Lambda function
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      Handler: 'index.handler',
      Timeout: 300,
    });

    // Should create a custom resource
    template.hasResource('Custom::AWS', {});
  });

  it('should throw error when schema file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    expect(() => {
      new ChaimBinder(stack, 'TestChaimBinder', {
        schemaPath: './non-existent-schema.json',
        table: userTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      });
    }).toThrow('Schema file not found: ./non-existent-schema.json');
  });

  it('should throw error when schema file has invalid JSON', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('invalid json content');

    expect(() => {
      new ChaimBinder(stack, 'TestChaimBinder', {
        schemaPath: './invalid-schema.json',
        table: userTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      });
    }).toThrow('Invalid JSON format in schema file:');
  });

  it('should throw error when schema is missing required fields', () => {
    const mockSchemaContent = JSON.stringify({
      chaim_version: 1,
      // Missing model_name and fields
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(mockSchemaContent);

    expect(() => {
      new ChaimBinder(stack, 'TestChaimBinder', {
        schemaPath: './incomplete-schema.json',
        table: userTable,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        appId: 'test-app-id',
      });
    }).toThrow('Schema must contain required field: model_name');
  });

  it('should use default API URL', () => {
    const mockSchemaContent = JSON.stringify({
      chaim_version: 1,
      model_name: 'User',
      fields: [
        {
          name: 'id',
          type: 'string',
          required: true,
          partition_key: true,
        },
      ],
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(mockSchemaContent);

    new ChaimBinder(stack, 'TestChaimBinder', {
      schemaPath: './test-schema.json',
      table: userTable,
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      appId: 'test-app-id',
    });

    const template = Template.fromStack(stack);
    
    // Check that Lambda function has the default API URL
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          API_URL: 'https://api.chaim.co',
        },
      },
    });
  });

  it('should include table metadata in the enhanced data store', () => {
    const mockSchemaContent = JSON.stringify({
      chaim_version: 1,
      model_name: 'User',
      fields: [
        {
          name: 'id',
          type: 'string',
          required: true,
          partition_key: true,
        },
      ],
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(mockSchemaContent);

    new ChaimBinder(stack, 'TestChaimBinder', {
      schemaPath: './test-schema.json',
      table: userTable,
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      appId: 'test-app-id',
    });

    const template = Template.fromStack(stack);
    
    // Check that Lambda function has the enhanced data store environment variable
    // Use a more specific approach to find our Lambda function
    const lambdaFunctions = template.findResources('AWS::Lambda::Function');
    const ourLambdaFunction = Object.values(lambdaFunctions).find(
      (resource: any) => 
        resource.Properties?.Environment?.Variables?.ENHANCED_DATA_STORE &&
        resource.Properties.Environment.Variables.API_URL === 'https://api.chaim.co'
    );
    
    expect(ourLambdaFunction).toBeDefined();
    expect(ourLambdaFunction?.Properties.Environment.Variables.ENHANCED_DATA_STORE).toHaveProperty('Fn::Join');
  });
});
