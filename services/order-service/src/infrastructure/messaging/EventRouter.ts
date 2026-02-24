import { EventEnvelope, MessageHandler } from './types';
import {
  IngredientsPurchaseFailedHandler,
  IngredientsReservedHandler,
  OrderCompletedHandler,
  OrderItemsSelectedHandler,
} from '../../events/handlers';
import {
  HandleIngredientsPurchaseFailedUseCase,
  HandleIngredientsReservedUseCase,
  HandleOrderCompletedUseCase,
  HandleOrderItemsSelectedUseCase,
} from '../../use-cases';
import { OrderRepository, EventRepository } from '../../repositories';
import { Pool } from 'pg';

/**
 * EventRouter: Orquesta los handlers para que procesen eventos
 * 
 * Responsabilidades:
 * - Identificar qué handler debe procesar cada evento
 * - Crear instancias de handlers con sus use cases
 * - Delegar el procesamiento al handler correcto
 */
export class EventRouter {
  private ingredientsPurchaseFailedHandler: IngredientsPurchaseFailedHandler;
  private ingredientsReservedHandler: IngredientsReservedHandler;
  private orderCompletedHandler: OrderCompletedHandler;
  private orderItemsSelectedHandler: OrderItemsSelectedHandler;

  constructor(pool: Pool) {
    const orderRepo = new OrderRepository(pool);
    const eventRepo = new EventRepository(pool);

    // Crear use cases
    const handlePurchaseFailedUseCase = new HandleIngredientsPurchaseFailedUseCase(
      orderRepo,
      eventRepo
    );
    const handleIngredientsReservedUseCase = new HandleIngredientsReservedUseCase(
      orderRepo,
      eventRepo
    );
    const handleOrderCompletedUseCase = new HandleOrderCompletedUseCase(
      orderRepo,
      eventRepo
    );
    const handleOrderItemsSelectedUseCase = new HandleOrderItemsSelectedUseCase(
      orderRepo,
      eventRepo
    );

    // Crear handlers delegando use cases
    this.ingredientsPurchaseFailedHandler = new IngredientsPurchaseFailedHandler(
      handlePurchaseFailedUseCase
    );
    this.ingredientsReservedHandler = new IngredientsReservedHandler(
      handleIngredientsReservedUseCase
    );
    this.orderCompletedHandler = new OrderCompletedHandler(
      handleOrderCompletedUseCase
    );
    this.orderItemsSelectedHandler = new OrderItemsSelectedHandler(
      handleOrderItemsSelectedUseCase
    );
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
        case 'IngredientsReserved':
          await this.ingredientsReservedHandler.handle(data);
          break;

        case 'IngredientsPurchaseFailed':
          await this.ingredientsPurchaseFailedHandler.handle(data);
          break;

        case 'OrderCompleted':
          await this.orderCompletedHandler.handle(data);
          break;

        case 'OrderItemsSelected':
          await this.orderItemsSelectedHandler.handle(data);
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
