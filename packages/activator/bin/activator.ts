#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ActivatorStack } from '../src/activator-stack';

const app = new cdk.App();

const apiBaseUrl = app.node.tryGetContext('apiBaseUrl') || process.env.CHAIM_API_BASE_URL || '';
const apiKey = app.node.tryGetContext('apiKey') || process.env.CHAIM_API_KEY || '';
const apiSecret = app.node.tryGetContext('apiSecret') || process.env.CHAIM_API_SECRET || '';
const schemaHandlerPackageS3Uri = app.node.tryGetContext('schemaHandlerPackageS3Uri') || process.env.CHAIM_SCHEMA_HANDLER_PACKAGE_S3_URI;

if (!apiBaseUrl || !apiKey || !apiSecret) {
  throw new Error('Missing required parameters: apiBaseUrl, apiKey, and apiSecret are required. Set via CDK context (--context) or environment variables.');
}

new ActivatorStack(app, 'ChaimActivatorStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  apiBaseUrl,
  apiKey,
  apiSecret,
  schemaHandlerPackageS3Uri,
});

