import { HandlePurchaseRequestedUseCase } from '../../use-cases';
import { PurchaseRequestedEvent } from '../../use-cases/types';

export class PurchaseRequestedHandler {
  constructor(private useCase: HandlePurchaseRequestedUseCase) {}

  async handle(event: PurchaseRequestedEvent): Promise<void> {
    try {
      this.validateEventStructure(event);
      await this.useCase.execute(event);
    } catch (error) {
      console.error('❌ Error in PurchaseRequestedHandler', {
        eventId: event.eventId,
        orderId: event.orderId,
        ingredientId: event.ingredientId,
        quantityRequired: event.quantityRequired,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private validateEventStructure(event: PurchaseRequestedEvent): void {
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

    if (typeof event.quantityRequired !== 'number' || event.quantityRequired <= 0) {
      throw new Error('Event must have a valid quantityRequired number');
    }
  }
}
