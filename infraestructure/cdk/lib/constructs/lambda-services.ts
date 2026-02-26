import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import path = require('path');

export interface LambdaServicesProps {
  queues: {
    orderServiceQueue: sqs.Queue;
    kitchenServiceQueue: sqs.Queue;
    inventoryServiceQueue: sqs.Queue;
    purchasingServiceQueue: sqs.Queue;
  };
  snsTopic: sns.Topic; // Main SNS topic for publishing events
  dbHost: string;
  dbPort: number;
  dbUsername: string;
  dbPasswordSecret: secretsmanager.ISecret;
}

export interface LambdaServicesOutput {
  orderServiceLambda: lambda.Function;
  kitchenServiceLambda: lambda.Function;
  inventoryServiceLambda: lambda.Function;
  purchasingServiceLambda: lambda.Function;
}

export class LambdaServicesConstruct extends Construct {
  public readonly output: LambdaServicesOutput;

  constructor(scope: Construct, id: string, props: LambdaServicesProps) {
    super(scope, id);

    // Create common IAM role for all Lambda functions
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant permissions to publish to SNS
    lambdaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: ['arn:aws:sns:*:*:*'],
      }),
    );

    // Grant permissions to read from SQS
    lambdaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:ReceiveMessage', 'sqs:ChangeMessageVisibility', 'sqs:DeleteMessage'],
        resources: [
          props.queues.orderServiceQueue.queueArn,
          props.queues.kitchenServiceQueue.queueArn,
          props.queues.inventoryServiceQueue.queueArn,
          props.queues.purchasingServiceQueue.queueArn,
        ],
      }),
    );

    // Grant permission to read database password from Secrets Manager
    props.dbPasswordSecret.grantRead(lambdaRole);

    // Order Service Lambda
    const orderServiceLambda = this.createServiceLambda(
      'OrderService',
      path.join(__dirname, '../../services/order-service'),
      props,
      lambdaRole,
      props.queues.orderServiceQueue,
    );

    // Add SQS event source
    orderServiceLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(props.queues.orderServiceQueue, {
        batchSize: 10,
      }),
    );

    // Kitchen Service Lambda
    const kitchenServiceLambda = this.createServiceLambda(
      'KitchenService',
      path.join(__dirname, '../../services/kitchen-service'),
      props,
      lambdaRole,
      props.queues.kitchenServiceQueue,
    );

    // Add SQS event source
    kitchenServiceLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(props.queues.kitchenServiceQueue, {
        batchSize: 10,
      }),
    );

    // Inventory Service Lambda
    const inventoryServiceLambda = this.createServiceLambda(
      'InventoryService',
      path.join(__dirname, '../../services/inventory-service'),
      props,
      lambdaRole,
      props.queues.inventoryServiceQueue,
    );

    // Add SQS event source
    inventoryServiceLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(props.queues.inventoryServiceQueue, {
        batchSize: 10,
      }),
    );

    // Purchasing Service Lambda
    const purchasingServiceLambda = this.createServiceLambda(
      'PurchasingService',
      path.join(__dirname, '../../services/purchasing-service'),
      props,
      lambdaRole,
      props.queues.purchasingServiceQueue,
    );

    // Add SQS event source
    purchasingServiceLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(props.queues.purchasingServiceQueue, {
        batchSize: 10,
      }),
    );

    this.output = {
      orderServiceLambda,
      kitchenServiceLambda,
      inventoryServiceLambda,
      purchasingServiceLambda,
    };
  }

  private createServiceLambda(
    serviceName: string,
    servicePath: string,
    props: LambdaServicesProps,
    role: iam.Role,
    serviceQueue: sqs.Queue,
  ): lambda.Function {
    // Create Lambda function with timeout for polling
    const lambdaFunction = new lambda.Function(this, `${serviceName}Function`, {
      functionName: `restaurant-${serviceName.toLowerCase()}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'dist/lambda.handler',
      code: lambda.Code.fromAsset(servicePath),
      timeout: cdk.Duration.seconds(300), // 5 minutes for polling loop
      memorySize: 256,
      role,
      environment: {
        NODE_ENV: 'production',
        DB_HOST: props.dbHost,
        DB_PORT: String(props.dbPort),
        DB_USER: props.dbUsername,
        DB_SECRET_ARN: props.dbPasswordSecret.secretArn,
        SQS_QUEUE_URL: serviceQueue.queueUrl,
        POLLING_INTERVAL_MS: '1000',
        SERVICE_PORT: '3000',
        AWS_REGION: cdk.Stack.of(this).region,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Add CloudWatch Logs
    new cdk.CfnOutput(this, `${serviceName}LogGroup`, {
      value: lambdaFunction.logGroup.logGroupName,
      description: `${serviceName} Lambda Log Group`,
    });

    return lambdaFunction;
  }
}
