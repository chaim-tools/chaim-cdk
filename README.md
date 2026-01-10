# chaim-cdk

**Add data governance to your DynamoDB tables in 3 lines of CDK.**

Chaim captures your schema intent at synth or deploy time and publishes it to the Chaim platform. The CDK construct has no runtime overhead and requires no agents.

## Installation

```bash
npm install @chaim-tools/cdk-lib
```

## Add to an Existing Table

Already have a DynamoDB table? Add Chaim in seconds:

```typescript
import { ChaimDynamoDBBinder, ChaimCredentials } from '@chaim-tools/cdk-lib';

// Your existing CDK stack
const usersTable = new dynamodb.Table(this, 'UsersTable', {
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
});

// Add Chaim - that's it
new ChaimDynamoDBBinder(this, 'UsersSchema', {
  schemaPath: './schemas/users.bprint',
  table: usersTable,
  appId: 'my-app',
  credentials: ChaimCredentials.fromSecretsManager('chaim/credentials'),
});
```

Your table deploys exactly as before. Chaim captures the schema and table metadata automatically.

## Two Workflows

Chaim supports two workflows depending on your needs:

### Preview Workflow (Development)

Generate code without deploying - perfect for rapid iteration:

```bash
cdk synth                           # Creates preview snapshot
chaim generate --mode preview       # Generates SDK from snapshot
```

### Full Workflow (Production)

Deploy and track schema changes in Chaim SaaS:

```bash
cdk deploy                          # Creates registered snapshot + publishes to Chaim
chaim generate                      # Generates SDK (auto-selects registered)
```

## What Happens When

### During `cdk synth`

1. **Validate** - Your `.bprint` schema is validated
2. **Capture** - Table metadata is extracted (keys, indexes, TTL, streams)
3. **Write** - Preview snapshot saved to `cdk.out/chaim/snapshots/preview/`

### During `cdk deploy`

All synth steps, plus:

4. **Upload** - Schema + metadata is securely uploaded to Chaim SaaS
5. **Track** - Registered snapshot saved to `cdk.out/chaim/snapshots/registered/`

The CDK construct runs only at synth/deploy time - no runtime overhead.

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
credentials: ChaimCredentials.fromApiKeys(
  process.env.CHAIM_API_KEY!,
  process.env.CHAIM_API_SECRET!
)
```

## Failure Handling

By default, Chaim uses `BEST_EFFORT` mode - your deployment succeeds even if ingestion fails.

For critical environments, use `STRICT` mode to roll back on failure:

```typescript
import { FailureMode } from '@chaim-tools/cdk-lib';

new ChaimDynamoDBBinder(this, 'UsersSchema', {
  schemaPath: './schemas/users.bprint',
  table: usersTable,
  appId: 'my-app',
  credentials: ChaimCredentials.fromSecretsManager('chaim/credentials'),
  failureMode: FailureMode.STRICT,
});
```

| Mode | Behavior |
|------|----------|
| `BEST_EFFORT` (default) | Deployment continues if ingestion fails |
| `STRICT` | Deployment rolls back if ingestion fails |

## Props Reference

| Property | Required | Description |
|----------|----------|-------------|
| `schemaPath` | Yes | Path to your `.bprint` schema file |
| `table` | Yes | Your DynamoDB table |
| `appId` | Yes | Your Chaim application ID |
| `credentials` | Yes | API credentials |
| `failureMode` | No | `BEST_EFFORT` (default) or `STRICT` |

## Snapshot Locations

All snapshots are written to `cdk.out/chaim/snapshots/`:

| Mode | Path | When Created | Purpose |
|------|------|--------------|---------|
| Preview | `preview/<stackName>.json` | `cdk synth` | Local development, code generation |
| Registered | `registered/<stackName>-<eventId>.json` | `cdk deploy` | Production tracking, audit trail |

## Related Packages

| Package | Purpose |
|---------|---------|
| [chaim-bprint-spec](https://github.com/chaim-tools/chaim-bprint-spec) | Schema format specification (`.bprint` files) |
| [chaim-cli](https://github.com/chaim-tools/chaim-cli) | Code generation from snapshots |

## Coming Soon

- Aurora PostgreSQL/MySQL
- RDS instances  
- S3 buckets
- DocumentDB

## License

Apache-2.0
