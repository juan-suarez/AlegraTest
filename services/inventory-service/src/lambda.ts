import { Context, APIGatewayProxyEvent, SQSEvent, SQSRecord } from 'aws-lambda';
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { EventEnvelope } from './infrastructure/messaging/types';
import { IngredientRepository, ReservationRepository } from './repositories';
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
let ingredientRepository: IngredientRepository;
let reservationRepository: ReservationRepository;
let eventBusInstance: EventBusLocal;
let eventRouter: EventRouter;

async function initializeOnColdStart() {
  if (isInitialized) return;

  console.log('🔧 Lambda cold start - initializing inventory-service...');

  eventBusInstance = new EventBusLocal(
    globalConfig.createEventBusConfig({ pollingIntervalMs: 0 })
  );

  // Initialize repositories
  ingredientRepository = new IngredientRepository(pool);
  reservationRepository = new ReservationRepository(pool);
  
  // Initialize event router (creates handlers and use cases internally)
  eventRouter = new EventRouter(pool, eventBusInstance);

  isInitialized = true;
  console.log('✅ Lambda initialized successfully');
}

// API Gateway event handler
async function handleApiGatewayEvent(event: APIGatewayProxyEvent): Promise<any> {
  const { httpMethod, path, queryStringParameters } = event;

  console.log(`📥 API Gateway: ${httpMethod} ${path}`, JSON.stringify(event));

  // Normalize path - remove /inventory prefix if present
  const normalizedPath = path.replace(/^\/inventory/, '') || '/';

  // Health check
  if (httpMethod === 'GET' && (path === '/health' || normalizedPath === '/health')) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: 'healthy', service: 'inventory-service' }),
    };
  }

  // GET /ingredients - List all ingredients
  if (httpMethod === 'GET' && normalizedPath === '/ingredients') {
    try {
      const ingredients = await ingredientRepository.getAll();
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(ingredients),
      };
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  // GET /ingredients/:id - Get single ingredient
  const ingredientIdMatch = normalizedPath.match(/^\/ingredients\/([a-f0-9-]+)$/i);
  if (httpMethod === 'GET' && ingredientIdMatch) {
    try {
      const ingredientId = ingredientIdMatch[1]!;
      const ingredient = await ingredientRepository.getById(ingredientId);
      
      if (!ingredient) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Ingredient not found' }),
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(ingredient),
      };
    } catch (error) {
      console.error('Error fetching ingredient:', error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  // GET /reservations - List all active reservations
  if (httpMethod === 'GET' && normalizedPath === '/reservations') {
    try {
      const orderId = queryStringParameters?.orderId;

      if (orderId) {
        // Filter by orderId if provided
        const reservations = await reservationRepository.getByOrder(orderId);
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(reservations),
        };
      } else {
        // Return all active reservations
        const reservations = await reservationRepository.getAllActive();
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(reservations),
        };
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
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
