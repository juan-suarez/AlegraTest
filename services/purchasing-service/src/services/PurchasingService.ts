import { EventRepository } from '../repositories';
import { ProviderClient } from './ProviderClient';
import {
  PurchaseRequestedEvent,
  PurchaseCompletedEvent,
  PurchaseFailedEvent,
} from './types';
import { randomUUID } from 'node:crypto';

export class EventPublisher {
  async publish(type: string, event: any): Promise<void> {
    // TODO: Implement actual publishing
    console.log(`Publishing ${type}:`, event);
  }
}

export class PurchasingService {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 200;

  constructor(
    private eventRepo: EventRepository,
    private providerClient: ProviderClient,
    private eventPublisher: EventPublisher
  ) {}

  async handlePurchaseRequested(event: PurchaseRequestedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    let accumulatedQuantity = 0;
    let retries = 0;

    while (accumulatedQuantity < event.quantityRequired && retries < this.MAX_RETRIES) {
      if (retries > 0) {
        const delay = this.BASE_DELAY_MS * Math.pow(2, retries - 1);
        await this.delay(delay);
      }

      const response = await this.providerClient.purchaseIngredient(event.ingredientId);
      accumulatedQuantity += response.quantitySold;
      retries++;
    }

    if (accumulatedQuantity >= event.quantityRequired) {
      const completedEvent: PurchaseCompletedEvent = {
        eventId: randomUUID(),
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        quantityPurchased: accumulatedQuantity,
      };
      await this.eventPublisher.publish('PurchaseCompleted', completedEvent);
    } else {
      const failedEvent: PurchaseFailedEvent = {
        eventId: randomUUID(),
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        quantityPurchased: accumulatedQuantity,
      };
      await this.eventPublisher.publish('PurchaseFailed', failedEvent);
    }

    // Mark event as processed
    await this.eventRepo.markEventProcessed(event.eventId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
