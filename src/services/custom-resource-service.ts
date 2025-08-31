import * as cdk from 'aws-cdk-lib';
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
    return new cr.AwsCustomResource(scope, 'ChaimBinderResource', {
      onCreate: this.createAction('Create', handler, props, enhancedDataStore),
      onUpdate: this.createAction('Update', handler, props, enhancedDataStore),
      onDelete: this.createAction('Delete', handler, props, enhancedDataStore),
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

  private static createAction(
    actionType: 'Create' | 'Update' | 'Delete',
    handler: lambda.Function,
    props: ChaimBinderProps,
    enhancedDataStore: string
  ): cr.AwsCustomResourceProps['onCreate'] | cr.AwsCustomResourceProps['onUpdate'] | cr.AwsCustomResourceProps['onDelete'] {
    return {
      service: 'Lambda',
      action: 'invoke',
      parameters: {
        FunctionName: handler.functionName,
        Payload: JSON.stringify({
          RequestType: actionType,
          ResourceProperties: {
            SchemaContent: enhancedDataStore,
            AppId: props.appId,
            TableArn: props.table.tableArn,
            TableName: props.table.tableName,
          },
        }),
      },
      physicalResourceId: cr.PhysicalResourceId.of(`${props.appId}-${Date.now()}`),
    };
  }
}
