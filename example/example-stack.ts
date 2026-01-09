#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimDynamoDBBinder } from '../src/binders/chaim-dynamodb-binder';
import { ChaimCredentials } from '../src/types/credentials';
import { FailureMode } from '../src/types/failure-mode';

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

    // Example 1: Using direct API credentials (failureMode defaults to BEST_EFFORT)
    new ChaimDynamoDBBinder(this, 'UserSchema', {
      schemaPath: './schemas/user.bprint',
      table: userTable,
      appId: 'my-app',
      credentials: ChaimCredentials.fromApiKeys(
        process.env.CHAIM_API_KEY!,
        process.env.CHAIM_API_SECRET!
      ),
    });

    // Example 2: Using Secrets Manager with STRICT failure mode
    new ChaimDynamoDBBinder(this, 'OrderSchema', {
      schemaPath: './schemas/order.bprint',
      table: orderTable,
      appId: 'my-app',
      credentials: ChaimCredentials.fromSecretsManager('chaim/api-credentials'),
      failureMode: FailureMode.STRICT,  // Deployment rolls back on ingestion error
    });
  }
}
