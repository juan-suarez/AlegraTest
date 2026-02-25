import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { EventRepository, IngredientRepository, ReservationRepository } from '../repositories';
import { EventBusLocal } from '../infrastructure/messaging';
import {
  PurchaseFailedEvent,
  IngredientsPurchaseFailedEvent,
} from './types';

export class HandlePurchaseFailedUseCase {
  constructor(
    private pool: Pool,
    private eventRepo: EventRepository,
    private ingredientRepo: IngredientRepository,
    private reservationRepo: ReservationRepository,
    private eventBus: EventBusLocal
  ) {}

  async execute(event: PurchaseFailedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const alreadyPublishedFailure = await this.eventRepo.hasPurchaseFailedEventPublished(event.orderId);

      if (!alreadyPublishedFailure) {

        const releasedReservations = await this.reservationRepo.releaseAllForOrder(event.orderId);

        for (const released of releasedReservations) {
          await this.ingredientRepo.addStock(released.ingredient_id, released.quantity_reserved);
        }
      }

      if (event.quantityPurchased > 0) {
        await this.ingredientRepo.addStock(event.ingredientId, event.quantityPurchased);
      }

      if (!alreadyPublishedFailure) {
        const failedEvent: IngredientsPurchaseFailedEvent = {
          eventId: randomUUID(),
          orderId: event.orderId,
        };

        await this.eventBus.publish('order-events', 'IngredientsPurchaseFailed', failedEvent, 'inventory-service');
        await this.eventRepo.markPurchaseFailedEventPublished(event.orderId);
      }

      await this.eventRepo.markEventProcessed(event.eventId);
      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error in HandlePurchaseFailedUseCase`, {
        eventId: event.eventId,
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      client.release();
    }
  }
}
