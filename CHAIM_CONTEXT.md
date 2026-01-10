# AI Agent Context: chaim-cdk

**Purpose**: Structured context for AI agents to understand and work with the chaim-cdk codebase.

**Package**: `@chaim-tools/cdk-lib`  
**Version**: 0.1.0  
**License**: Apache-2.0

---

## Project Overview

The chaim-cdk is a **pnpm monorepo** containing AWS CDK L2 constructs for binding data stores to Chaim schemas. It captures schema and metadata at **synth time** (preview) and publishes to the **Chaim SaaS platform** at **deploy time** (registered).

> **Mental model (dual-mode)**:
> - **Preview mode** (`cdk synth`): Captures declared intent locally for development and code generation without requiring deployment
> - **Registered mode** (`cdk deploy`): Captures and publishes intent to Chaim SaaS for production tracking and audit
> 
> Both modes produce snapshot files. The CDK construct is never part of the application runtime path.

### Key Capabilities

- **ChaimDynamoDBBinder**: CDK construct for binding DynamoDB tables to `.bprint` schemas
- **Dual-Mode Snapshots**: Preview snapshots at synth-time, registered snapshots at deploy-time
- **Extensible Architecture**: Abstract base class supports future data store types (e.g., RDS, Object)
- **Large Payload Support**: S3 presigned upload for arbitrarily large schemas
- **Schema Validation**: Validates `.bprint` files using `@chaim-tools/chaim-bprint-spec`
- **Metadata Capture**: Captures schema, resource configuration (keys, indexes, TTL, streams, encryption), and cloud account details
- **Secure Ingestion**: HMAC-signed API requests with credential rotation support

---

## Related Packages

| Package | Relationship | Purpose |
|---------|-------------|---------|
| `@chaim-tools/chaim-bprint-spec` | **Dependency** | Schema format definition, validation, TypeScript types |
| `chaim-cli` | **Consumer** | Reads snapshot files from `cdk.out/chaim/snapshots/` for SDK code generation |

**Data flow**:
```
.bprint file → chaim-cdk (validates + captures) → snapshot files → chaim-cli (generates SDK)
```

## Scope

This repository (`chaim-cdk`) is the **AWS CDK (CloudFormation) implementation** of Chaim ingestion.

- It is intentionally **AWS-specific** (DynamoDB, CloudFormation Custom Resource, Secrets Manager, S3 presigned URLs).
- Other cloud providers and on-prem deployment integrations will live in **separate repositories**.
- All provider repos must remain **contract-compatible** with the Chaim ingest plane:
  - upload-url → PUT snapshot bytes → snapshot-ref commit
  - eventId idempotency
  - authenticated requests (credentials + signing)
---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript 5.x |
| Package Manager | pnpm 8+ (monorepo) |
| Runtime | Node.js 20+ |
| Infrastructure | AWS CDK v2 |
| AWS Services | DynamoDB, Lambda, Secrets Manager, S3 (presigned URLs) |
| Testing | Vitest |
| Code Quality | ESLint, TypeScript strict mode |

---

## Repository Structure

```
chaim-cdk/
├── src/
│   ├── index.ts                      # Package exports
│   ├── binders/                      # Data store binder constructs
│   │   ├── base-chaim-binder.ts      # Abstract base class
│   │   └── chaim-dynamodb-binder.ts  # DynamoDB implementation
│   ├── types/                        # TypeScript interfaces
│   │   ├── base-binder-props.ts      # Shared props (credentials, appId)
│   │   ├── data-store-metadata.ts    # Metadata types per data store
│   │   └── snapshot-payload.ts       # Ingestion payload structure
│   └── services/
│       ├── schema-service.ts         # Schema loading & validation
│       ├── ingestion-service.ts      # API configuration & utilities
│       └── snapshot-paths.ts         # Snapshot file path utilities
├── packages/
│   ├── cdk-lib/                      # Published npm package
│   └── examples/                     # Example applications
├── example/
│   ├── example-stack.ts              # Usage examples
│   └── schemas/                      # Sample .bprint files
└── test/                             # Unit & integration tests
```

---

## Architecture

### Extensible Base Class Design

