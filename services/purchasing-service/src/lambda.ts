import { Context, APIGatewayProxyEvent, SQSEvent, SQSRecord, SQSBatchResponse } from 'aws-lambda';
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { EventEnvelope } from './infrastructure/messaging/types';
import { PurchaseHistoryRepository } from './repositories';
import { globalConfig } from './config/globalConfig';

// CORS Headers
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,x-api-key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

// Singleton instances (initialized on cold start)
let isInitialized = false;
let purchaseHistoryRepository: PurchaseHistoryRepository;
let eventBusInstance: EventBusLocal;
let eventRouter: EventRouter;

async function initializeOnColdStart() {
  if (isInitialized) return;

  console.log('🔧 Lambda cold start - initializing purchasing-service...');

  // Initialize EventBus for AWS (credentials not needed - Lambda uses IAM Role)
  const config = globalConfig.createEventBusConfig({ pollingIntervalMs: 0 });
  
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

  console.log(`📥 API Gateway: ${httpMethod} ${path}`, JSON.stringify(event));

  // Health check
  if (httpMethod === 'GET' && path === '/health') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: 'healthy', service: 'purchasing-service' }),
    };
  }

  // GET /purchases or / - List all purchases or filter by orderId/ingredientId
  if (httpMethod === 'GET' && (path === '/purchases' || path === '/')) {
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
        headers: CORS_HEADERS,
        body: JSON.stringify(purchases),
      };
    } catch (error) {
      console.error('Error fetching purchases:', error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  // GET /purchases/stats or /stats - Get purchase statistics
  if (httpMethod === 'GET' && (path === '/purchases/stats' || path === '/stats')) {
    try {
      const stats = await purchaseHistoryRepository.getStats();
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(stats),
      };
    } catch (error) {
      console.error('Error fetching purchase stats:', error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Internal server error' }),
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
async function handleSQSEvent(event: SQSEvent): Promise<SQSBatchResponse> {
  console.log(`📥 Received ${event.Records.length} SQS message(s)`);

  const results = await Promise.allSettled(
    event.Records.map((record) => processSQSRecord(record)),
  );

  const batchItemFailures = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [];
    }

    const failedRecord = event.Records[index];
    console.error('❌ Failed SQS record in batch:', {
      messageId: failedRecord?.messageId,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });

    return failedRecord ? [{ itemIdentifier: failedRecord.messageId }] : [];
  });

  if (batchItemFailures.length > 0) {
    console.warn(`⚠️ ${batchItemFailures.length} SQS message(s) failed and will be retried`);
  }

  return { batchItemFailures };
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
  // SQS path: never return API-style payloads on error
  if (event.Records && Array.isArray(event.Records)) {
    await initializeOnColdStart();
    return await handleSQSEvent(event as SQSEvent);
  }

  try {
    // Initialize on cold start
    await initializeOnColdStart();

    // Route to appropriate handler
    if (event.httpMethod && event.path) {
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
