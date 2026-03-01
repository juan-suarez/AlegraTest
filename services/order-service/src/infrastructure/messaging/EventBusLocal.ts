import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { 
  SQSClient, 
  ReceiveMessageCommand, 
  DeleteMessageCommand,
  Message 
} from '@aws-sdk/client-sqs';
import { EventEnvelope, EventBusConfig, MessageHandler } from './types';
import { randomUUID } from "node:crypto"
import { globalConfig } from '../../config/globalConfig';

export class EventBusLocal {
  private snsClient: SNSClient;
  private sqsClient: SQSClient;
  private config: EventBusConfig;
  private running: boolean = false;
  private handler: MessageHandler | undefined;

  constructor(config: EventBusConfig, handler?: MessageHandler) {
    this.config = config;
    this.handler = handler;

    const clientConfig: any = {
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
    };

    // Only add credentials if they are provided and not empty
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }
    // Otherwise, AWS SDK will use default credential resolution (IAM role in Lambda)

    this.snsClient = new SNSClient(clientConfig);
    this.sqsClient = new SQSClient(clientConfig);
  }

  /**
   * Publica un evento a un topic SNS
   */
  async publish(topicName: string, eventType: string, data: any, source: string): Promise<void> {
    const envelope: EventEnvelope = {
      eventId: randomUUID(),
      eventType,
      occurredAt: new Date().toISOString(),
      source,
      data,
    };

    const accountId = this.config.accountId || '000000000000'; // Use real account ID if provided, else fake for LocalStack
    const topicArn = `arn:aws:sns:${this.config.region}:${accountId}:${topicName}`;

    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(envelope),
    });

    try {
      await this.snsClient.send(command);
      console.log(`📤 Published ${eventType} to ${topicName}`, {
        eventId: envelope.eventId,
        source,
      });
    } catch (error) {
      console.error(`❌ Error publishing event to ${topicName}`, {
        eventType,
        source,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Inicia el consumo de mensajes desde SQS (polling)
   * Solo funciona en modo local, se omite en Lambda
   */
  async startConsuming(handler?: MessageHandler): Promise<void> {
    // Skip if running in Lambda
    if (globalConfig.isLambdaRuntime) {
      console.log('⚠️  startConsuming() skipped - running in Lambda environment');
      return;
    }

    // Use provided handler or stored one
    const messageHandler = handler || this.handler;
    if (!messageHandler) {
      throw new Error('No handler provided for SQS consuming');
    }

    console.log(`🚀 Starting SQS consumer for queue: ${this.config.queueUrl}`);
    console.log(`⏱️  Polling interval: ${this.config.pollingIntervalMs}ms`);
    
    this.running = true;

    while (this.running) {
      try {
        const messages = await this.receiveMessages();

        if (messages && messages.length > 0) {
          console.log(`📬 Received ${messages.length} message(s)`);

          const results = await Promise.allSettled(
            messages.map((message) => this.processMessage(message, messageHandler)),
          );

          const failed = results.filter((result) => result.status === 'rejected').length;
          if (failed > 0) {
            console.warn(`⚠️ Failed ${failed}/${messages.length} message(s), they will be retried by SQS`);
          }
        }

        // Esperar antes del siguiente poll
        await this.sleep(this.config.pollingIntervalMs);
      } catch (error) {
        console.error('❌ Error in SQS consumer loop', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Esperar antes de reintentar
        await this.sleep(this.config.pollingIntervalMs);
      }
    }
  }

  /**
   * Detiene el consumo de mensajes
   */
  stop(): void {
    console.log('🛑 Stopping SQS consumer...');
    this.running = false;
  }

  /**
   * Recibe mensajes de SQS
   */
  private async receiveMessages(): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.config.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Long polling
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
    });

    const result = await this.sqsClient.send(command);
    return result.Messages || [];
  }

  /**
   * Procesa un mensaje individual
   */
  private async processMessage(message: Message, handler: MessageHandler): Promise<void> {
    try {
      if (!message.Body) {
        console.warn('⚠️  Received message without body');
        return;
      }

      // SNS wraps the message, extract it
      const snsMessage = JSON.parse(message.Body);
      const eventEnvelope: EventEnvelope = JSON.parse(snsMessage.Message);

      // Capturar número de intentos
      const receiveCount = message.Attributes?.ApproximateReceiveCount || '1';

      console.log(`📨 Processing event: ${eventEnvelope.eventType}`, {
        eventId: eventEnvelope.eventId,
        source: eventEnvelope.source,
        attemptNumber: receiveCount,
      });

      // Delegar a handler
      await handler(eventEnvelope);

      // Eliminar mensaje de la cola
      await this.deleteMessage(message);
      
      console.log(`✅ Successfully processed: ${eventEnvelope.eventType}`, {
        eventId: eventEnvelope.eventId,
      });
    } catch (error) {
      const receiveCount = message.Attributes?.ApproximateReceiveCount || '1';
      
      console.error('❌ Error processing message', {
        attemptNumber: receiveCount,
        messageId: message.MessageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // El mensaje volverá a la cola después del visibility timeout
      throw error;
    }
  }

  /**
   * Elimina un mensaje de la cola
   */
  private async deleteMessage(message: Message): Promise<void> {
    if (!message.ReceiptHandle) {
      return;
    }

    const command = new DeleteMessageCommand({
      QueueUrl: this.config.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    });

    await this.sqsClient.send(command);
  }

  /**
   * Procesa un batch de mensajes SQS (para Lambda)
   * Lambda invoca esto directamente con los registros SQS
   */
  async processSQSBatch(records: any[]): Promise<void> {
    if (!this.handler) {
      throw new Error('No handler defined for processSQSBatch');
    }

    console.log(`📨 Processing batch of ${records.length} SQS record(s)`);

    for (const record of records) {
      try {
        if (!record.body) {
          console.warn('⚠️  Record without body');
          continue;
        }

        // SNS wraps the message, extract it
        const snsMessage = JSON.parse(record.body);
        const eventEnvelope: EventEnvelope = JSON.parse(snsMessage.Message);

        console.log(`📨 Processing event: ${eventEnvelope.eventType}`, {
          eventId: eventEnvelope.eventId,
          source: eventEnvelope.source,
        });

        // Process with handler
        await this.handler(eventEnvelope);

        console.log(`✅ Successfully processed: ${eventEnvelope.eventType}`, {
          eventId: eventEnvelope.eventId,
        });
      } catch (error) {
        console.error('❌ Error processing SQS record', {
          messageId: record.messageId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // In Lambda, AWS will retry on error
        throw error;
      }
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}
