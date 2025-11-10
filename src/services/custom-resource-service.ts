import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ChaimBinderProps } from '../types/chaim-binder-props';

export class CustomResourceService {
  /**
   * Creates a custom resource for Chaim schema binding
   */
  public static createCustomResource(
    scope: Construct,
    props: ChaimBinderProps,
    handler: lambda.Function,
    enhancedDataStore: string
  ): cr.AwsCustomResource {
    const isSaaSMode = this.isSaaSMode(props);
    
    return new cr.AwsCustomResource(scope, 'ChaimBinderResource', {
      onCreate: this.createAction('Create', handler, props, enhancedDataStore, isSaaSMode),
      onUpdate: this.createAction('Update', handler, props, enhancedDataStore, isSaaSMode),
      onDelete: this.createAction('Delete', handler, props, enhancedDataStore, isSaaSMode),
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
  }

  /**
   * Grants necessary permissions to the custom resource
   */
  public static grantPermissions(
    customResource: cr.AwsCustomResource,
    handler: lambda.Function
  ): void {
    customResource.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [handler.functionArn],
      })
    );
  }

  /**
   * Determines if the construct is running in SaaS mode (with API credentials)
   */
  private static isSaaSMode(props: ChaimBinderProps): boolean {
    return !!(props.apiKey && props.apiSecret && props.appId);
  }

  private static createAction(
    actionType: 'Create' | 'Update' | 'Delete',
    handler: lambda.Function,
    props: ChaimBinderProps,
    enhancedDataStore: string,
    isSaaSMode: boolean
  ): cr.AwsCustomResourceProps['onCreate'] | cr.AwsCustomResourceProps['onUpdate'] | cr.AwsCustomResourceProps['onDelete'] {
    const basePayload: any = {
      RequestType: actionType,
      ResourceProperties: {
        SchemaContent: enhancedDataStore,
        TableArn: props.table.tableArn,
        TableName: props.table.tableName,
      },
    };

    // Add SaaS-specific properties only in SaaS mode
    if (isSaaSMode) {
      basePayload.ResourceProperties.AppId = props.appId;
    }

    return {
      service: 'Lambda',
      action: 'invoke',
      parameters: {
        FunctionName: handler.functionName,
        Payload: JSON.stringify(basePayload),
      },
      physicalResourceId: cr.PhysicalResourceId.of(
        isSaaSMode ? `${props.appId}-${Date.now()}` : `oss-${Date.now()}`
      ),
    };
  }
}
