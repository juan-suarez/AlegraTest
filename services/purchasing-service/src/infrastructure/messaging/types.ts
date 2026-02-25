// Event Envelope - estructura estándar de todos los eventos
export interface EventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  occurredAt: string; // ISO-8601
  source: string; // nombre del servicio que lo emite
  data: T;
}

// Configuración de EventBusLocal
export interface EventBusConfig {
  region: string;
  endpoint?: string; // Para LocalStack
  accessKeyId: string;
  secretAccessKey: string;
  queueUrl: string;
  pollingIntervalMs: number;
}

// Callback para procesar mensajes
export type MessageHandler = (event: EventEnvelope) => Promise<void>;
