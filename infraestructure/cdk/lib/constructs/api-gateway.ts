import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiGatewayProps {
  orderServiceLambda: lambda.Function;
  inventoryServiceLambda: lambda.Function;
  purchasingServiceLambda: lambda.Function;
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

    // ========================================
    // ORDER SERVICE - Proxy for all orders routes
    // ========================================
    const ordersResource = restApi.root.addResource('orders');
    ordersResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.orderServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
      }
    );

    ordersResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(props.orderServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
      }
    );

    // ========================================
    // INVENTORY SERVICE - Inventory endpoints
    // ========================================
    const inventoryResource = restApi.root.addResource('inventory');

    // GET /inventory/ingredients
    const ingredientsResource = inventoryResource.addResource('ingredients');
    ingredientsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.inventoryServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
      }
    );

    // GET /inventory/ingredients/{ingredientId}
    const ingredientIdResource = ingredientsResource.addResource('{ingredientId}');
    ingredientIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.inventoryServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
      }
    );

    // GET /inventory/reservations
    const reservationsResource = inventoryResource.addResource('reservations');
    reservationsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.inventoryServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
      }
    );

    // ========================================
    // PURCHASING SERVICE - Purchases endpoints
    // ========================================
    const purchasesResource = restApi.root.addResource('purchases');

    // GET /purchases
    purchasesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.purchasingServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
      }
    );

    // GET /purchases/stats
    const statsResource = purchasesResource.addResource('stats');
    statsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.purchasingServiceLambda, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
      }
    );

    // Grant Lambda permissions
    props.orderServiceLambda.addPermission('ApiGatewayInvokeOrders', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${restApi.restApiId}/*/*`,
    });

    props.inventoryServiceLambda.addPermission('ApiGatewayInvokeInventory', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${restApi.restApiId}/*/*`,
    });

    props.purchasingServiceLambda.addPermission('ApiGatewayInvokePurchasing', {
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
