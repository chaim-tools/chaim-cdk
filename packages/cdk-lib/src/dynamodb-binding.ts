import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_dynamodb as ddb } from 'aws-cdk-lib';

export interface ChaimDynamoBindingProps {
  appId: string;
  table: ddb.ITable;

  /** Path to a .bprint file (JSON or YAML). Read at synth-time. */
  schemaPath?: string;

  /** Or provide the schema inline (object or JSON string). */
  schemaInline?: unknown;

  /** Max bytes allowed for inline schema in pilot to keep payloads small. */
  maxSchemaBytes?: number; // default ~200 KB
}

export class ChaimDynamoBinding extends cdk.Resource {
  constructor(scope: Construct, id: string, p: ChaimDynamoBindingProps) {
    super(scope, id);

    if (!p.schemaPath && p.schemaInline === undefined) {
      throw new Error('Provide schemaPath or schemaInline');
    }

    // Resolve schema (prefer schemaPath if given)
    let schema: unknown;

    if (p.schemaPath) {
      const resolved = path.isAbsolute(p.schemaPath)
        ? p.schemaPath
        : path.join(process.cwd(), p.schemaPath);
      if (!fs.existsSync(resolved)) {
        throw new Error(`schemaPath not found: ${resolved}`);
      }
      const raw = fs.readFileSync(resolved, 'utf8');

      // Support JSON or YAML .bprint (simple heuristic)
      const isJson = resolved.endsWith('.json') || resolved.endsWith('.bprint.json');
      if (isJson) {
        schema = JSON.parse(raw);
      } else {
        // lightweight YAML parse without adding a dep here (optional):
        // If you prefer, add `yaml` as a dep and use YAML.parse(raw).
        try {
          const YAML = require('yaml');
          schema = YAML.parse(raw);
        } catch {
          throw new Error('YAML support requires the "yaml" package. Install it or use JSON.');
        }
      }
    } else {
      schema = p.schemaInline;
    }

    // Pilot guard-rail: keep inline payload reasonable
    const max = p.maxSchemaBytes ?? 200_000; // ~200 KB
    const size = Buffer.byteLength(
      typeof schema === 'string' ? schema : JSON.stringify(schema)
    );
    if (size > max) {
      throw new Error(
        `Schema is ${size} bytes, exceeds pilot max of ${max} bytes. ` +
        `Use a smaller schema for demo (prod will switch to S3 pointers).`
      );
    }

    // Emit the CFN Registry type with inline Schema
    new cdk.CfnResource(this, 'Resource', {
      type: 'Chaim::DynamoDB::Binding',
      properties: {
        AppId: p.appId,
        Target: { TableArn: p.table.tableArn },
        Schema: schema,
      },
    });
  }
}

