# AI Agent Context: chaim-cdk

**Purpose**: Structured context for AI agents to understand and work with the chaim-cdk codebase.

**Package**: `@chaim-tools/cdk-lib`  
**Version**: 0.1.0  
**License**: Apache-2.0

---

## Project Overview

The chaim-cdk is a **pnpm monorepo** containing AWS CDK L2 constructs for binding data stores to Chaim schemas. It captures schema and metadata at **synth time** (LOCAL snapshot) and publishes to the **Chaim SaaS platform** at **deploy time** (PUBLISHED).

> **Mental model (LOCAL + PUBLISHED)**:
> - **LOCAL snapshot**: Written during synthesis (runs for both `cdk synth` and `cdk deploy`). Stored in OS cache. Used by CLI for code generation.
> - **PUBLISHED snapshot**: Sent to Chaim SaaS at deploy-time by the Lambda custom resource. Contains `eventId` and `contentHash` for audit/tracking.
> 
> The CDK construct is never part of the application runtime path.

### Key Capabilities

- **ChaimDynamoDBBinder**: CDK construct for binding DynamoDB tables to `.bprint` schemas
- **LOCAL Snapshots**: Written to OS cache during synth for CLI consumption
- **PUBLISHED Snapshots**: Sent to Chaim SaaS at deploy-time via Lambda custom resource
- **Extensible Architecture**: Abstract base class supports future data store types (e.g., RDS, Object)
- **Large Payload Support**: S3 presigned upload avoids API Gateway payload limits
- **Schema Validation**: Validates `.bprint` files using `@chaim-tools/chaim-bprint-spec`
- **Metadata Capture**: Captures schema, resource configuration (keys, indexes, TTL, streams, encryption), and cloud account details
- **Secure Ingestion**: API key authentication over HTTPS; credentials read from Secrets Manager at deploy time

> **Implementation status:** DynamoDB binder is production-ready. Aurora/RDS/DocumentDB binders are planned (see Coming Soon).

---

## Related Packages

| Package | Relationship | Purpose |
|---------|-------------|---------|
| `@chaim-tools/chaim-bprint-spec` | **Dependency** | Schema format definition, validation, TypeScript types |
| `chaim-cli` | **Consumer** | Reads LOCAL snapshot files from OS cache for SDK code generation |

**Data flow**:

```mermaid
flowchart TD
    %% Inputs
    A[.bprint schema<br/>source of truth]

    %% Synth time
    subgraph Synth[CDK Synthesis Phase]
        A --> B[chaim-cdk<br/>validate schema<br/>extract metadata]
        B --> C[Build LOCAL snapshot<br/>schema and resource metadata]
        C --> D[Write LOCAL snapshot<br/>OS cache path]
        C --> E[Write snapshot.json<br/>CDK asset directory<br/>cdk.out/chaim/assets]
    end

    %% CLI usage
    subgraph CLI[Developer Workflow]
        D --> F[chaim-cli<br/>discover snapshots]
        F --> G[Generate SDK<br/>DTOs and mappers]
    end

    %% Deploy time - CFN triggers Lambda
    subgraph Deploy[CDK Deploy Phase]
        E --> H[Custom Resource Lambda<br/>triggered by CloudFormation]
        H --> CFN{CFN Request Type?}
    end

    %% CREATE/UPDATE path (identical flow, both use UPSERT)
    subgraph UpsertFlow[CREATE / UPDATE Flow]
        CFN -->|Create or Update| U1[Read full snapshot.json<br/>from bundled asset]
        U1 --> U2[Generate eventId<br/>compute contentHash]
        U2 --> U3[POST /ingest/upload-url<br/>get presigned S3 URL]
        U3 --> U4[PUT snapshot bytes<br/>to presigned URL]
        U4 --> U5[POST /ingest/snapshot-ref<br/>action: UPSERT]
    end

    %% DELETE path
    subgraph DeleteFlow[DELETE Flow]
        CFN -->|Delete| D1[Read minimal metadata<br/>from bundled asset]
        D1 --> D2[Generate eventId<br/>for delete event]
        D2 --> D3[POST /ingest/snapshot-ref<br/>action: DELETE]
    end

    %% SaaS interactions
    subgraph SaaS[Chaim SaaS Platform]
        U3 --> S1[S3 Snapshot storage]
        U4 --> S1
        U5 --> S2[Binding registry<br/>audit and lineage]
        D3 --> S2
    end

    %% CFN responses
    U5 --> R[Respond to CloudFormation<br/>based on FailureMode]
    D3 --> R
```

