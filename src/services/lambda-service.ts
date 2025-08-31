import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ChaimBinderProps } from '../types/chaim-binder-props';

export interface LambdaEnvironment {
  [key: string]: string;
  API_URL: string;
  API_KEY: string;
  API_SECRET: string;
  APP_ID: string;
  ENHANCED_DATA_STORE: string;
}

export class LambdaService {
  /**
   * Creates a Lambda function for the Chaim binder custom resource
   */
  public static createHandler(
    scope: Construct,
    props: ChaimBinderProps,
    enhancedDataStore: string
  ): lambda.Function {
    const handler = new lambda.Function(scope, 'ChaimBinderHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.getHandlerCode()),
      timeout: cdk.Duration.minutes(5),
      environment: this.createEnvironment(props, enhancedDataStore),
    });

    this.addLoggingPermissions(handler);
    return handler;
  }

  private static createEnvironment(props: ChaimBinderProps, enhancedDataStore: string): LambdaEnvironment {
    return {
      API_URL: 'https://api.chaim.co',
      API_KEY: props.apiKey,
      API_SECRET: props.apiSecret,
      APP_ID: props.appId,
      ENHANCED_DATA_STORE: enhancedDataStore,
    };
  }

  private static addLoggingPermissions(handler: lambda.Function): void {
    handler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['*'],
    }));
  }

  private static getHandlerCode(): string {
    // Read the handler code from the external file
    const fs = require('fs');
    const path = require('path');
    const handlerPath = path.join(__dirname, '../lambda-handler/index.ts');
    
    try {
      return fs.readFileSync(handlerPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read Lambda handler code from ${handlerPath}: ${error}`);
    }
  }
}
