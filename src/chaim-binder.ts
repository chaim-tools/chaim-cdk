import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ChaimBinderProps } from './types/chaim-binder-props';
import { PropsValidator } from './validators/props-validator';
import { SchemaService } from './services/schema-service';
import { TableMetadataService } from './services/table-metadata-service';
import { LambdaService } from './services/lambda-service';
import { CustomResourceService } from './services/custom-resource-service';

export class ChaimBinder extends Construct {
  public readonly mode: 'oss' | 'saas';

  constructor(scope: Construct, id: string, props: ChaimBinderProps) {
    super(scope, id);

    // Validate props
    PropsValidator.validate(props);

    // Determine mode based on provided credentials
    this.mode = this.determineMode(props);

    // Load and validate schema
    const schemaData = SchemaService.readSchema(props.schemaPath);

    // Extract and validate table metadata
    const tableMetadata = TableMetadataService.validateAndExtract(props.table, this);

    if (this.mode === 'saas') {
      // SaaS Mode: Deploy Lambda + Custom Resource for external API integration
      const enhancedDataStore = this.createEnhancedDataStore(schemaData, tableMetadata);
      const handler = LambdaService.createHandler(this, props, enhancedDataStore);
      CustomResourceService.createCustomResource(this, props, handler, enhancedDataStore);
    }
    // Create outputs for chaim-cli consumption
    this.createOSSOutputs(schemaData, tableMetadata);
  }

  private determineMode(props: ChaimBinderProps): 'oss' | 'saas' {
    // Use the same logic as PropsValidator.isSaaSMode
    const hasAnyCredentials = props.apiKey || props.apiSecret || props.appId;
    return hasAnyCredentials ? 'saas' : 'oss';
  }

  /**
   * Creates an enhanced data store that combines schema data with table metadata
   * Only used in SaaS mode
   */
  private createEnhancedDataStore(schemaData: any, tableMetadata: any): string {
    const enhancedDataStore = {
      ...schemaData,
      table_metadata: tableMetadata.toJSON(),
    };
    return JSON.stringify(enhancedDataStore);
  }

  /**
   * Creates CloudFormation outputs for OSS mode
   * These outputs can be consumed by chaim-cli or other tools
   */
  private createOSSOutputs(schemaData: any, tableMetadata: any): void {
    new cdk.CfnOutput(this, 'SchemaData', {
      value: JSON.stringify(schemaData),
      description: 'Processed schema data for chaim-cli consumption',
      exportName: `${this.node.id}-SchemaData`,
    });

    new cdk.CfnOutput(this, 'TableMetadata', {
      value: JSON.stringify(tableMetadata.toJSON()),
      description: 'Table metadata for chaim-cli consumption',
      exportName: `${this.node.id}-TableMetadata`,
    });

    new cdk.CfnOutput(this, 'Mode', {
      value: 'oss',
      description: 'ChaimBinder operating mode',
      exportName: `${this.node.id}-Mode`,
    });
  }
}
