import { HandlePurchaseFailedUseCase } from '../../use-cases';
import { PurchaseFailedEvent } from '../../use-cases/types';

export class PurchaseFailedHandler {
  constructor(private useCase: HandlePurchaseFailedUseCase) {}

  async handle(event: PurchaseFailedEvent): Promise<void> {
    try {
      this.validateEventStructure(event);
      await this.useCase.execute(event);
    } catch (error) {
      console.error('❌ Error in PurchaseFailedHandler', {
        eventId: event.eventId,
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private validateEventStructure(event: PurchaseFailedEvent): void {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be an object');
    }

    if (!event.eventId || typeof event.eventId !== 'string') {
      throw new Error('Event must have a valid eventId string');
    }

    if (!event.orderId || typeof event.orderId !== 'string') {
      throw new Error('Event must have a valid orderId string');
    }

    if (!event.ingredientId || typeof event.ingredientId !== 'string') {
      throw new Error('Event must have a valid ingredientId string');
    }

    if (typeof event.quantityPurchased !== 'number' || event.quantityPurchased < 0) {
      throw new Error('Event must have a valid quantityPurchased number');
    }
  }
}
