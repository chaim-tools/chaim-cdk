# Chaim CDK Construct

A CDK v2 construct that binds DynamoDB tables with Chaim schemas, supporting both OSS and SaaS modes.

## What This Does

**ChaimBinder** is a CDK construct that validates your `.bprint` schema files and binds them to DynamoDB tables. It operates in two modes:

- **OSS Mode**: Schema validation and metadata extraction with CloudFormation outputs
- **SaaS Mode**: Full schema management with external API integration

## Installation

```bash
npm install @chaim/cdk
```

## Quick Start

### 1. Define Your Schema

Create a `.bprint` file following the [chaim-bprint-spec](https://github.com/chaim-builder/chaim-bprint-spec):

```json
{
  "schemaVersion": "1.0.0",
  "namespace": "user",
  "description": "User entity schema",
  "entity": {
    "primaryKey": "userId",
    "fields": {
      "userId": { "type": "string", "required": true },
      "email": { "type": "string", "required": true }
    }
  }
}
```

### 2. Use in Your CDK Stack

```typescript
import { ChaimBinder } from '@chaim/cdk';

// OSS Mode: No API credentials required
new ChaimBinder(this, 'UserSchema', {
  schemaPath: './schemas/user.bprint',
  table: userTable,
  // Creates CloudFormation outputs for chaim-cli consumption
});

// SaaS Mode: With API credentials for advanced features
new ChaimBinder(this, 'OrderSchema', {
  schemaPath: './schemas/order.bprint',
  table: orderTable,
  apiKey: process.env.CHAIM_API_KEY,
  apiSecret: process.env.CHAIM_API_SECRET,
  appId: 'my-app',
});
```

## How It Works

### OSS Mode (Default)
- ✅ Validates `.bprint` schema files
- ✅ Extracts DynamoDB table metadata
- ✅ Creates CloudFormation outputs for `chaim-cli` consumption
- ❌ **No Lambda functions deployed**
- ❌ **No external API calls**
- 💰 **Zero runtime costs**

### SaaS Mode (Optional)
- ✅ All OSS functionality
- ✅ Deploys Lambda function for external API integration
- ✅ Creates custom resource for lifecycle management
- ✅ Schema registration with Chaim platform
- 💰 **Lambda execution costs apply**

## Usage Modes

### OSS Mode - Perfect for:
- Individual developers
- Small teams
- Cost-conscious deployments
- Offline development
- Schema validation only

### SaaS Mode - Perfect for:
- Team collaboration
- Schema versioning
- Compliance tracking
- Advanced analytics
- Multi-environment management

## Architecture

```
OSS Mode:
.bprint → CDK → Validation → CloudFormation Outputs → chaim-cli

SaaS Mode:
.bprint → CDK → Validation → Lambda + Custom Resource → Chaim Platform
```

## What You Get

### OSS Mode Outputs
- `SchemaData`: Your processed schema for `chaim-cli`
- `TableMetadata`: DynamoDB table information
- `Mode`: Operating mode indicator

### SaaS Mode Resources
- Lambda function for external API calls
- Custom resource for lifecycle management
- All OSS outputs plus runtime capabilities

## Next Steps

1. **Deploy your CDK stack** with ChaimBinder
2. **Use `chaim-cli`** to consume the CloudFormation outputs
3. **Generate your MapperClient** from the schema data
4. **Integrate** the client into your application code

## Examples

See `example/example-stack.ts` for complete usage examples including conditional SaaS mode activation based on environment.