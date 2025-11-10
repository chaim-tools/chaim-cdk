import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimBinder } from '../../../src/chaim-binder';

export interface UserOssStackProps extends cdk.StackProps {
  schemaPath: string;
  tableName: string;
  chaimBinderId: string;
}

export class UserOssStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: UserOssStackProps) {
    super(scope, id, props);

    // Create DynamoDB table
    const table = new dynamodb.Table(this, 'UserTable', {
      tableName: props.tableName,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Create ChaimBinder construct in OSS mode
    new ChaimBinder(this, props.chaimBinderId, {
      schemaPath: props.schemaPath,
      table: table,
    });
  }
}

