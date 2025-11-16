# @chaim-tools/cdk-lib

AWS CDK v2 constructs for binding DynamoDB tables to Chaim schemas.

## Installation

```bash
npm install @chaim-tools/cdk-lib
# or
pnpm add @chaim-tools/cdk-lib
```

## Prerequisites

Before using `ChaimDynamoBinding`, you must:

1. **Deploy your Chaim ingest API** (separate repository) and note its base URL
2. **Activate the CloudFormation Registry type** in your AWS account using the Activator stack

See the [Activator README](../activator/README.md) for activation instructions.

## Quick Start

### Using Inline Schema

```typescript
import { ChaimDynamoBinding } from '@chaim-tools/cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

// Create a DynamoDB table
const usersTable = new dynamodb.Table(this, 'Users', {
  partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});

// Bind it to a schema (inline)
new ChaimDynamoBinding(this, 'UsersBinding', {
  appId: 'my-app',
  table: usersTable,
  schemaInline: {
    schemaVersion: '1.0',
    namespace: 'myapp.users',
    description: 'Users table schema',
    entity: {
      primaryKey: { partitionKey: 'pk' },
      fields: [
        { name: 'pk', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'createdAt', type: 'timestamp', required: false },
      ],
    },
  },
});
```

### Using Schema File Path

```typescript
import { ChaimDynamoBinding } from '@chaim-tools/cdk-lib';
import * as path from 'path';

// Bind from a .bprint file (read at synth time)
new ChaimDynamoBinding(this, 'UsersBinding', {
  appId: 'my-app',
  table: usersTable,
  schemaPath: path.join(__dirname, '..', 'schemas', 'users.bprint.json'),
  // Also supports YAML: 'users.bprint.yaml'
});
```

## API Reference

### `ChaimDynamoBinding`

Construct that binds a DynamoDB table to a Chaim schema.

#### Props

- **`appId`** (string, required): Application identifier
- **`table`** (`ITable`, required): DynamoDB table to bind
- **`schemaPath`** (string, optional): Path to `.bprint` file (JSON or YAML)
- **`schemaInline`** (object, optional): Schema object to embed directly
- **`maxSchemaBytes`** (number, optional): Max schema size in bytes (default: 200,000)

**Note**: You must provide exactly one of `schemaPath` or `schemaInline`.

#### Schema Size Limits

For the pilot release, schemas are sent inline (max ~200 KB). Production will support S3 pointers for larger schemas.

## How It Works

1. At **synth time**: The construct reads your `.bprint` file (if using `schemaPath`) and embeds it as the `Schema` property
2. During **deploy**: CloudFormation invokes the provider Lambda in your account
3. The provider:
   - Computes `bindingId` and `contentHash`
   - Fetches API credentials from Secrets Manager (set by Activator)
   - POSTs binding metadata + schema to your ingest API
   - Returns CloudFormation attributes (`BindingId`, `ContentHash`, `AppliedAt`, `Status`)

## Legacy: ChaimBinder

This package also includes the legacy `ChaimBinder` construct for OSS/SaaS mode. See the [main repository README](../../README.md) for details.

## License

Apache-2.0
