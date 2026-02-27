import { Context, APIGatewayProxyEvent, SQSEvent, SQSRecord } from 'aws-lambda';
 
// CORS Headers
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,x-api-key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { EventEnvelope } from './infrastructure/messaging/types';
import { OrderRepository } from './repositories/OrderRepository';
import { CreateOrderUseCase } from './use-cases/CreateOrderUseCase';

// Singleton instances (initialized on cold start)
let isInitialized = false;
let orderRepository: OrderRepository;
let createOrderUseCase: CreateOrderUseCase;
let eventBusInstance: EventBusLocal;
let eventRouter: EventRouter;

async function initializeOnColdStart() {
  if (isInitialized) return;

  console.log('🔧 Lambda cold start - initializing dependencies...');

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

  // Initialize repository and use cases
  orderRepository = new OrderRepository(pool);
  createOrderUseCase = new CreateOrderUseCase(orderRepository, eventBusInstance);
  
  // Initialize event router for consuming SQS events
  eventRouter = new EventRouter(pool);

  isInitialized = true;
  console.log('✅ Lambda initialized successfully');
}

// API Gateway event handler
async function handleApiGatewayEvent(event: APIGatewayProxyEvent): Promise<any> {
  const { httpMethod, path, body } = event;

  console.log(`📥 API Gateway: ${httpMethod} ${path}`);

  // Health check
  if (httpMethod === 'GET' && path === '/health') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: 'healthy', service: 'order-service' }),
    };
  }

  // GET /orders - List orders
  if (httpMethod === 'GET' && path === '/orders') {
    try {
      const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(result.rows),
      };
    } catch (error) {
      console.error('Error fetching orders:', error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  // POST /orders - Create order
  if (httpMethod === 'POST' && path === '/orders') {
    try {
      if (!body) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Missing request body' }),
        };
      }

      const input = JSON.parse(body);

      // Validate input
      if (!input.orderId || !input.totalDishes) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: 'Validation failed',
            details: ['orderId and totalDishes are required'],
          }),
        };
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(input.orderId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: 'Validation failed',
            details: [`orderId must be a valid UUID (received: ${input.orderId})`],
          }),
        };
      }

      // Validate totalDishes is a positive number
      if (!Number.isInteger(input.totalDishes) || input.totalDishes <= 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: 'Validation failed',
            details: ['totalDishes must be a positive integer'],
          }),
        };
      }

      // Execute use case
      const result = await createOrderUseCase.execute({
        orderId: input.orderId,
        totalDishes: input.totalDishes,
      });

      console.log(`✅ Order processed successfully`, { orderId: result.orderId, eventId: result.eventId });

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, data: result }),
      };
    } catch (error: any) {
      console.error('❌ Error creating order:', error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: error.message || 'Internal server error' }),
      };
    }
  }

  // Not found
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
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
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