**Data Flow Summary by Operation:**

| Operation | S3 Upload | API Calls | Action |
|-----------|-----------|-----------|--------|
| **CREATE / UPDATE** | ✅ Full snapshot | `/ingest/upload-url` → `/ingest/snapshot-ref` | `UPSERT` |
| **DELETE** | ❌ No upload | `/ingest/snapshot-ref` only | `DELETE` |


## Scope

This repository (`chaim-cdk`) is the **AWS CDK (CloudFormation) implementation** of Chaim ingestion.

- It is intentionally **AWS-specific** (DynamoDB, CloudFormation Custom Resource, Secrets Manager, S3 presigned URLs).
- Other cloud providers and on-prem deployment integrations will live in **separate repositories**.
- All provider repos must remain **contract-compatible** with the Chaim ingest plane:
  - POST /ingest/upload-url → PUT snapshot bytes → POST /ingest/snapshot-ref
  - resourceId + contentHash deduplication
  - authenticated requests (API key credentials)

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

| Directory | Purpose |
|-----------|---------|
| `src/binders/` | CDK constructs - base class and data store implementations |
| `src/lambda-handler/` | Canonical Lambda handler for deploy-time ingestion |
| `src/services/` | Utilities for schema loading, caching, and path resolution |
| `src/types/` | TypeScript interfaces and type definitions |
| `src/config/` | API endpoints and configuration constants |
| `packages/cdk-lib/` | Published npm package |
| `example/` | Usage examples and sample `.bprint` schemas |
| `test/` | Unit and integration tests |

> See **Key Files Reference** section below for specific file details.

---

## Architecture

### Lambda Handler (Canonical Implementation)

The ingestion Lambda handler is located at `src/lambda-handler/handler.js`. This is the **single source of truth** for the ingestion workflow.

**Key characteristics:**
- Written in JavaScript (no compilation during synth)
- Reads `./snapshot.json` from bundled asset directory
- Generates `eventId` (UUID v4) at runtime
- Computes `contentHash` (SHA-256 of snapshot bytes)
- Implements presigned upload flow

**Ingestion Flow (Create/Update):**
1. Read snapshot.json from bundled asset
2. Generate eventId using `crypto.randomUUID()`
3. Compute contentHash as SHA-256 of snapshot bytes
4. POST `/ingest/upload-url` → get presigned S3 URL
5. PUT snapshot bytes to presigned URL
6. POST `/ingest/snapshot-ref` with action: 'UPSERT'

**Ingestion Flow (Delete):**
1. Read minimal metadata from snapshot.json
2. Generate eventId using `crypto.randomUUID()`
3. POST `/ingest/snapshot-ref` with action: 'DELETE'

### Extensible Base Class Design

```
BaseChaimBinder (abstract)
├── extractMetadata()           # Abstract - implemented by subclasses
├── buildLocalSnapshot()        # Synth-time: builds LOCAL payload for CLI
├── writeLocalSnapshotToDisk()  # Writes to OS cache (~/.chaim/cache/snapshots/)
├── writeSnapshotAsset()        # Writes to cdk.out/chaim/assets/ for Lambda bundling
├── deployIngestionResources()  # Shared - Lambda + custom resource for deploy-time
│
└── ChaimDynamoDBBinder (concrete)
    └── extractMetadata()       # DynamoDB-specific metadata extraction

Future extensions (not yet implemented):
├── ChaimAuroraBinder
├── ChaimRDSBinder
└── ChaimDocumentDBBinder
```

