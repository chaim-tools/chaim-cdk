# @chaim-tools/cdk-lib

AWS CDK v2 constructs for binding DynamoDB tables to Chaim schemas.

## Installation

```bash
npm install @chaim-tools/cdk-lib
# or
pnpm add @chaim-tools/cdk-lib
```

## Quick Start

```typescript
import { ChaimDynamoDBBinder, ChaimCredentials, FailureMode } from '@chaim-tools/cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

// Create a DynamoDB table
const usersTable = new dynamodb.Table(this, 'Users', {
  partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});

// Bind it to a schema using Secrets Manager for credentials (recommended)
new ChaimDynamoDBBinder(this, 'UsersBinding', {
  schemaPath: './schemas/users.bprint',
  table: usersTable,
  appId: 'my-app',
  credentials: ChaimCredentials.fromSecretsManager('chaim/api-credentials'),
});

// Or use direct credentials for development/testing
new ChaimDynamoDBBinder(this, 'UsersBinding', {
  schemaPath: './schemas/users.bprint',
  table: usersTable,
  appId: 'my-app',
  credentials: ChaimCredentials.fromApiKeys(
    process.env.CHAIM_API_KEY!,
    process.env.CHAIM_API_SECRET!
  ),
  failureMode: FailureMode.STRICT,  // Optional - rolls back on failure
});
```

## API Reference

### `ChaimDynamoDBBinder`

Construct that binds a DynamoDB table to a Chaim schema.

#### Props

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `schemaPath` | string | Yes | Path to `.bprint` schema file |
| `table` | `ITable` | Yes | DynamoDB table to bind |
| `appId` | string | Yes | Application ID for Chaim SaaS |
| `credentials` | `IChaimCredentials` | Yes | API credentials (use `ChaimCredentials` factory) |
| `failureMode` | `FailureMode` | No | Default: `BEST_EFFORT` |

### `ChaimCredentials`

Factory class for creating Chaim API credentials.

```typescript
// Using AWS Secrets Manager (recommended for production)
const credentials = ChaimCredentials.fromSecretsManager('chaim/api-credentials');

// Using direct API keys (for development/testing)
const credentials = ChaimCredentials.fromApiKeys(apiKey, apiSecret);
```

### `FailureMode`

| Mode | Behavior |
|------|----------|
| `BEST_EFFORT` (default) | Log errors, return SUCCESS to CloudFormation |
| `STRICT` | Return FAILED to CloudFormation on any ingestion error |

## How It Works

1. At **synth time**: The construct reads your `.bprint` file, validates it, and writes a snapshot to the CDK asset directory
2. During **deploy**: CloudFormation invokes the ingestion Lambda in your account
3. The Lambda:
   - Reads the bundled snapshot from `./snapshot.json`
   - Generates `eventId` (UUID v4) and `contentHash` (SHA-256)
   - Requests presigned URL: `POST /ingest/upload-url`
   - Uploads snapshot: `PUT <presignedUrl>`
   - Commits reference: `POST /ingest/snapshot-ref`

## Ingestion Flow

```
Create/Update:
  1. POST /ingest/upload-url → get presigned S3 URL
  2. PUT snapshot bytes to presigned URL
  3. POST /ingest/snapshot-ref with action: 'UPSERT'

Delete:
  1. POST /ingest/snapshot-ref with action: 'DELETE'
```

## Configuration

### Default API Base URL

The default API base URL is `https://api.chaim.co`. Override via:
- CDK context: `chaimApiBaseUrl`
- Environment variable: `CHAIM_API_BASE_URL`

## License

Apache-2.0
