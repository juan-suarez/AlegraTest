/**
 * Event Bus Types y configuración
 */

export interface EventBusConfig {
  region: string;
  accountId?: string; // AWS Account ID for SNS topic ARN (defaults to fake account for LocalStack)
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  queueUrl: string;
  pollingIntervalMs: number;
}

export interface EventEnvelope {
  eventId: string;
  eventType: string;
  occurredAt: string;
  source: string;
  data: any;
}

export type MessageHandler = (envelope: EventEnvelope) => Promise<void>;