### Credential Security Model

> **Synth never reads secret values.** The Secret ARN/name is captured as a reference only. The deploy-time Lambda reads Secrets Manager and signs outbound API requests. No credentials are logged or included in synthesized templates/assets.

| Phase | Credential Handling |
|-------|---------------------|
| **Synth** | Captures Secret ARN reference only; no secret values read |
| **Deploy** | Lambda reads Secrets Manager, signs API requests |

### Snapshot Creation Flow

**During `cdk synth` or `cdk deploy` (constructor execution):**
1. Validate credential reference (ARN/name format, not secret value)
2. Load and validate `.bprint` schema
3. Extract data store metadata (subclass)
4. Compute stable resource key (physical name > logical ID > construct path)
5. Generate resourceId with collision handling: `{resourceName}__{entityName}[__N]`
6. **Write LOCAL snapshot** → OS cache (OVERWRITE on each synth)
7. **Write snapshot.json + handler.js** → `cdk.out/chaim/assets/{stackName}/{resourceId}/`
8. Deploy ingestion Lambda + custom resource (uses asset directory)

**During `cdk deploy` (Lambda execution):**
1. Lambda reads snapshot from bundled `./snapshot.json`
2. Generate `eventId` (UUID v4) at runtime
3. Compute `contentHash` = SHA-256(snapshot bytes)
4. POST /ingest/upload-url (get presigned URL)
5. PUT snapshot bytes to presigned URL
6. POST /ingest/snapshot-ref (commit)
7. Respond to CloudFormation based on FailureMode

---

## API Endpoints Configuration

### Default Base URL

The default Chaim API base URL is defined in `src/config/chaim-endpoints.ts`:

```typescript
export const DEFAULT_CHAIM_API_BASE_URL = 'https://api.chaim.co';
```

**Override via:**
- CDK context: `chaimApiBaseUrl`
- Environment variable: `CHAIM_API_BASE_URL`

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ingest/upload-url` | POST | Request presigned S3 upload URL |
| `/ingest/snapshot-ref` | POST | Commit snapshot reference (UPSERT or DELETE) |

---

## Snapshot Locations

### LOCAL Snapshots (OS Cache)

LOCAL snapshots are written to a **global OS cache** for CLI consumption. This allows the CLI to work from any directory without requiring access to the CDK project.

**Default locations:**
- macOS/Linux: `~/.chaim/cache/snapshots/`
- Windows: `%LOCALAPPDATA%/chaim/cache/snapshots/`

**Override:** Set `CHAIM_SNAPSHOT_DIR` environment variable.

**Directory Structure:**
```
~/.chaim/cache/snapshots/
└── aws/
    └── {accountId}/
        └── {region}/
            └── {stackName}/
                └── {datastoreType}/
                    └── {resourceId}.json
```

### Lambda Asset Directory (CDK Asset)

Lambda reads its snapshot from a bundled asset directory, **NOT** from environment variables or OS cache.

**Location:** `<cdkRoot>/cdk.out/chaim/assets/{stackName}/{resourceId}/`

**Contents:**
- `snapshot.json` - The snapshot payload
- `index.js` - Copy of canonical handler from `src/lambda-handler/handler.js`

This directory is discovered by walking up from the module to find `cdk.json`, not by using `process.cwd()`. Asset directories are **isolated per stack+resourceId** and **overwritten on each synth**.

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

---

## Usage with chaim-cli

The CLI reads LOCAL snapshots from the OS cache:

```bash
# Generate all entities (newest snapshot by capturedAt)
chaim generate --package com.example.model

# Filter by stack name
chaim generate --stack MyStack --package com.example.model

# Override snapshot directory
chaim generate --snapshot-dir /custom/path --package com.example.model
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

## SaaS Ingestion Flow (Agent Contract)

### Goal
On every CloudFormation Create/Update/Delete, notify Chaim SaaS:
- **Create/Update**: Upload full snapshot via S3 presigned URL + commit pointer
- **Delete**: Send minimal deactivation notification to mark the binding as inactive

