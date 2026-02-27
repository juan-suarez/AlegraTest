import { EventRepository, PurchaseHistoryRepository } from '../repositories';
import { ProviderClient } from '../externals';
import { EventBusLocal } from '../infrastructure/messaging';
import {
  PurchaseRequestedEvent,
  PurchaseCompletedEvent,
  PurchaseFailedEvent,
} from './types';
import { UseCase } from './UseCase';
import { randomUUID } from 'node:crypto';

export class HandlePurchaseRequestedUseCase implements UseCase<PurchaseRequestedEvent> {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 200;

  constructor(
    private eventRepo: EventRepository,
    private purchaseHistoryRepo: PurchaseHistoryRepository,
    private providerClient: ProviderClient,
    private eventBus: EventBusLocal
  ) {}

  async execute(event: PurchaseRequestedEvent): Promise<void> {
    console.log('🛒 HandlePurchaseRequestedUseCase.execute()', {
      orderId: event.orderId,
      ingredientName: event.ingredientName,
      quantityRequired: event.quantityRequired,
      eventId: event.eventId
    });

    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      console.log('⚠️  Event already processed, skipping');
      return;
    }

    let accumulatedQuantity = 0;
    let retries = 0;

    console.log(`🔄 Starting purchase attempts (max ${this.MAX_RETRIES} retries)...`);

    while (accumulatedQuantity < event.quantityRequired && retries < this.MAX_RETRIES) {
      if (retries > 0) {
        const delay = this.BASE_DELAY_MS * Math.pow(2, retries - 1);
        console.log(`⏳ Waiting ${delay}ms before retry ${retries}...`);
        await this.delay(delay);
      }

      console.log(`🌐 Attempt ${retries + 1}/${this.MAX_RETRIES}: Calling provider for ${event.ingredientName}...`);
      const response = await this.providerClient.purchaseIngredient(event.ingredientName);
      console.log(`📦 Provider response:`, { quantitySold: response.quantitySold, accumulated: accumulatedQuantity + response.quantitySold });
      
      accumulatedQuantity += response.quantitySold;
      retries++;
    }

    console.log(`📊 Purchase summary:`, {
      required: event.quantityRequired,
      accumulated: accumulatedQuantity,
      retries,
      success: accumulatedQuantity >= event.quantityRequired
    });

    if (accumulatedQuantity >= event.quantityRequired) {
      console.log('✅ Purchase successful, publishing PurchaseCompleted event');
      
      // Guardar en historial
      await this.purchaseHistoryRepo.create({
        id: randomUUID(),
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        ingredientName: event.ingredientName,
        quantityRequested: event.quantityRequired,
        quantityPurchased: accumulatedQuantity,
        status: 'COMPLETED',
      });
      console.log('📝 Purchase history saved (COMPLETED)');
      
      const completedEvent: PurchaseCompletedEvent = {
        eventId: randomUUID(),
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        quantityPurchased: accumulatedQuantity,
      };
      await this.eventBus.publish('PurchaseCompleted', 'PurchaseCompleted', completedEvent, 'purchasing-service');
    } else {
      console.log('❌ Purchase failed, publishing PurchaseFailed event');
      
      // Guardar en historial
      await this.purchaseHistoryRepo.create({
        id: randomUUID(),
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        ingredientName: event.ingredientName,
        quantityRequested: event.quantityRequired,
        quantityPurchased: accumulatedQuantity,
        status: 'FAILED',
      });
      console.log('📝 Purchase history saved (FAILED)');
      
      const failedEvent: PurchaseFailedEvent = {
        eventId: randomUUID(),
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        quantityPurchased: accumulatedQuantity,
      };
      await this.eventBus.publish('PurchaseFailed', 'PurchaseFailed', failedEvent, 'purchasing-service');
    }

    // Mark event as processed
    await this.eventRepo.markEventProcessed(event.eventId);
    console.log('✅ Event marked as processed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
