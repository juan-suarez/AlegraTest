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
  apiKey: apigateway.ApiKey;
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
          'x-api-key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Create API Key
    const apiKey = new apigateway.ApiKey(this, 'RestaurantApiKey', {
      apiKeyName: 'restaurant-api-key',
      description: 'API Key for Restaurant Service',
      enabled: true,
    });

    // Create Usage Plan with rate limiting and quotas
    const usagePlan = new apigateway.UsagePlan(this, 'RestaurantUsagePlan', {
      name: 'restaurant-usage-plan',
      description: 'Usage plan for Restaurant API',
      throttle: {
        rateLimit: 100,       // 100 requests per second
        burstLimit: 200,      // Burst capacity
      },
      quota: {
        limit: 10000,         // 10,000 requests per day
        period: apigateway.Period.DAY,
      },
      apiStages: [
        {
          api: restApi,
          stage: restApi.deploymentStage,
        },
      ],
    });

    // Associate API Key with Usage Plan
    usagePlan.addApiKey(apiKey);

    // Create root resource proxy for all HTTP methods
    // This allows the Order Service Lambda to handle all routes
    const resource = restApi.root.addResource('{proxy+}');

    // Integrate with Lambda using proxy integration - REQUIRE API KEY
    resource.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(props.orderServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,  // Require API Key
      }
    );

    // Also add integration for root path - REQUIRE API KEY
    restApi.root.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(props.orderServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,  // Require API Key
      }
    );

    // Lambda permissions to be invoked by API Gateway
    props.orderServiceLambda.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${restApi.restApiId}/*/*`,
    });

    // Output API Key value
    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID',
    });

    this.output = {
      restApi,
      endpoint: restApi.url,
      apiKey,
    };

  }
}
