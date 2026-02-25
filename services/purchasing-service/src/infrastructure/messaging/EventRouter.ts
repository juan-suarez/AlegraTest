import { EventEnvelope, MessageHandler } from './types';
import { PurchaseRequestedHandler } from '../../events/handlers';
import { HandlePurchaseRequestedUseCase } from '../../use-cases';
import { EventRepository } from '../../repositories';
import { ProviderClient } from '../../externals';
import { Pool } from 'pg';
import { EventBusLocal } from './EventBusLocal';

/**
 * EventRouter: Orquesta los handlers para que procesen eventos
 * 
 * Responsabilidades:
 * - Identificar qué handler debe procesar cada evento
 * - Crear instancias de handlers con sus use cases
 * - Delegar el procesamiento al handler correcto
 */
export class EventRouter {
  private purchaseRequestedHandler: PurchaseRequestedHandler;

  constructor(pool: Pool, eventBus: EventBusLocal) {
    const eventRepo = new EventRepository(pool);
    const providerClient = new ProviderClient();

    const handlePurchaseRequestedUseCase = new HandlePurchaseRequestedUseCase(
      eventRepo,
      providerClient,
      eventBus
    );

    this.purchaseRequestedHandler = new PurchaseRequestedHandler(handlePurchaseRequestedUseCase);
  }

  getHandler(): MessageHandler {
    return async (envelope: EventEnvelope) => {
      await this.routeEvent(envelope);
    };
  }


  private async routeEvent(envelope: EventEnvelope): Promise<void> {
    const { eventType, data } = envelope;

    console.log(`🔀 Routing event: ${eventType}`, {
      eventId: envelope.eventId,
      source: envelope.source,
    });

    try {
      switch (eventType) {
        case 'PurchaseRequested':
          await this.purchaseRequestedHandler.handle(data);
          break;

        default:
          console.warn(`⚠️  Unhandled event type: ${eventType}`, {
            eventId: envelope.eventId,
          });
      }
    } catch (error) {
      console.error(`❌ Error routing event ${eventType}`, {
        eventId: envelope.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
