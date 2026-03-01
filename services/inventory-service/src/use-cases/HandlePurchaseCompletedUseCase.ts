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
    let shouldPublishReserved = false;
    try {
      await client.query('BEGIN');

      const reservation = await this.reservationRepo.getByOrderAndIngredient(
        event.orderId,
        event.ingredientId,
        client,
        true // lockForUpdate: prevent other transactions from modifying this row
      );

      if (!reservation) {
        console.error(`No reservation found`, {
          eventId: event.eventId,
          orderId: event.orderId,
          ingredientId: event.ingredientId,
        });
        throw new Error(`Reservation not found for order ${event.orderId} and ingredient ${event.ingredientId}`);
      }

      // Already released: add entire quantity to stock
      if (reservation.status === 'RELEASED') {
        await this.ingredientRepo.addStock(event.ingredientId, event.quantityPurchased, client);
        await this.eventRepo.markEventProcessed(event.eventId, client);
        await client.query('COMMIT');
        return;
      }

      // Atomically increment reserved quantity and calculate overflow
      const { overflow, isComplete } = await this.reservationRepo.incrementAndCalculateOverflow(
        reservation.id,
        event.quantityPurchased,
        client
      );

      // Add overflow to stock
      if (overflow > 0) {
        await this.ingredientRepo.addStock(event.ingredientId, overflow, client);
      }

      // Update status if reservation is now complete
      if (isComplete) {
        await this.reservationRepo.updateStatus(reservation.id, 'RESERVED', client);
      }

      // Check if all ingredients for order are now reserved
      const allReserved = await this.reservationRepo.areAllReserved(event.orderId, client);

      if (allReserved) {
        shouldPublishReserved = true;
      }

      await this.eventRepo.markEventProcessed(event.eventId, client);
      await client.query('COMMIT');

      if (shouldPublishReserved) {
        const reservedEvent: IngredientsReservedEvent = {
          eventId: randomUUID(),
          orderId: event.orderId,
        };
        await this.eventBus.publish('IngredientsReserved', 'IngredientsReserved', reservedEvent, 'inventory-service');
      }

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
