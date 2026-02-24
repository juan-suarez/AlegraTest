import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { EventRepository, IngredientRepository, ReservationRepository } from '../repositories';
import {
  IngredientsRequiredEvent,
  PurchaseCompletedEvent,
  PurchaseFailedEvent,
  PurchaseRequestedEvent,
  IngredientsReservedEvent,
  IngredientsPurchaseFailedEvent,
} from './types';

export class EventPublisher {
  async publish(type: string, event: any): Promise<void> {
    // TODO: Implement actual publishing
    console.log(`Publishing ${type}:`, event);
  }
}

export class InventoryService {
  constructor(
    private pool: Pool,
    private eventRepo: EventRepository,
    private ingredientRepo: IngredientRepository,
    private reservationRepo: ReservationRepository,
    private eventPublisher: EventPublisher
  ) {}

  async handleIngredientsRequired(event: IngredientsRequiredEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let allReserved = true;

      for (const [ingredientName, quantityNeeded] of Object.entries(event.ingredients)) {
        const ingredient = await this.ingredientRepo.getByName(ingredientName);
        if (!ingredient) {
          throw new Error(`Ingredient ${ingredientName} not found`);
        }

        const currentStock = await this.ingredientRepo.lockAndGetStock(ingredient.id);
        
        const quantityToReserve = Math.min(currentStock, quantityNeeded);
        
        const newStock = Math.max(0, currentStock - quantityNeeded);
        await this.ingredientRepo.updateStock(ingredient.id, newStock);

        const needsToPurchase = quantityToReserve < quantityNeeded;
        const status = needsToPurchase ? 'PURCHASE_PENDING' : 'RESERVED';

        await this.reservationRepo.create(
          randomUUID(),
          event.orderId,
          ingredient.id,
          quantityNeeded,
          quantityToReserve,
          status,
          client
        );

        if (needsToPurchase) {
          allReserved = false;
          const purchaseEvent: PurchaseRequestedEvent = {
            eventId: randomUUID(),
            orderId: event.orderId,
            ingredientId: ingredient.id,
            quantityRequired: quantityNeeded - quantityToReserve,
          };
          await this.eventPublisher.publish('PurchaseRequested', purchaseEvent);
        }
      }

      if (allReserved) {
        const reservedEvent: IngredientsReservedEvent = {
          eventId: randomUUID(),
          orderId: event.orderId,
        };
        await this.eventPublisher.publish('IngredientsReserved', reservedEvent);
      }

      await this.eventRepo.markEventProcessed(event.eventId);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async handlePurchaseCompleted(event: PurchaseCompletedEvent): Promise<void> {
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
        console.error(`No reservation found for order ${event.orderId} and ingredient ${event.ingredientId}`);
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
        await this.eventPublisher.publish('IngredientsReserved', reservedEvent);
      }

      await this.eventRepo.markEventProcessed(event.eventId);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async handlePurchaseFailed(event: PurchaseFailedEvent): Promise<void> {
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
        await this.eventPublisher.publish('IngredientsPurchaseFailed', failedEvent);
        await this.eventRepo.markPurchaseFailedEventPublished(event.orderId);
      }

      await this.eventRepo.markEventProcessed(event.eventId);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
