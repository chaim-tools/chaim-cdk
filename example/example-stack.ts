#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimBinder } from '../src/chaim-binder';

export class ExampleStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB tables
    const userTable = new dynamodb.Table(this, 'UserTable', {
      tableName: 'users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const orderTable = new dynamodb.Table(this, 'OrderTable', {
      tableName: 'orders',
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Example 1: OSS Mode (No API credentials required)
    // This will only create CloudFormation outputs - no Lambda or custom resources
    new ChaimBinder(this, 'UserSchemaOSS', {
      schemaPath: './schemas/user.bprint',
      table: userTable,
      // No API credentials - works out of the box!
      // Creates outputs that chaim-cli can consume
    });

    // Example 2: SaaS Mode (With API credentials for advanced features)
    // This will create Lambda function + custom resource for external API integration
    new ChaimBinder(this, 'OrderSchemaSaaS', {
      schemaPath: './schemas/order.bprint',
      table: orderTable,
      // Optional: Only needed for Chaim SaaS advanced capabilities
      apiKey: process.env.CHAIM_API_KEY,
      apiSecret: process.env.CHAIM_API_SECRET,
      appId: 'my-app-orders',
    });

    // Example 3: Conditional SaaS Mode based on environment
    // You can conditionally enable SaaS features based on deployment context
    const isProduction = this.node.tryGetContext('environment') === 'production';
    
    if (isProduction) {
      // Production: Enable SaaS features for team collaboration
      new ChaimBinder(this, 'ProductionSchema', {
        schemaPath: './schemas/production.bprint',
        table: userTable,
        apiKey: process.env.CHAIM_API_KEY,
        apiSecret: process.env.CHAIM_API_SECRET,
        appId: 'production-app',
      });
    } else {
      // Development: Use OSS mode for simplicity
      new ChaimBinder(this, 'DevelopmentSchema', {
        schemaPath: './schemas/development.bprint',
        table: userTable,
        // No credentials - OSS mode
      });
    }
  }
}
