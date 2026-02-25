import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { EventEnvelope, EventBusConfig, MessageHandler } from './types';
import { randomUUID } from 'node:crypto';

export class EventBusLocal {
  private snsClient: SNSClient;
  private sqsClient: SQSClient;
  private config: EventBusConfig;
  private running: boolean = false;

  constructor(config: EventBusConfig) {
    this.config = config;

    const clientConfig = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint && { endpoint: config.endpoint }),
    };

    this.snsClient = new SNSClient(clientConfig);
    this.sqsClient = new SQSClient(clientConfig);
  }

  /**
   * Publica un evento a un topic SNS
   * Estructura de logs: eventId, source, eventType, data
   */
  async publish(topicName: string, eventType: string, data: any, source: string): Promise<void> {
    const envelope: EventEnvelope = {
      eventId: randomUUID(),
      eventType,
      occurredAt: new Date().toISOString(),
      source,
      data,
    };

    const topicArn = `arn:aws:sns:${this.config.region}:000000000000:${topicName}`;

    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(envelope),
    });

    try {
      await this.snsClient.send(command);
      console.log(`📤 Published event`, {
        eventId: envelope.eventId,
        eventType,
        topicName,
        source,
      });
    } catch (error) {
      console.error(`❌ Error publishing event`, {
        eventId: envelope.eventId,
        eventType,
        topicName,
        source,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Inicia el consumo de mensajes desde SQS (polling)
   */
  async startConsuming(handler: MessageHandler): Promise<void> {
    console.log(`🚀 Starting SQS consumer`, {
      queueUrl: this.config.queueUrl,
      pollingIntervalMs: this.config.pollingIntervalMs,
    });

    this.running = true;

    while (this.running) {
      try {
        const messages = await this.receiveMessages();

        if (messages && messages.length > 0) {
          console.log(`📬 Received messages`, {
            count: messages.length,
            queueUrl: this.config.queueUrl,
          });

          for (const message of messages) {
            await this.processMessage(message, handler);
          }
        }

        await this.sleep(this.config.pollingIntervalMs);
      } catch (error) {
        console.error(`❌ Error in SQS consumer loop`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        await this.sleep(this.config.pollingIntervalMs);
      }
    }
  }

  /**
   * Detiene el consumo de mensajes
   */
  async stop(): Promise<void> {
    console.log(`🛑 Stopping SQS consumer`);
    this.running = false;
    await this.sleep(100);
  }

  /**
   * Recibe mensajes de SQS
   */
  private async receiveMessages(): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.config.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
    });

    const response = await this.sqsClient.send(command);
    return response.Messages || [];
  }

  /**
   * Procesa un mensaje recibido
   */
  private async processMessage(message: Message, handler: MessageHandler): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) {
      console.warn(`⚠️  Invalid SQS message structure`);
      return;
    }

    try {
      const envelope = JSON.parse(message.Body) as EventEnvelope;
      const attemptNumber = parseInt(message.Attributes?.ApproximateReceiveCount || '1', 10);

      console.log(`⚙️  Processing message`, {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        source: envelope.source,
        attemptNumber,
      });

      await handler(envelope);

      // Eliminar mensaje de la queue
      await this.deleteMessage(message.ReceiptHandle);

      console.log(`✅ Message processed successfully`, {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      });
    } catch (error) {
      const envelope = JSON.parse(message.Body) as EventEnvelope;
      const attemptNumber = parseInt(message.Attributes?.ApproximateReceiveCount || '1', 10);

      console.error(`❌ Error processing message`, {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        source: envelope.source,
        attemptNumber,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // No eliminar mensaje para que SQS lo reintente
    }
  }

  /**
   * Elimina un mensaje de SQS
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.config.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await this.sqsClient.send(command);
  }

  /**
   * Helper para dormir (polling)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
