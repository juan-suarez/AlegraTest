import { EventEnvelope, MessageHandler } from './types';
import { OrderCreatedHandler, IngredientsReservedHandler } from '../../events/handlers';
import { HandleOrderCreatedUseCase, HandleIngredientsReservedUseCase } from '../../use-cases';
import { EventRepository } from '../../repositories';
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
  private orderCreatedHandler: OrderCreatedHandler;
  private ingredientsReservedHandler: IngredientsReservedHandler;

  constructor(pool: Pool, eventBus: EventBusLocal) {
    const eventRepo = new EventRepository(pool);

    // Crear use cases
    const handleOrderCreatedUseCase = new HandleOrderCreatedUseCase(eventRepo, eventBus);
    const handleIngredientsReservedUseCase = new HandleIngredientsReservedUseCase(eventRepo, eventBus);

    // Crear handlers delegando use cases
    this.orderCreatedHandler = new OrderCreatedHandler(handleOrderCreatedUseCase);
    this.ingredientsReservedHandler = new IngredientsReservedHandler(handleIngredientsReservedUseCase);
  }

  /**
   * Retorna un handler que puede ser usado por EventBusLocal
   */
  getHandler(): MessageHandler {
    return async (envelope: EventEnvelope) => {
      await this.routeEvent(envelope);
    };
  }

  /**
   * Rutea el evento al handler correspondiente según el eventType
   */
  private async routeEvent(envelope: EventEnvelope): Promise<void> {
    const { eventType, data } = envelope;

    console.log(`🔀 Routing event: ${eventType}`, {
      eventId: envelope.eventId,
      source: envelope.source,
    });

    try {
      switch (eventType) {
        case 'OrderCreated':
          await this.orderCreatedHandler.handle(data);
          break;

        case 'IngredientsReserved':
          await this.ingredientsReservedHandler.handle(data);
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
