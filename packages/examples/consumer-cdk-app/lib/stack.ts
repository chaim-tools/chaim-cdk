import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { ChaimDynamoDBBinder, ChaimCredentials, FailureMode } from '@chaim-tools/cdk-lib';
import * as path from 'path';

/**
 * Example CDK stack demonstrating ChaimDynamoDBBinder usage.
 * 
 * Shows two patterns:
 * 1. Direct API credentials with BEST_EFFORT failure mode (development)
 * 2. Secrets Manager credentials with STRICT failure mode (production)
 */
export class ConsumerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ===========================================
    // Table 1: Users - Direct credentials example
    // ===========================================
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Example 1: Using direct API credentials (for development/testing)
    // failureMode defaults to BEST_EFFORT - deployment continues even if ingestion fails
    new ChaimDynamoDBBinder(this, 'UsersBinding', {
      schemaPath: path.join(__dirname, '..', 'schemas', 'users.bprint'),
      table: usersTable,
      appId: 'my-app',
      credentials: ChaimCredentials.fromApiKeys(
        process.env.CHAIM_API_KEY || 'demo-api-key',
        process.env.CHAIM_API_SECRET || 'demo-api-secret'
      ),
      // failureMode: FailureMode.BEST_EFFORT (default)
    });

    // ===========================================
    // Table 2: Orders - Secrets Manager example
    // ===========================================
    const ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Example 2: Using Secrets Manager with STRICT failure mode (for production)
    // STRICT mode rolls back the deployment if ingestion fails
    new ChaimDynamoDBBinder(this, 'OrdersBinding', {
      schemaPath: path.join(__dirname, '..', 'schemas', 'orders.bprint'),
      table: ordersTable,
      appId: 'my-app',
      credentials: ChaimCredentials.fromSecretsManager('chaim/api-credentials'),
      failureMode: FailureMode.STRICT,
    });

    // ===========================================
    // Outputs
    // ===========================================
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'Name of the Users DynamoDB table',
    });

    new cdk.CfnOutput(this, 'UsersTableArn', {
      value: usersTable.tableArn,
      description: 'ARN of the Users DynamoDB table',
    });

    new cdk.CfnOutput(this, 'OrdersTableName', {
      value: ordersTable.tableName,
      description: 'Name of the Orders DynamoDB table',
    });

    new cdk.CfnOutput(this, 'OrdersTableArn', {
      value: ordersTable.tableArn,
      description: 'ARN of the Orders DynamoDB table',
    });
  }
}
