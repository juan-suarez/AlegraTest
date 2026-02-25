import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { EventRepository, IngredientRepository, ReservationRepository } from '../repositories';
import { EventBusLocal } from '../infrastructure/messaging';
import {
  PurchaseCompletedEvent,
  IngredientsReservedEvent,
} from './types';

export class HandlePurchaseCompletedUseCase {
  constructor(
    private pool: Pool,
    private eventRepo: EventRepository,
    private ingredientRepo: IngredientRepository,
    private reservationRepo: ReservationRepository,
    private eventBus: EventBusLocal
  ) {}

  async execute(event: PurchaseCompletedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const reservation = await this.reservationRepo.getByOrderAndIngredient(
        event.orderId,
        event.ingredientId
      );

      if (!reservation) {
        console.error(`No reservation found`, {
          eventId: event.eventId,
          orderId: event.orderId,
          ingredientId: event.ingredientId,
        });
        throw new Error(`Reservation not found for order ${event.orderId} and ingredient ${event.ingredientId}`);
      }

      if (reservation.status === 'RELEASED') {
        await this.ingredientRepo.addStock(event.ingredientId, event.quantityPurchased);
        await this.eventRepo.markEventProcessed(event.eventId);
        await client.query('COMMIT');
        return;
      }

      const remaining = event.quantityPurchased - reservation.quantity_needed;

      await this.reservationRepo.updateStatus(reservation.id, 'RESERVED');

      if (remaining > 0) {
        await this.ingredientRepo.addStock(event.ingredientId, remaining);
      }

      const allReserved = await this.reservationRepo.areAllReserved(event.orderId);

      if (allReserved) {

        const reservedEvent: IngredientsReservedEvent = {
          eventId: randomUUID(),
          orderId: event.orderId,
        };

        await this.eventBus.publish('order-events', 'IngredientsReserved', reservedEvent, 'inventory-service');
      }

      await this.eventRepo.markEventProcessed(event.eventId);
      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error in HandlePurchaseCompletedUseCase`, {
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
