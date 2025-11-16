# Consumer CDK App Example

Example CDK application demonstrating `ChaimDynamoBinding` usage.

## Usage

```bash
# Build
pnpm build

# Synthesize CloudFormation template
pnpm cdk synth

# Deploy (after activating the type)
pnpm cdk deploy
```

## What It Does

1. Creates a DynamoDB table
2. Binds it to a Chaim schema using `ChaimDynamoBinding`
3. Outputs table name and ARN

## License

Apache-2.0

