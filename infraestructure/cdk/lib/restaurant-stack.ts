import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './constructs/database';
import { EventBusConstruct } from './constructs/event-bus';
import { LambdaServicesConstruct } from './constructs/lambda-services';
import { ApiGatewayConstruct } from './constructs/api-gateway';

export class RestaurantStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ============================================================
    // 1. Create Database (RDS PostgreSQL)
    // ============================================================
    const database = new DatabaseConstruct(this, 'Database');

    // ============================================================
    // 2. Create Event Bus (SNS Topics + SQS Queues)
    // ============================================================
    const eventBus = new EventBusConstruct(this, 'EventBus');

    // ============================================================
    // 3. Create Lambda Services
    // ============================================================
    const lambdaServices = new LambdaServicesConstruct(this, 'LambdaServices', {
      queues: eventBus.output.queues,
      snsTopic: eventBus.output.topics.OrderCreated, // Main topic for publishing
      dbHost: database.output.host,
      dbPort: database.output.port,
      dbUsername: database.output.username,
      dbIamUsername: database.output.iamUsername,
      dbInstanceResourceId: database.output.instanceResourceId,
      dbPasswordSecret: database.output.passwordSecret,
    });

    // ============================================================
    // 4. Create API Gateway
    // ============================================================
    const apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
      orderServiceLambda: lambdaServices.output.orderServiceLambda,
    });

    // ============================================================
    // Stack-level Outputs
    // ============================================================
    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'Stack name',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: apiGateway.output.endpoint,
      description: 'Restaurant API Endpoint (Order Service)',
      exportName: 'RestaurantApiEndpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseHost', {
      value: database.output.host,
      description: 'Database Host',
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: String(database.output.port),
      description: 'Database Port',
    });
  }
}
