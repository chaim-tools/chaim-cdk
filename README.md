# chaim-cdk

**Add data governance to your DynamoDB tables in 3 lines of CDK.**

Chaim captures your schema intent at deploy time and publishes it to the Chaim platform. The CDK construct has no runtime overhead and requires no agents.

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

## What Happens at Deploy

When you run `cdk deploy`:

1. **Validate** - Your `.bprint` schema is validated
2. **Capture** - Table metadata is extracted (keys, indexes, TTL, streams), along with high-level AWS account details for context
3. **Upload** - Schema + metadata is securely uploaded to Chaim
4. **Done** - Your stack deploys normally

The CDK construct runs only at deploy time - no runtime overhead in your infrastructure.

> **Note**: While the CDK has no runtime impact, Chaim's full workflow includes using the `chaim-cli` to generate type-safe DTOs and mapper clients for your application. These generated artifacts enforce that your application's data structures match the schema definition.

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

## Coming Soon

- Aurora PostgreSQL/MySQL
- RDS instances  
- S3 buckets
- DocumentDB

## License

Apache-2.0