```
BaseChaimBinder (abstract)
├── extractMetadata()           # Abstract - implemented by subclasses
├── buildPreviewSnapshot()      # Synth-time: builds preview payload (no eventId/contentHash)
├── buildRegisteredSnapshot()   # Deploy-time: builds registered payload (includes eventId/contentHash)
├── writePreviewSnapshotToDisk()# Writes to cdk.out/chaim/snapshots/preview/
├── deployIngestionResources()  # Shared - Lambda + custom resource for deploy-time
│
└── ChaimDynamoDBBinder (concrete)
    └── extractMetadata()       # DynamoDB-specific metadata extraction

Future extensions (not yet implemented):
├── ChaimAuroraBinder
├── ChaimRDSBinder
└── ChaimDocumentDBBinder
```

### Snapshot Creation Flow

**During `cdk synth` (constructor execution):**
1. Validate credentials
2. Generate eventId (UUID v4)
3. Load and validate `.bprint` schema
4. Extract data store metadata (subclass)
5. **Write preview snapshot** → `cdk.out/chaim/snapshots/preview/<stackName>.json`
6. Build registered snapshot (for Lambda env)
7. Deploy ingestion Lambda + custom resource

**During `cdk deploy` (Lambda execution):**
1. Lambda reads registered snapshot from env
2. Request presigned upload URL
3. Upload snapshot to S3
4. Commit snapshot reference to Chaim SaaS

---

## Core Construct: ChaimDynamoDBBinder

CDK construct for binding a `.bprint` schema to a DynamoDB table and publishing to Chaim SaaS.

```typescript
import { ChaimDynamoDBBinder, ChaimCredentials, FailureMode } from '@chaim-tools/cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const table = new dynamodb.Table(this, 'UsersTable', {
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
});

// Using Secrets Manager - failureMode defaults to BEST_EFFORT
new ChaimDynamoDBBinder(this, 'UserSchema', {
  schemaPath: './schemas/user.bprint',
  table,
  appId: 'my-app',
  credentials: ChaimCredentials.fromSecretsManager('chaim/api-credentials'),
});

// Using direct credentials with STRICT mode (rolls back on failure)
new ChaimDynamoDBBinder(this, 'UserSchema', {
  schemaPath: './schemas/user.bprint',
  table,
  appId: 'my-app',
  credentials: ChaimCredentials.fromApiKeys(
    process.env.CHAIM_API_KEY!,
    process.env.CHAIM_API_SECRET!
  ),
  failureMode: FailureMode.STRICT,
});
```

### ChaimDynamoDBBinderProps

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `schemaPath` | string | Yes | Path to `.bprint` schema file |
| `table` | `ITable` | Yes | DynamoDB table to bind |
| `appId` | string | Yes | Application ID for Chaim SaaS |
| `credentials` | `IChaimCredentials` | Yes | API credentials (use `ChaimCredentials` factory) |
| `failureMode` | `FailureMode` | No | Default: `BEST_EFFORT` |

### ChaimCredentials Factory

Use the `ChaimCredentials` factory to configure API credentials:

```typescript
// Secrets Manager (recommended for production)
ChaimCredentials.fromSecretsManager('chaim/api-credentials')

// Direct API keys (for development/testing)
ChaimCredentials.fromApiKeys(apiKey, apiSecret)
```

### Secrets Manager Secret Shape

```json
{
  "apiKey": "your-chaim-api-key",
  "apiSecret": "your-chaim-api-secret"
}
```

## Cross-Repo Contract Compatibility

All provider-specific ingestion clients (AWS CDK, Terraform, Azure, GCP, on-prem) must implement the same Chaim ingest plane contract:

- `POST /ingest/upload-url`
- `PUT <presignedUrl>` (upload snapshot bytes)
- `POST /ingest/snapshot-ref` (commit pointer + metadata)

Required invariants:
- `eventId` is UUID v4 and commits are **idempotent by eventId**
- `contentHash` is SHA-256 of uploaded snapshot bytes
- Orchestrator response (e.g., CloudFormation) must remain **small** (eventId + status only)
- Auth must be enforced consistently (credentials + signing)


## SaaS Ingestion Flow (Agent Contract)

### Goal
On every CloudFormation Create/Update/Delete, publish a snapshot of:
- `.bprint` schema intent
- DynamoDB table metadata
- stack context (account/region/stack identifiers)
to Chaim SaaS using AWS S3 presigned upload + pointer commit.

### Non-Goals

The chaim-cdk package does NOT:
- Perform runtime data access or interception
- Enforce data policies at request time
- Scan existing cloud infrastructure
- Mutate customer data stores beyond declared CDK resources
- Persist customer data outside of Chaim ingestion workflows


