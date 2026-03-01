import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { EventRepository, IngredientRepository, ReservationRepository } from '../repositories';
import { EventBusLocal } from '../infrastructure/messaging';
import {
  IngredientsRequiredEvent,
  PurchaseRequestedEvent,
  IngredientsReservedEvent,
} from './types';

export class HandleIngredientsRequiredUseCase {
  constructor(
    private pool: Pool,
    private eventRepo: EventRepository,
    private ingredientRepo: IngredientRepository,
    private reservationRepo: ReservationRepository,
    private eventBus: EventBusLocal
  ) {}

  async execute(event: IngredientsRequiredEvent): Promise<void> {
    // Verificar idempotencia
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

          const quantityToPurchase = quantityNeeded - quantityToReserve;
          const BATCH_SIZE = 5;
          
          // Fraccionar en batches de 5 para reintentos más resilientes
          const numBatches = Math.ceil(quantityToPurchase / BATCH_SIZE);
          
          for (let i = 0; i < numBatches; i++) {
            const batchQuantity = Math.min(BATCH_SIZE, quantityToPurchase - (i * BATCH_SIZE));
            
            const purchaseEvent: PurchaseRequestedEvent = {
              eventId: randomUUID(),
              orderId: event.orderId,
              ingredientId: ingredient.id,
              ingredientName,
              quantityRequired: batchQuantity,
            };

            await this.eventBus.publish('PurchaseRequested', 'PurchaseRequested', purchaseEvent, 'inventory-service');
          }
        }
      }

      if (allReserved) {
        const reservedEvent: IngredientsReservedEvent = {
          eventId: randomUUID(),
          orderId: event.orderId,
        };

        await this.eventBus.publish('IngredientsReserved', 'IngredientsReserved', reservedEvent, 'inventory-service');
      }

      await this.eventRepo.markEventProcessed(event.eventId);
      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error in HandleIngredientsRequiredUseCase`, {
        eventId: event.eventId,
        orderId: event.orderId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      client.release();
    }
  }
}
