# chaim-cdk

**Add data governance to your DynamoDB tables in 3 lines of CDK.**

Chaim captures your schema intent at synth or deploy time and publishes it to the Chaim platform. The CDK construct operates entirely out-of-band — zero impact on your application's request path, no sidecars, no background processes, no runtime instrumentation.

## Installation

```bash
npm install @chaim-tools/cdk-lib
```

## Development

### Build

```bash
pnpm install
pnpm build             # Build all packages
cd packages/cdk-lib
pnpm build             # Build single package
```

### Test

```bash
pnpm test              # All tests
pnpm test:packages     # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:coverage     # With coverage
```

### Clean

Removes build artifacts:

```bash
pnpm clean
```

### Integration Tests

Integration tests deploy real AWS resources and are **skipped by default**. To run:

```bash
export CHAIM_API_KEY=your-key
export CHAIM_API_SECRET=your-secret
pnpm test:integration
```

⚠️ **Warning**: Deploys actual AWS resources and incurs costs.

### Testing Against Dev / Beta Environments

By default, `cdk deploy` sends ingestion traffic to production (`https://ingest.chaim.co`). During development you can override the base URL via CDK context to test against dev or beta:

```bash
# Dev
cdk deploy --context chaimApiBaseUrl=https://ingest.dev.chaim.co

# Beta
cdk deploy --context chaimApiBaseUrl=https://ingest.beta.chaim.co

# Production (default — no flag needed)
cdk deploy
```

The context value is read at synth time and injected into the Lambda as `CHAIM_API_BASE_URL`. Production remains the hardcoded default so customers can never accidentally target a non-production environment.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | Required for CDK and Lambda runtime |
| AWS CDK | v2 | CDK v1 is not supported |
| TypeScript | 5.x | Recommended; JavaScript also supported |

**AWS Requirements:**
- AWS account with permissions to deploy DynamoDB, Lambda, and IAM resources
- Secrets Manager access (if using `ChaimCredentials.fromSecretsManager`)
- Outbound HTTPS from Lambda to Chaim API and S3

**Chaim Requirements:**
- Chaim account with API credentials (`apiKey` and `apiSecret`) and appId

## Add to an Existing Table

Already have a DynamoDB table? Add Chaim in seconds:

```typescript
import { ChaimDynamoDBBinder, ChaimCredentials, TableBindingConfig } from '@chaim-tools/cdk-lib';

// Your existing CDK stack
const usersTable = new dynamodb.Table(this, 'UsersTable', {
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
});

// Create binding configuration
const config = new TableBindingConfig(
  'my-app',
  ChaimCredentials.fromSecretsManager('chaim/credentials')
);

// Add Chaim - that's it
new ChaimDynamoDBBinder(this, 'UsersSchema', {
  schemaPath: './schemas/users.bprint',
  table: usersTable,
  config,
});
```

Your table deploys exactly as before. Chaim captures the schema and table metadata automatically.

## Two Workflows

Chaim supports two workflows depending on your needs:

### LOCAL-only Workflow (Development)

Generate code without deploying - perfect for rapid iteration:

```bash
cdk synth                           # Writes LOCAL snapshot to OS cache
chaim generate --package com.example  # Generates SDK from LOCAL snapshot
```

### Full Workflow (Production)

Deploy and publish schema to Chaim SaaS:

```bash
cdk deploy                          # Writes LOCAL + publishes to Chaim SaaS
chaim generate --package com.example  # Generates SDK from LOCAL snapshot
```

> **Terminology** 
> * **LOCAL** = snapshot written to OS cache at synth time (for CLI). 
> * **PUBLISHED** = snapshot sent to Chaim SaaS at deploy time (for governance/audit).

## What Happens When

### During `cdk synth` (and `cdk deploy`)

1. **Validate** - Your `.bprint` schema is validated
2. **Capture** - Table metadata is extracted (keys, indexes, TTL, streams)
3. **Write LOCAL snapshot** - Saved to OS cache (`~/.chaim/cache/snapshots/`) for CLI code generation
4. **Write Lambda asset** - Bundled to `cdk.out/chaim/assets/` for deploy-time ingestion

### During `cdk deploy` (Lambda execution)

After CloudFormation triggers the custom resource Lambda:

5. **Upload** - Snapshot is uploaded to Chaim SaaS via S3 presigned URL
6. **Register** - Snapshot reference is committed to Chaim binding registry

> **Zero application impact**: The CDK construct and Lambda run only during CloudFormation operations, never on your application's request path. Chaim operates entirely out-of-band with no runtime overhead, sidecars, or instrumentation.

## Credentials Setup

Store your Chaim API credentials in AWS Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name chaim/credentials \
  --secret-string '{"apiKey":"your-api-key","apiSecret":"your-api-secret"}'
```

Then reference it in your CDK:

```typescript
credentials: ChaimCredentials.fromSecretsManager('chaim/credentials')
```

For local development, you can use direct credentials:

```typescript
const config = new TableBindingConfig(
  'my-app',
  ChaimCredentials.fromApiKeys(
    process.env.CHAIM_API_KEY!,
    process.env.CHAIM_API_SECRET!
  )
);
```

### Credential Security Model

> **Important:** Synth never reads secret values. The Secret ARN/name is captured as a reference only. The deploy-time Lambda reads Secrets Manager and signs outbound API requests. No credentials are logged or included in synthesized templates.

## Failure Handling

By default, Chaim uses `BEST_EFFORT` mode - your deployment succeeds even if ingestion fails.

For critical environments, use `STRICT` mode to roll back on failure:

```typescript
import { FailureMode, TableBindingConfig } from '@chaim-tools/cdk-lib';

