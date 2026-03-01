import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface EventBusOutput {
  // SNS Topics
  topics: {
    OrderCreated: sns.Topic;
    OrderItemsSelected: sns.Topic;
    IngredientsRequired: sns.Topic;
    IngredientsReserved: sns.Topic;
    PurchaseRequested: sns.Topic;
    PurchaseCompleted: sns.Topic;
    PurchaseFailed: sns.Topic;
    IngredientsPurchaseFailed: sns.Topic;
    OrderCompleted: sns.Topic;
  };

  // SQS Queues
  queues: {
    orderServiceQueue: sqs.Queue;
    kitchenServiceQueue: sqs.Queue;
    inventoryServiceQueue: sqs.Queue;
    purchasingServiceQueue: sqs.Queue;
  };

  // Queue URLs and ARNs for environment variables
  queueUrls: {
    orderService: string;
    kitchenService: string;
    inventoryService: string;
    purchasingService: string;
  };
}

export class EventBusConstruct extends Construct {
  public readonly output: EventBusOutput;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const MAX_RECEIVE_COUNT = 3;

    // ============================================================
    // PASO 1: Create SQS Queues
    // ============================================================
    const orderServiceDlq = new sqs.Queue(this, 'OrderServiceDLQ', {
      queueName: 'order-service-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const kitchenServiceDlq = new sqs.Queue(this, 'KitchenServiceDLQ', {
      queueName: 'kitchen-service-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const inventoryServiceDlq = new sqs.Queue(this, 'InventoryServiceDLQ', {
      queueName: 'inventory-service-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const purchasingServiceDlq = new sqs.Queue(this, 'PurchasingServiceDLQ', {
      queueName: 'purchasing-service-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const orderServiceQueue = new sqs.Queue(this, 'OrderServiceQueue', {
      queueName: 'order-service-queue',
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.hours(1),
      deadLetterQueue: {
        maxReceiveCount: MAX_RECEIVE_COUNT,
        queue: orderServiceDlq,
      },
    });

    const kitchenServiceQueue = new sqs.Queue(this, 'KitchenServiceQueue', {
      queueName: 'kitchen-service-queue',
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.hours(1),
      deadLetterQueue: {
        maxReceiveCount: MAX_RECEIVE_COUNT,
        queue: kitchenServiceDlq,
      },
    });

    const inventoryServiceQueue = new sqs.Queue(this, 'InventoryServiceQueue', {
      queueName: 'inventory-service-queue',
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.hours(1),
      deadLetterQueue: {
        maxReceiveCount: MAX_RECEIVE_COUNT,
        queue: inventoryServiceDlq,
      },
    });

    const purchasingServiceQueue = new sqs.Queue(this, 'PurchasingServiceQueue', {
      queueName: 'purchasing-service-queue',
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.hours(1),
      deadLetterQueue: {
        maxReceiveCount: MAX_RECEIVE_COUNT,
        queue: purchasingServiceDlq,
      },
    });

    // ============================================================
    // PASO 2: Create SNS Topics
    // ============================================================
    const OrderCreated = new sns.Topic(this, 'OrderCreatedTopic', {
      topicName: 'OrderCreated',
    });

    const OrderItemsSelected = new sns.Topic(this, 'OrderItemsSelectedTopic', {
      topicName: 'OrderItemsSelected',
    });

    const IngredientsRequired = new sns.Topic(this, 'IngredientsRequiredTopic', {
      topicName: 'IngredientsRequired',
    });

    const IngredientsReserved = new sns.Topic(this, 'IngredientsReservedTopic', {
      topicName: 'IngredientsReserved',
    });

    const PurchaseRequested = new sns.Topic(this, 'PurchaseRequestedTopic', {
      topicName: 'PurchaseRequested',
    });

    const PurchaseCompleted = new sns.Topic(this, 'PurchaseCompletedTopic', {
      topicName: 'PurchaseCompleted',
    });

    const PurchaseFailed = new sns.Topic(this, 'PurchaseFailedTopic', {
      topicName: 'PurchaseFailed',
    });

    const IngredientsPurchaseFailed = new sns.Topic(this, 'IngredientsPurchaseFailedTopic', {
      topicName: 'IngredientsPurchaseFailed',
    });

    const OrderCompleted = new sns.Topic(this, 'OrderCompletedTopic', {
      topicName: 'OrderCompleted',
    });

    // ============================================================
    // PASO 3: Subscribe Queues to Topics
    // ============================================================

    // order-service consumes: IngredientsReserved, IngredientsPurchaseFailed, OrderCompleted, OrderItemsSelected
    IngredientsReserved.addSubscription(new sns_subscriptions.SqsSubscription(orderServiceQueue));
    IngredientsPurchaseFailed.addSubscription(new sns_subscriptions.SqsSubscription(orderServiceQueue));
    OrderCompleted.addSubscription(new sns_subscriptions.SqsSubscription(orderServiceQueue));
    OrderItemsSelected.addSubscription(new sns_subscriptions.SqsSubscription(orderServiceQueue));

    // kitchen-service consumes: OrderCreated, IngredientsReserved
    OrderCreated.addSubscription(new sns_subscriptions.SqsSubscription(kitchenServiceQueue));
    IngredientsReserved.addSubscription(new sns_subscriptions.SqsSubscription(kitchenServiceQueue));

    // inventory-service consumes: IngredientsRequired, PurchaseCompleted, PurchaseFailed
    IngredientsRequired.addSubscription(new sns_subscriptions.SqsSubscription(inventoryServiceQueue));
    PurchaseCompleted.addSubscription(new sns_subscriptions.SqsSubscription(inventoryServiceQueue));
    PurchaseFailed.addSubscription(new sns_subscriptions.SqsSubscription(inventoryServiceQueue));

    // purchasing-service consumes: PurchaseRequested
    PurchaseRequested.addSubscription(new sns_subscriptions.SqsSubscription(purchasingServiceQueue));

    this.output = {
      topics: {
        OrderCreated,
        OrderItemsSelected,
        IngredientsRequired,
        IngredientsReserved,
        PurchaseRequested,
        PurchaseCompleted,
        PurchaseFailed,
        IngredientsPurchaseFailed,
        OrderCompleted,
      },
      queues: {
        orderServiceQueue,
        kitchenServiceQueue,
        inventoryServiceQueue,
        purchasingServiceQueue,
      },
      queueUrls: {
        orderService: orderServiceQueue.queueUrl,
        kitchenService: kitchenServiceQueue.queueUrl,
        inventoryService: inventoryServiceQueue.queueUrl,
        purchasingService: purchasingServiceQueue.queueUrl,
      },
    };

    // ============================================================
    // Outputs
    // ============================================================
    new cdk.CfnOutput(this, 'OrderServiceQueueUrl', {
      value: orderServiceQueue.queueUrl,
      description: 'Order Service Queue URL',
    });

    new cdk.CfnOutput(this, 'KitchenServiceQueueUrl', {
      value: kitchenServiceQueue.queueUrl,
      description: 'Kitchen Service Queue URL',
    });

    new cdk.CfnOutput(this, 'InventoryServiceQueueUrl', {
      value: inventoryServiceQueue.queueUrl,
      description: 'Inventory Service Queue URL',
    });

    new cdk.CfnOutput(this, 'PurchasingServiceQueueUrl', {
      value: purchasingServiceQueue.queueUrl,
      description: 'Purchasing Service Queue URL',
    });
  }
}
