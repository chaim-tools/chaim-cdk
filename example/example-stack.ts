#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimBinder } from '../src/chaim-binder';

const app = new cdk.App();

class ExampleStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB tables
    const userTable = new dynamodb.Table(this, 'UserTable', {
      tableName: 'users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    const orderTable = new dynamodb.Table(this, 'OrderTable', {
      tableName: 'orders',
      partitionKey: { name: 'order_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Register schemas with Chaim using default API URL
    new ChaimBinder(this, 'UserSchema', {
      schemaPath: './schemas/user.bprint',
      table: userTable,
      apiKey: process.env.CHAIM_API_KEY || 'your-api-key',
      apiSecret: process.env.CHAIM_API_SECRET || 'your-api-secret',
      appId: 'my-app-users',
    });

    new ChaimBinder(this, 'OrderSchema', {
      schemaPath: './schemas/order.bprint',
      table: orderTable,
      apiKey: process.env.CHAIM_API_KEY || 'your-api-key',
      apiSecret: process.env.CHAIM_API_SECRET || 'your-api-secret',
      appId: 'my-app-orders',
    });
  }
}

new ExampleStack(app, 'ChaimBinderExampleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
