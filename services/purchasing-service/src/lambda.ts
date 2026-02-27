import { Context, SQSEvent } from 'aws-lambda';

export async function handler(event: SQSEvent, context?: Context): Promise<void> {
  try {
    const mod = require('./index');
    await mod.eventBus?.processSQSBatch?.(event.Records);
  } catch (error) {
    console.error('Lambda error:', error);
    throw error;
  }
}
