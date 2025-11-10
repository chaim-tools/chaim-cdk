import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateAwsCredentials, generateStackName, getAwsRegion } from '../../fixtures/aws-helpers';
import { deleteStack, waitForStackDeployment } from '../../fixtures/stack-deployment';
import {
  verifyDynamoDBTableExists,
  verifyCloudFormationOutputs,
  parseSchemaDataOutput,
  parseTableMetadataOutput,
  verifySchemaDataMatchesFile,
  verifyModeOutput,
} from '../../fixtures/resource-verification';
import { getSchemaPath } from '../../fixtures/schema-loader';
import * as path from 'path';
import { execSync } from 'child_process';

// Validate AWS credentials before running tests
beforeAll(() => {
  validateAwsCredentials();
});

describe('ChaimBinder OSS Mode Integration Tests', () => {
  const region = getAwsRegion();
  const deployedStacks: string[] = [];

  // Cleanup all deployed stacks after all tests
  afterAll(async () => {
    for (const stackName of deployedStacks) {
      try {
        await deleteStack(stackName);
      } catch (error) {
        console.error(`Failed to cleanup stack ${stackName}:`, error);
      }
    }
  });

  it('should deploy ChaimBinder in OSS mode and verify resources', async () => {
    // 1. Generate unique stack name
    const stackName = generateStackName('chaim-cdk-oss-test');
    deployedStacks.push(stackName);

    // 2. Setup test parameters
    const schemaPath = getSchemaPath('user.bprint');
    const tableName = `chaim-test-user-${Date.now()}`;
    const chaimBinderId = 'UserChaimBinder';

    // 3. Get paths
    const projectRoot = path.resolve(__dirname, '../../..');
    const appFile = path.relative(projectRoot, path.join(__dirname, 'app-user-oss.ts'));

    // 4. Deploy stack to AWS using the separate stack file
    console.log(`Deploying OSS mode stack: ${stackName}`);
    const deployCommand = `npx cdk deploy ${stackName} --app "npx ts-node --prefer-ts-exts ${appFile}" --require-approval never`;

    execSync(deployCommand, {
      stdio: 'inherit',
      cwd: projectRoot,
      env: {
        ...process.env,
        STACK_NAME: stackName,
        SCHEMA_PATH: schemaPath,
        TABLE_NAME: tableName,
        CHAIM_BINDER_ID: chaimBinderId,
        AWS_REGION: region,
        CDK_DEFAULT_REGION: region,
      },
    });

    // 5. Wait for stack to stabilize
    console.log(`Waiting for stack ${stackName} to stabilize...`);
    await waitForStackDeployment(stackName, ['CREATE_COMPLETE', 'UPDATE_COMPLETE']);

    // 6. Verify DynamoDB table exists
    console.log(`Verifying DynamoDB table: ${tableName}`);
    await verifyDynamoDBTableExists(tableName);

    // 7. Verify CloudFormation outputs exist
    console.log(`Verifying CloudFormation outputs for stack: ${stackName}`);
    const outputPrefixes = [
      `${chaimBinderId}SchemaData`,
      `${chaimBinderId}TableMetadata`,
      `${chaimBinderId}Mode`,
    ];
    const outputs = await verifyCloudFormationOutputs(stackName, outputPrefixes);

    // 8. Verify Mode output
    verifyModeOutput(outputs[`${chaimBinderId}Mode`].value, 'oss');

    // 9. Verify SchemaData output
    const schemaData = parseSchemaDataOutput(outputs[`${chaimBinderId}SchemaData`].value);
    expect(schemaData.schemaVersion).toBeDefined();
    expect(schemaData.namespace).toBeDefined();
    expect(schemaData.entity).toBeDefined();
    expect(schemaData.entity.primaryKey.partitionKey).toBe('userId');

    // 10. Verify schema data matches the .bprint file
    await verifySchemaDataMatchesFile(outputs[`${chaimBinderId}SchemaData`].value, 'user.bprint');

    // 11. Verify TableMetadata output
    const tableMetadata = parseTableMetadataOutput(outputs[`${chaimBinderId}TableMetadata`].value);
    expect(tableMetadata.tableName).toBe(tableName);
    expect(tableMetadata.tableArn).toContain('table');
    expect(tableMetadata.partitionKey).toBe('userId');

    console.log(`✅ OSS mode integration test passed for stack: ${stackName}`);
  }, 15 * 60 * 1000); // 15 minute timeout
});

