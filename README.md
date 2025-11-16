# Chaim CDK Monorepo

> **Note**: This is the **development repository** for Chaim CDK packages. 
> 
> **For customers**: Install `@chaim-tools/cdk-lib` from npm:
> ```bash
> npm install @chaim-tools/cdk-lib
> # or
> pnpm add @chaim-tools/cdk-lib
> ```
> 
> See the [package README](./packages/cdk-lib/README.md) for customer-facing documentation.

---

A monorepo containing AWS CDK constructs and CloudFormation Registry resources for Chaim schema management.

## Overview

This monorepo contains the source code for:

1. **CloudFormation Registry Provider** (`packages/cfn-provider-dynamodb-binding`) - Lambda-based provider for `Chaim::DynamoDB::Binding` resource type
2. **CDK Activator** (`packages/activator`) - Stack to activate the CloudFormation Registry type in your account
3. **CDK L2 Library** (`packages/cdk-lib`) - High-level CDK constructs published as `@chaim-tools/cdk-lib` on npm
4. **Example App** (`packages/examples/consumer-cdk-app`) - Example CDK application demonstrating usage

## Development Setup

For developers working on this repository:

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Customer Quick Start

> **For end users**: See the [customer documentation](./packages/cdk-lib/README.md) after installing from npm.

The typical customer workflow:

1. **Install the package**: `npm install @chaim-tools/cdk-lib`
2. **Deploy the Activator stack** (one-time setup per account/region)
3. **Use `ChaimDynamoBinding`** in your CDK stacks

See `packages/activator/README.md` for activator deployment instructions.

## Example App

See `packages/examples/consumer-cdk-app` for a complete example:

```bash
cd packages/examples/consumer-cdk-app
pnpm build
pnpm cdk synth
```

## Package Structure

```
chaim-cdk/
├── packages/
│   ├── cdk-lib/                    # CDK L2 constructs
│   ├── cfn-provider-dynamodb-binding/  # CloudFormation Registry provider
│   ├── activator/                  # Type activation stack
│   └── examples/
│       └── consumer-cdk-app/      # Example usage
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Pilot Limitations

For this pilot release:

- **Inline schema only**: Schemas are sent inline in the CloudFormation resource (max ~200 KB)
- **No S3 persistence**: Production will switch to S3 pointers
- **HTTPS ingest**: Provider posts directly to your ingest API endpoint

## IAM Permissions

The provider execution role requires:

- `dynamodb:DescribeTable` - To validate table metadata
- `secretsmanager:GetSecretValue` - To fetch API credentials
- `sts:GetCallerIdentity` - To get AWS account ID

These are automatically granted by the Activator stack.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## License

Apache-2.0
