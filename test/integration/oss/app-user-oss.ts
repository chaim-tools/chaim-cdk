import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UserOssStack } from './stack-user-oss';

// This app file is used by CDK CLI for deployment
// Stack name and props are provided via environment variables
const app = new cdk.App();

const stackName = process.env.STACK_NAME || 'UserOssStack';
const schemaPath = process.env.SCHEMA_PATH || './example/schemas/user.bprint';
const tableName = process.env.TABLE_NAME || 'chaim-test-user';
const chaimBinderId = process.env.CHAIM_BINDER_ID || 'UserChaimBinder';
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;

if (!account) {
  throw new Error('CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID must be set');
}

new UserOssStack(app, stackName, {
  env: {
    account: account,
    region: region,
  },
  schemaPath: schemaPath,
  tableName: tableName,
  chaimBinderId: chaimBinderId,
});

