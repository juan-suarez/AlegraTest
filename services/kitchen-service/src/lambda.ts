import { Context, SQSEvent, SQSRecord, SQSBatchResponse } from 'aws-lambda';
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { EventEnvelope } from './infrastructure/messaging/types';
import { globalConfig } from './config/globalConfig';

// Singleton instances (initialized on cold start)
let isInitialized = false;
let eventBusInstance: EventBusLocal;
let eventRouter: EventRouter;

async function initializeOnColdStart() {
  if (isInitialized) return;

  console.log('🔧 Lambda cold start - initializing kitchen-service...');

  // Initialize EventBus for AWS (credentials not needed - Lambda uses IAM Role)
  const config = globalConfig.createEventBusConfig({ pollingIntervalMs: 0 });
  
  eventBusInstance = new EventBusLocal(config);
  
  // Initialize event router (creates handlers and use cases internally)
  eventRouter = new EventRouter(pool, eventBusInstance);

  isInitialized = true;
  console.log('✅ Lambda initialized successfully');
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
export async function handler(event: SQSEvent, context?: Context): Promise<SQSBatchResponse> {
  await initializeOnColdStart();
  return await handleSQSEvent(event);
}
