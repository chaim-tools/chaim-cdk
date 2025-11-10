import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { TableMetadata } from '../types/table-metadata';

export class TableMetadataService {
  /**
   * Validates and extracts metadata from a DynamoDB table
   */
  public static validateAndExtract(table: dynamodb.ITable, scope: Construct): TableMetadata {
    this.validateTable(table);
    return this.extractMetadata(table, scope);
  }

  private static validateTable(table: dynamodb.ITable): void {
    if (!table) {
      throw new Error('Table is required');
    }

    if (!(table instanceof dynamodb.Table)) {
      throw new Error('Table must be a concrete DynamoDB Table construct');
    }

    if (!table.tableName) {
      throw new Error('Table must have a valid table name');
    }

    if (!table.tableArn) {
      throw new Error('Table must have a valid table ARN');
    }
  }

  private static extractMetadata(table: dynamodb.ITable, scope: Construct): TableMetadata {
    const stack = cdk.Stack.of(scope);
    
    // Extract partition key and sort key from the table's CloudFormation resource
    let partitionKey: string;
    let sortKey: string | undefined;
    
    if (table instanceof dynamodb.Table) {
      // Access the CloudFormation resource to get key schema
      const cfnTable = table.node.defaultChild as dynamodb.CfnTable;
      if (!cfnTable) {
        throw new Error('Cannot access CloudFormation resource for table');
      }
      
      // Extract partition key (always present)
      const keySchema = cfnTable.keySchema;
      if (!keySchema) {
        throw new Error('Table must have a key schema');
      }
      
      // Handle both IResolvable and array types
      if (Array.isArray(keySchema)) {
        if (keySchema.length === 0) {
          throw new Error('Table must have a key schema');
        }
        
        // Type guard: check if first element is a KeySchemaProperty
        const firstKey = keySchema[0];
        if (firstKey && typeof firstKey === 'object' && 'attributeName' in firstKey) {
          partitionKey = firstKey.attributeName;
        } else {
          throw new Error('Cannot extract partition key from table key schema');
        }
        
        // Extract sort key if present (second key in schema)
        if (keySchema.length > 1) {
          const secondKey = keySchema[1];
          if (secondKey && typeof secondKey === 'object' && 'attributeName' in secondKey) {
            sortKey = secondKey.attributeName;
          }
        }
      } else {
        // If it's IResolvable, we can't extract it at synthesis time
        // This shouldn't happen for concrete tables, but handle it gracefully
        throw new Error('Cannot extract key schema from unresolved table properties');
      }
    } else {
      // For imported tables, we can't easily get the key schema
      // This is a limitation, but we'll throw an error for now
      throw new Error('Cannot extract key schema from imported table. Use a concrete Table construct.');
    }
    
    return new TableMetadata(
      table.tableName,
      table.tableArn,
      stack.region,
      stack.account,
      partitionKey,
      table.encryptionKey?.keyArn,
      sortKey
    );
  }
}
