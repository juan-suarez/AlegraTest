import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiGatewayProps {
  orderServiceLambda: lambda.Function;
}

export interface ApiGatewayOutput {
  restApi: apigateway.RestApi;
  endpoint: string;
}

export class ApiGatewayConstruct extends Construct {
  public readonly output: ApiGatewayOutput;

  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    // Create REST API
    const restApi = new apigateway.RestApi(this, 'RestaurantApi', {
      restApiName: 'restaurant-service-api',
      description: 'API Gateway for Restaurant Event-Driven System',
      deploy: true,
      deployOptions: {
        stageName: 'prod',
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Create root resource proxy for all HTTP methods
    // This allows the Order Service Lambda to handle all routes
    const resource = restApi.root.addResource('{proxy+}');

    // Integrate with Lambda using proxy integration
    resource.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(props.orderServiceLambda, {
        proxy: true,
      }),
    );

    // Also add integration for root path
    restApi.root.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(props.orderServiceLambda, {
        proxy: true,
      }),
    );

    // Lambda permissions to be invoked by API Gateway
    props.orderServiceLambda.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${restApi.restApiId}/*/*`,
    });

    this.output = {
      restApi,
      endpoint: restApi.url,
    };

  }
}
