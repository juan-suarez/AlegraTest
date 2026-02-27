import { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { EventEnvelope } from './infrastructure/messaging/types';

// Singleton instances (initialized on cold start)
let isInitialized = false;
let eventBusInstance: EventBusLocal;
let eventRouter: EventRouter;

async function initializeOnColdStart() {
  if (isInitialized) return;

  console.log('🔧 Lambda cold start - initializing inventory-service...');

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
  
  // Initialize event router (creates handlers and use cases internally)
  eventRouter = new EventRouter(pool, eventBusInstance);

  isInitialized = true;
  console.log('✅ Lambda initialized successfully');
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
export async function handler(event: SQSEvent, context?: Context): Promise<void> {
  try {
    await initializeOnColdStart();
    await handleSQSEvent(event);
  } catch (error) {
    console.error('❌ Lambda handler error:', error);
    throw error;
  }
}
