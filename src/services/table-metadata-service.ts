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
    
    return new TableMetadata(
      table.tableName,
      table.tableArn,
      stack.region,
      stack.account,
      table.encryptionKey?.keyArn
    );
  }
}