### Inputs (from CDK props / environment)
- appId (required)
- credentials (apiKey/apiSecret or Secrets Manager ref) (required)
- schemaPath (required)
- DynamoDB table ref (required)
- failureMode: FailureMode.BEST_EFFORT (default) | FailureMode.STRICT

### Outputs (to CloudFormation response)
- eventId (UUID v4)
- ingestStatus: ACCEPTED | FAILED_BEST_EFFORT | FAILED_STRICT

### Sequence (runtime during CFN deployment)
1. Collect metadata: tableName/tableArn/keys/indexes/ttl/streams/encryption + stack account/region/stackId/stackName
2. Load + validate `.bprint` (must pass `@chaim-tools/chaim-bprint-spec`)
3. Build snapshot payload:
   - eventId = UUID v4
   - contentHash = SHA-256(snapshot bytes)
4. Request presigned upload URL:
   - POST /ingest/upload-url (auth required)
5. Upload snapshot:
   - PUT <presignedUrl> (bytes)
6. Commit snapshot reference:
   - POST /ingest/snapshot-ref (eventId + contentHash + s3 bucket/key + metadata)
7. Respond to CloudFormation:
   - STRICT: fail on any error in steps 4–6
   - BEST_EFFORT: always succeed stack; set ingestStatus accordingly

### Invariants (must/never)
- MUST NOT send large snapshots inline to CloudFormation or API Gateway.
- MUST NOT log credentials or secrets.
- MUST return a small CFN response only (eventId + ingestStatus).
- MUST be idempotent by eventId (safe on retries).
- MUST treat duplicate eventId submissions as safe no-ops (idempotent ingest).

### Failure Modes

| Mode | Behavior |
|------|----------|
| `BEST_EFFORT` (default) | Log errors, return SUCCESS to CloudFormation |
| `STRICT` | Return FAILED to CloudFormation on any ingestion error |

---

## Snapshot Locations

All snapshots are written to a standardized directory structure under `cdk.out/chaim/snapshots/`:

```
cdk.out/chaim/snapshots/
├── preview/                    # Synth-time snapshots
│   └── <stackName>.json       # e.g., MyStack.json
└── registered/                 # Deploy-time snapshots  
    └── <stackName>-<eventId>.json  # e.g., MyStack-550e8400-e29b-41d4-a716-446655440000.json
```

### Snapshot Modes

| Mode | When Created | Contains | Purpose |
|------|--------------|----------|---------|
| `PREVIEW` | `cdk synth` | schema, dataStore, context, capturedAt | Local development, code generation without deploy |
| `REGISTERED` | `cdk deploy` | All preview fields + eventId, contentHash | Production tracking, audit trail |

### File Naming

- **Preview**: `preview/<stackName>.json` (single file, overwritten on each synth)
- **Registered**: `registered/<stackName>-<eventId>.json` (new file per deploy, UUID v4 suffix)

### Usage with chaim-cli

The CLI reads snapshots from this directory to generate SDKs:

```bash
# Preview workflow (no deploy needed)
cdk synth
chaim generate --mode preview

# Registered workflow (after deploy)
cdk deploy
chaim generate --mode registered
```

---

## DynamoDB Metadata Captured

| Field | Description |
|-------|-------------|
| `tableName` | Table name |
| `tableArn` | Table ARN |
| `partitionKey` | Partition key attribute name |
| `sortKey` | Sort key attribute name (if composite key) |
| `globalSecondaryIndexes` | GSI configurations (name, keys, projection) |
| `localSecondaryIndexes` | LSI configurations (name, sort key, projection) |
| `ttlAttribute` | TTL attribute name (if enabled) |
| `streamEnabled` | Whether DynamoDB Streams is enabled |
| `streamViewType` | Stream view type (NEW_IMAGE, OLD_IMAGE, etc.) |
| `billingMode` | PAY_PER_REQUEST or PROVISIONED |
| `encryptionKeyArn` | KMS key ARN (if encrypted) |

---

## Package Exports