### Non-Goals

The chaim-cdk package does NOT:
- Perform runtime data access or interception
- Enforce data policies at request time
- Scan existing cloud infrastructure
- Mutate customer data stores beyond declared CDK resources
- Persist customer data outside of Chaim ingestion workflows

### Sequence (runtime during CFN deployment)

**Create/Update (UPSERT):**
1. Lambda reads snapshot bytes from bundled `./snapshot.json`
2. Generate `eventId` (UUID v4) at runtime
3. Compute `contentHash` = SHA-256(snapshot bytes)
4. POST /ingest/upload-url (auth required) → get presigned S3 URL
5. PUT snapshot bytes to presigned URL
6. POST /ingest/snapshot-ref with `action: 'UPSERT'`
7. Respond to CloudFormation based on FailureMode

**Delete:**
1. Lambda reads minimal metadata from bundled `./snapshot.json`
2. Generate `eventId` (UUID v4) for the delete event
3. POST /ingest/snapshot-ref with `action: 'DELETE'`
4. Respond to CloudFormation based on FailureMode

### Invariants (must/never)
- MUST NOT send large snapshots inline to CloudFormation or API Gateway.
- MUST NOT log credentials or secrets.
- MUST return a small CFN response only (eventId + status).
- MUST be safe on CloudFormation retries.
- MUST store `eventId` in `PhysicalResourceId` and reuse on retry (same CFN RequestId = same eventId).

### Idempotency Model

| Key | Purpose | When Used |
|-----|---------|-----------|
| `resourceId + contentHash` | **Deduplication** - SaaS ignores uploads with identical content | Every UPSERT |
| `eventId` | **Audit trail** - Unique per CFN operation, stored in PhysicalResourceId | Tracking/lineage |
| `CloudFormation RequestId` | **Retry detection** - Same RequestId on retry triggers eventId reuse | CFN retries |

> **CloudFormation retry behavior:** On retry, the Lambda receives the same `RequestId`. The handler checks if `PhysicalResourceId` already contains an eventId and reuses it, ensuring the same eventId is submitted to SaaS. The SaaS treats duplicate eventId submissions as safe no-ops.

### Failure Modes

| Mode | Behavior |
|------|----------|
| `BEST_EFFORT` (default) | Log errors, return SUCCESS to CloudFormation |
| `STRICT` | Return FAILED to CloudFormation on any ingestion error |

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
| `src/lambda-handler/handler.js` | Canonical Lambda handler (presigned upload flow) |
| `src/binders/base-chaim-binder.ts` | Abstract base class with shared ingestion logic |
| `src/binders/chaim-dynamodb-binder.ts` | DynamoDB-specific implementation |
| `src/config/chaim-endpoints.ts` | Centralized API URLs and constants |
| `src/types/ingest-contract.ts` | API request/response type definitions |
| `src/types/snapshot-payload.ts` | LocalSnapshotPayload and legacy types |
| `src/types/credentials.ts` | ChaimCredentials factory class |
| `src/types/failure-mode.ts` | FailureMode enum definition |
| `src/services/os-cache-paths.ts` | OS cache directory utilities |
| `src/services/cdk-project-root.ts` | CDK project root discovery |
| `src/services/snapshot-paths.ts` | Snapshot file path utilities |
| `src/services/stable-identity.ts` | Stable identity and collision handling |
| `src/services/schema-service.ts` | Schema loading and validation |
| `src/services/ingestion-service.ts` | Ingestion service utilities |

---

## IAM Permissions

### Lambda Execution Role

- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- `secretsmanager:GetSecretValue` (if using Secrets Manager)

### Network Requirements

- Outbound HTTPS to Chaim API endpoints
- Outbound HTTPS to AWS S3 presigned URLs

---

**Note**: This document reflects the Chaim SaaS integration architecture. All binders require Chaim API credentials and publish to the Chaim platform via S3 presigned upload. LOCAL snapshots are written to the OS cache for CLI consumption.