// Create config with STRICT mode
const config = new TableBindingConfig(
  'my-app',
  ChaimCredentials.fromSecretsManager('chaim/credentials'),
  FailureMode.STRICT  // Optional third parameter
);

new ChaimDynamoDBBinder(this, 'UsersSchema', {
  schemaPath: './schemas/users.bprint',
  table: usersTable,
  config,
});
```

| Mode | Behavior |
|------|----------|
| `BEST_EFFORT` (default) | Deployment continues if ingestion fails |
| `STRICT` | Deployment rolls back if ingestion fails |

## Single-Table Design

For single-table design with multiple entities, create **one** `TableBindingConfig` and share it across all bindings:

```typescript
import { TableBindingConfig } from '@chaim-tools/cdk-lib';

const singleTable = new dynamodb.Table(this, 'SingleTable', {
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
});

// Create config ONCE
const tableConfig = new TableBindingConfig(
  'my-app',
  ChaimCredentials.fromSecretsManager('chaim/credentials')
);

// Share across all entities
new ChaimDynamoDBBinder(this, 'UserBinding', {
  schemaPath: './schemas/user.bprint',
  table: singleTable,
  config: tableConfig,  // Same config
});

new ChaimDynamoDBBinder(this, 'OrderBinding', {
  schemaPath: './schemas/order.bprint',
  table: singleTable,
  config: tableConfig,  // Same config
});
```

**Why?** All entities in the same table must share the same `appId` and `credentials`. `TableBindingConfig` enforces this by design.

## Props Reference

### ChaimDynamoDBBinder

| Property | Required | Description |
|----------|----------|-------------|
| `schemaPath` | Yes | Path to your `.bprint` schema file |
| `table` | Yes | Your DynamoDB table |
| `config` | Yes | `TableBindingConfig` with appId, credentials, and failureMode |

### TableBindingConfig

Constructor: `new TableBindingConfig(appId, credentials, failureMode?)`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `appId` | Yes | Your Chaim application ID |
| `credentials` | Yes | API credentials (from `ChaimCredentials`) |
| `failureMode` | No | `BEST_EFFORT` (default) or `STRICT` |

## Data Sent to Chaim

The following metadata is transmitted to Chaim SaaS at deploy time:

**Schema & Identity:**
- `.bprint` schema content (entity definitions, field types, constraints)
- `appId`, `resourceId`, `stackName`
- `accountId`, `region`

**DynamoDB Metadata:**
- Table name and ARN
- Partition key and sort key names
- GSI/LSI configurations (names, keys, projections)
- TTL attribute name (if enabled)
- Stream configuration (if enabled)
- Billing mode
- Encryption key ARN (if customer-managed)

**What is NOT sent:**
- ❌ No table data or records
- ❌ No sampled data
- ❌ No IAM credentials or secret values
- ❌ No application code

> All data is transmitted over HTTPS. Snapshots are uploaded to Chaim's S3 via presigned URLs and encrypted at rest.

## Snapshot Outputs

Chaim writes snapshots to **two locations** for different consumers:

### LOCAL Snapshots (for CLI)

Written to the OS cache at synth time for `chaim-cli` code generation:

| OS | Default Path |
|----|--------------|
| macOS/Linux | `~/.chaim/cache/snapshots/` |
| Windows | `%LOCALAPPDATA%/chaim/cache/snapshots/` |

**Override:** Set `CHAIM_SNAPSHOT_DIR` environment variable.

**Directory structure:**
```
~/.chaim/cache/snapshots/aws/{accountId}/{region}/{stackName}/{dataStoreType}/{resourceId}.json
```

### Lambda Assets (for Deploy)

Bundled into `cdk.out/chaim/assets/` for the deploy-time Lambda:

```
cdk.out/chaim/assets/{stackName}/{resourceId}/
├── snapshot.json    # Snapshot payload
└── index.js         # Lambda handler
```

This directory is bundled as a CDK asset and read by the Lambda at deploy time.

### Why Two Locations?

| Output | Consumer | When Written | Purpose |
|--------|----------|--------------|---------|
| **LOCAL** (OS cache) | `chaim-cli` | `cdk synth` | Code generation from any directory |
| **Lambda asset** | Deploy Lambda | `cdk synth` | Ingestion to Chaim SaaS |

The hierarchical structure ensures:
- Zero collisions across multi-account/multi-region deployments
- Support for multiple entities per table (single-table design)
- CLI works without access to CDK project directory

## Examples

The `packages/examples/` directory contains working CDK applications demonstrating Chaim integration patterns:

- **consumer-cdk-app** - A complete example showing both direct API credentials and Secrets Manager patterns, with `BEST_EFFORT` and `STRICT` failure modes.

Each example includes its own README with setup and deployment instructions.

```bash
cd packages/examples/consumer-cdk-app
cat README.md
```

## Related Packages

| Package | Purpose |
|---------|---------|
| [chaim-bprint-spec](https://github.com/chaim-tools/chaim-bprint-spec) | Schema format specification (`.bprint` files) |
| [chaim-cli](https://github.com/chaim-tools/chaim-cli) | Code generation from snapshots |
| [chaim-examples-java](https://github.com/chaim-tools/chaim-examples-java) | Java application examples with generated SDKs |

## Coming Soon

- Aurora PostgreSQL/MySQL
- RDS instances  
- S3 buckets
- DocumentDB

## License

Apache-2.0
