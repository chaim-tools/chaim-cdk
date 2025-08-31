import * as cdk from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { TableMetadata } from './types/table-metadata';
import { SchemaService, SchemaData } from './services/schema-service';
import { TableMetadataService } from './services/table-metadata-service';
import { LambdaService } from './services/lambda-service';
import { CustomResourceService } from './services/custom-resource-service';
import { PropsValidator } from './validators/props-validator';
import { ChaimBinderProps } from './types/chaim-binder-props';

export { ChaimBinderProps } from './types/chaim-binder-props';

/**
 * L2 construct that binds a DynamoDB table with a Chaim schema.
 * 
 * This construct creates a CloudFormation Custom Resource that registers
 * the schema with the Chaim SaaS platform, linking the table metadata
 * with the schema definition.
 */
export class ChaimBinder extends Construct {
  public readonly customResource: cr.AwsCustomResource;
  public readonly table: dynamodb.ITable;

  constructor(scope: Construct, id: string, props: ChaimBinderProps) {
    super(scope, id);

    // Validate all input properties
    PropsValidator.validate(props);

    // Load and validate schema
    const schemaData = SchemaService.validateAndLoad(props.schemaPath);

    // Extract and validate table metadata
    const tableMetadata = TableMetadataService.validateAndExtract(props.table, this);

    // Create enhanced data store combining schema and table metadata
    const enhancedDataStore = this.createEnhancedDataStore(schemaData, tableMetadata);

    // Create Lambda handler for custom resource
    const handler = LambdaService.createHandler(this, props, enhancedDataStore);

    // Create custom resource
    this.customResource = CustomResourceService.createCustomResource(
      this,
      props,
      handler,
      enhancedDataStore
    );

    // Grant necessary permissions
    CustomResourceService.grantPermissions(this.customResource, handler);

    // Store table reference
    this.table = props.table;
  }

  /**
   * Creates an enhanced data store that combines schema data with table metadata
   */
  private createEnhancedDataStore(schemaData: SchemaData, tableMetadata: TableMetadata): string {
    const enhancedDataStore = {
      ...schemaData,
      table_metadata: tableMetadata.toJSON(),
    };
    return JSON.stringify(enhancedDataStore);
  }
}
