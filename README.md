# @chaim/cdk

AWS CDK v2 constructs for Chaim schema binding. This package provides an L2 construct that registers `.bprint` schemas with the Chaim SaaS platform during AWS CDK deployment.

## Features

- **L2 Construct**: `ChaimBinder` - Bind DynamoDB tables with schemas with Chaim SaaS
- **DynamoDB Integration**: Accepts DynamoDB Table resources and extracts comprehensive metadata
- **Lambda-backed Custom Resource**: Handles schema registration via HTTP API calls
- **TypeScript Support**: Full TypeScript support with type definitions
- **AWS CDK v2**: Built for AWS CDK v2 with modern constructs
- **Comprehensive Testing**: Vitest-based test suite with coverage

## Installation

```bash
npm install @chaim/cdk
```

## Quick Start

```typescript
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ChaimBinder } from '@chaim/cdk';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'MyStack');

// Create your DynamoDB table
const userTable = new dynamodb.Table(stack, 'UserTable', {
  tableName: 'users',
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
});

// Bind the schema with the DynamoDB table
new ChaimBinder(stack, 'UserSchema', {
  schemaPath: './schemas/user.bprint',
  table: userTable,
  apiKey: process.env.CHAIM_API_KEY!,
  apiSecret: process.env.CHAIM_API_SECRET!,
  appId: 'my-app-users',
});

app.synth();
```

## API Reference

### ChaimBinder

The main construct for binding DynamoDB tables with schemas.

#### Props

```typescript
export interface ChaimBinderProps {
  schemaPath: string;            // path to .bprint (JSON/YAML)
  table: dynamodb.ITable;        // DynamoDB Table resource
  apiKey: string;                // from user's SaaS UI
  apiSecret: string;             // from user's SaaS UI
  appId: string;                 // app identifier shown in SaaS
}
```

#### Properties

- `customResource: cr.AwsCustomResource` - The underlying custom resource
- `table: dynamodb.ITable` - The DynamoDB Table resource

## Schema Format

The construct supports `.bprint` files in JSON format. The schema focuses on data model definition, while table metadata is extracted from the DynamoDB Table resource.

```json
{
  "chaim_version": 1,
  "model_name": "User",
  "fields": [
    {
      "name": "id",
      "type": "string",
      "required": true,
      "partition_key": true
    },
    {
      "name": "email",
      "type": "string",
      "required": true
    },
    {
      "name": "created_at",
      "type": "string",
      "required": true,
      "sort_key": true
    }
  ]
}
```

### Field Types

- `string` - String values
- `number` - Numeric values
- `boolean` - Boolean values
- `array` - Array values (requires `item_type`)
- `object` - Object values

### Field Properties

- `name` (required) - Field name
- `type` (required) - Field type
- `required` (optional) - Whether field is required (default: false)
- `partition_key` (optional) - Whether field is a partition key (default: false)
- `sort_key` (optional) - Whether field is a sort key (default: false)
- `item_type` (optional) - For arrays, the type of items

## Table Metadata

The construct automatically extracts comprehensive metadata from the DynamoDB Table resource:

- **Table Name & ARN**: Automatically extracted from the table resource
- **AWS Account & Region**: Current stack's account and region
- **Encryption**: Encryption key ARN (if configured)
- **Additional Properties**: Available for concrete Table constructs

## Environment Variables

Set these environment variables for your API credentials:

```bash
export CHAIM_API_KEY="your-api-key"
export CHAIM_API_SECRET="your-api-secret"
```

## Development

### Prerequisites

- Node.js 20+
- AWS CDK CLI
- AWS credentials configured

### Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

### Project Structure

```
chaim-cdk/
├── src/
│   ├── index.ts              # Main exports
│   ├── chaim-schema.ts       # ChaimBinder construct
│   └── chaim-schema.test.ts  # Tests
├── example/
│   ├── example-stack.ts      # Example usage
│   └── schemas/              # Example schema files
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## How It Works

1. **Schema Validation**: The construct validates the schema file exists and has valid JSON format
2. **Table Metadata Extraction**: Extracts comprehensive metadata from the DynamoDB Table resource
3. **Schema Enhancement**: Combines the data model with table metadata
4. **Lambda Function**: Creates a Lambda function with the schema registration logic
5. **Custom Resource**: Uses AWS CloudFormation Custom Resource to trigger schema registration
6. **API Integration**: Lambda function POSTs enhanced schema data to Chaim API during deployment
7. **Cleanup**: Handles schema deletion when the stack is destroyed

## Security

- API credentials are stored as Lambda environment variables
- Lambda function has minimal IAM permissions
- HTTPS communication with Chaim API
- No sensitive data logged
- Table metadata is securely extracted from CDK constructs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `npm test` and `npm run lint`
6. Submit a pull request

## License

Apache-2.0 License - see [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- GitHub Issues: [chaim-builder/chaim-cdk](https://github.com/chaim-builder/chaim-cdk/issues)
- Documentation: [https://chaim.co/docs](https://chaim.co/docs)