```typescript
// Main construct
export { ChaimDynamoDBBinder, ChaimDynamoDBBinderProps } from './binders/chaim-dynamodb-binder';

// Base class (for extension)
export { BaseChaimBinder } from './binders/base-chaim-binder';

// Credentials factory
export { ChaimCredentials, IChaimCredentials } from './types/credentials';

// Failure mode enum
export { FailureMode } from './types/failure-mode';

// Types
export { BaseBinderProps } from './types/base-binder-props';
export { DynamoDBMetadata, DataStoreMetadata } from './types/data-store-metadata';

// Snapshot types (dual-mode support)
export {
  SnapshotPayload,           // Union type: PreviewSnapshotPayload | RegisteredSnapshotPayload
  SnapshotMode,              // 'PREVIEW' | 'REGISTERED'
  StackContext,
  BaseSnapshotPayload,       // Shared fields
  PreviewSnapshotPayload,    // Synth-time payload (no eventId/contentHash)
  RegisteredSnapshotPayload, // Deploy-time payload (includes eventId/contentHash)
  isPreviewSnapshot,         // Type guard
  isRegisteredSnapshot,      // Type guard
} from './types/snapshot-payload';

// Snapshot path utilities
export {
  getBaseSnapshotDir,        // Returns cdk.out/chaim/snapshots
  getModeDir,                // Returns base/preview or base/registered
  getPreviewSnapshotPath,    // Returns path for preview snapshot
  getRegisteredSnapshotPath, // Returns path for registered snapshot
  writePreviewSnapshot,      // Writes preview snapshot to disk
  writeRegisteredSnapshot,   // Writes registered snapshot to disk
} from './services/snapshot-paths';

// Services
export { SchemaService } from './services/schema-service';
export { IngestionService } from './services/ingestion-service';

// Re-exports from bprint-spec
export { SchemaData, Entity, Field, PrimaryKey } from '@chaim-tools/chaim-bprint-spec';
```

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm test` | Run test suite |
| `pnpm lint` | Run ESLint |
| `pnpm clean` | Clean build artifacts |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/binders/base-chaim-binder.ts` | Abstract base class with shared ingestion logic |
| `src/binders/chaim-dynamodb-binder.ts` | DynamoDB-specific implementation |
| `src/types/base-binder-props.ts` | Shared props interface (credentials, appId) |
| `src/types/data-store-metadata.ts` | Metadata types per data store |
| `src/types/snapshot-payload.ts` | Ingestion payload structure |
| `src/services/schema-service.ts` | Schema loading and validation |
| `src/services/ingestion-service.ts` | API configuration and utilities |
| `src/services/snapshot-paths.ts` | Snapshot file path utilities |

---

## Integration with chaim-bprint-spec

The chaim-cdk depends on `@chaim-tools/chaim-bprint-spec` for:

1. **TypeScript Types**: `SchemaData`, `Entity`, `Field`, `FieldConstraints`
2. **Schema Validation**: `validateSchema()` function
3. **Re-exports**: Types are re-exported for consumer convenience

```typescript
import { validateSchema, SchemaData } from '@chaim-tools/chaim-bprint-spec';

const schemaData: SchemaData = validateSchema(rawSchema);
```

---

## Integration with chaim-cli

The chaim-cli consumes snapshot files produced by this package:

1. **Snapshot Discovery**: CLI looks in `cdk.out/chaim/snapshots/{preview|registered}/`
2. **Mode Selection**: CLI supports `--mode preview|registered|auto`
3. **Code Generation**: CLI reads schema + dataStore metadata from snapshots to generate SDKs

**Contract**: Snapshots must include:
- `snapshotMode`: `'PREVIEW'` or `'REGISTERED'`
- `capturedAt`: ISO 8601 timestamp
- `schema`: Validated `.bprint` schema data
- `dataStore`: Data store metadata (DynamoDB config, etc.)
- `context`: Stack context (account, region, stackName, stackId)

**Registered-only fields**:
- `eventId`: UUID v4
- `contentHash`: SHA-256 of payload

---

## Future Extensibility

The architecture supports adding new data store binders:

1. Create new class extending `BaseChaimBinder`
2. Implement `extractMetadata()` with store-specific logic
3. Define props interface extending `BaseBinderProps`
4. Add metadata type to `DataStoreMetadata` union

**Planned future binders:**
- `ChaimAuroraBinder` - Aurora PostgreSQL/MySQL clusters
- `ChaimRDSBinder` - RDS instances
- `ChaimDocumentDBBinder` - DocumentDB clusters
- `ChaimS3Binder` - S3 Object

---

## IAM Permissions

### Lambda Execution Role

- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- `secretsmanager:GetSecretValue` (if using Secrets Manager)

### Network Requirements

- Outbound HTTPS to Chaim API endpoints
- Outbound HTTPS to AWS S3 presigned URLs

---

**Note**: This document reflects the Chaim SaaS integration architecture. All binders require Chaim API credentials and publish to the Chaim platform via S3 presigned upload.
