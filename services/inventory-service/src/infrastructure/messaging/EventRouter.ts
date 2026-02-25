import { EventEnvelope, MessageHandler } from './types';
import {
  IngredientsRequiredHandler,
  PurchaseCompletedHandler,
  PurchaseFailedHandler,
} from '../../events/handlers';
import {
  HandleIngredientsRequiredUseCase,
  HandlePurchaseCompletedUseCase,
  HandlePurchaseFailedUseCase,
} from '../../use-cases';
import { EventRepository, IngredientRepository, ReservationRepository } from '../../repositories';
import { Pool } from 'pg';
import { EventBusLocal } from './EventBusLocal';


export class EventRouter {
  private ingredientsRequiredHandler: IngredientsRequiredHandler;
  private purchaseCompletedHandler: PurchaseCompletedHandler;
  private purchaseFailedHandler: PurchaseFailedHandler;

  constructor(pool: Pool, eventBus: EventBusLocal) {
    const eventRepo = new EventRepository(pool);
    const ingredientRepo = new IngredientRepository(pool);
    const reservationRepo = new ReservationRepository(pool);

    const handleIngredientsRequiredUseCase = new HandleIngredientsRequiredUseCase(
      pool,
      eventRepo,
      ingredientRepo,
      reservationRepo,
      eventBus
    );

    const handlePurchaseCompletedUseCase = new HandlePurchaseCompletedUseCase(
      pool,
      eventRepo,
      ingredientRepo,
      reservationRepo,
      eventBus
    );

    const handlePurchaseFailedUseCase = new HandlePurchaseFailedUseCase(
      pool,
      eventRepo,
      ingredientRepo,
      reservationRepo,
      eventBus
    );

     this.ingredientsRequiredHandler = new IngredientsRequiredHandler(handleIngredientsRequiredUseCase);
    this.purchaseCompletedHandler = new PurchaseCompletedHandler(handlePurchaseCompletedUseCase);
    this.purchaseFailedHandler = new PurchaseFailedHandler(handlePurchaseFailedUseCase);
  }


  getHandler(): MessageHandler {
    return async (envelope: EventEnvelope) => {
      await this.routeEvent(envelope);
    };
  }


  private async routeEvent(envelope: EventEnvelope): Promise<void> {
    const { eventType, data } = envelope;

    console.log(`🔀 Routing event`, {
      eventId: envelope.eventId,
      eventType,
      source: envelope.source,
    });

    try {
      switch (eventType) {
        case 'IngredientsRequired':
          await this.ingredientsRequiredHandler.handle(data);
          break;

        case 'PurchaseCompleted':
          await this.purchaseCompletedHandler.handle(data);
          break;

        case 'PurchaseFailed':
          await this.purchaseFailedHandler.handle(data);
          break;

        default:
          console.warn(`⚠️  Unhandled event type`, {
            eventId: envelope.eventId,
            eventType,
          });
      }
    } catch (error) {
      console.error(`❌ Error routing event`, {
        eventId: envelope.eventId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
