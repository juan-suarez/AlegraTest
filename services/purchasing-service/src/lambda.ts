import { Context, APIGatewayProxyEvent, SQSEvent, SQSRecord } from 'aws-lambda';
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { EventEnvelope } from './infrastructure/messaging/types';
import { PurchaseHistoryRepository } from './repositories';

// Singleton instances (initialized on cold start)
let isInitialized = false;
let purchaseHistoryRepository: PurchaseHistoryRepository;
let eventBusInstance: EventBusLocal;
let eventRouter: EventRouter;

async function initializeOnColdStart() {
  if (isInitialized) return;

  console.log('🔧 Lambda cold start - initializing purchasing-service...');

  // Initialize EventBus for AWS (credentials not needed - Lambda uses IAM Role)
  const config: any = {
    region: process.env.AWS_REGION || 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID,
    queueUrl: process.env.SQS_QUEUE_URL!,
    pollingIntervalMs: 0, // No polling in Lambda (triggered by event source)
  };
  
  // Only pass credentials if using LocalStack in development
  if (process.env.AWS_ENDPOINT && process.env.AWS_ENDPOINT.includes('localhost')) {
    config.endpoint = process.env.AWS_ENDPOINT;
    config.accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'test';
    config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'test';
  }
  // In Lambda/AWS, credentials come from IAM role (not passed explicitly)
  
  eventBusInstance = new EventBusLocal(config);

  // Initialize repository
  purchaseHistoryRepository = new PurchaseHistoryRepository(pool);
  
  // Initialize event router (creates handlers and use cases internally)
  eventRouter = new EventRouter(pool, eventBusInstance);

  isInitialized = true;
  console.log('✅ Lambda initialized successfully');
}

// API Gateway event handler
async function handleApiGatewayEvent(event: APIGatewayProxyEvent): Promise<any> {
  const { httpMethod, path, queryStringParameters } = event;

  console.log(`📥 API Gateway: ${httpMethod} ${path}`);

  // Health check
  if (httpMethod === 'GET' && path === '/health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'healthy', service: 'purchasing-service' }),
    };
  }

  // GET /purchases - List all purchases or filter by orderId/ingredientId
  if (httpMethod === 'GET' && path === '/purchases') {
    try {
      const orderId = queryStringParameters?.orderId;
      const ingredientId = queryStringParameters?.ingredientId;
      const limit = queryStringParameters?.limit ? parseInt(queryStringParameters.limit, 10) : 50;

      let purchases;

      if (orderId) {
        purchases = await purchaseHistoryRepository.findByOrderId(orderId);
      } else if (ingredientId) {
        purchases = await purchaseHistoryRepository.findByIngredientId(ingredientId);
      } else {
        purchases = await purchaseHistoryRepository.findAll(limit);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchases),
      };
    } catch (error) {
      console.error('Error fetching purchases:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  // GET /purchases/stats - Get purchase statistics
  if (httpMethod === 'GET' && path === '/purchases/stats') {
    try {
      const stats = await purchaseHistoryRepository.getStats();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stats),
      };
    } catch (error) {
      console.error('Error fetching purchase stats:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  // Not found
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not found' }),
  };
}

// SQS event handler
async function handleSQSEvent(event: SQSEvent): Promise<void> {
  console.log(`📥 Received ${event.Records.length} SQS message(s)`);

  for (const record of event.Records) {
    try {
      await processSQSRecord(record);
    } catch (error) {
      console.error('❌ Error processing SQS record:', error);
      throw error; // Throw to trigger retry or DLQ
    }
  }
}

async function processSQSRecord(record: SQSRecord): Promise<void> {
  try {
    // Parse SNS message from SQS
    const snsMessage = JSON.parse(record.body);
    
    // The actual event is in the Message field
    const eventEnvelope: EventEnvelope = JSON.parse(snsMessage.Message);
    
    console.log(`📨 Processing event: ${eventEnvelope.eventType}`, {
      eventId: eventEnvelope.eventId,
      source: eventEnvelope.source,
    });

    // Route event to appropriate handler
    const handler = eventRouter.getHandler();
    await handler(eventEnvelope);

    console.log(`✅ Event processed successfully: ${eventEnvelope.eventType}`);
  } catch (error) {
    console.error('❌ Error processing SQS record:', {
      messageId: record.messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Main Lambda handler
export async function handler(
  event: APIGatewayProxyEvent | SQSEvent | any,
  context?: Context
): Promise<any> {
  try {
    // Initialize on cold start
    await initializeOnColdStart();

    // Route to appropriate handler
    if (event.Records && Array.isArray(event.Records)) {
      // SQS Event
      await handleSQSEvent(event as SQSEvent);
      return { statusCode: 200 };
    } else if (event.httpMethod && event.path) {
      // API Gateway Event
      return await handleApiGatewayEvent(event as APIGatewayProxyEvent);
    }

    // Unknown event type
    console.warn('Unknown event type:', event);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Unknown event type' }),
    };
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
