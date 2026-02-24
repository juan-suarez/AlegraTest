import { HandleOrderItemsSelectedUseCase } from '../../use-cases';
import { OrderItemsSelectedEvent } from '../../use-cases/types';

export class OrderItemsSelectedHandler {
  constructor(private useCase: HandleOrderItemsSelectedUseCase) {}

  async handle(event: OrderItemsSelectedEvent): Promise<void> {
    try {
      this.validateEventStructure(event);
      await this.useCase.execute(event);
    } catch (error) {
      console.error('❌ Error in OrderItemsSelectedHandler:', error);
      throw error;
    }
  }

  private validateEventStructure(event: OrderItemsSelectedEvent): void {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be an object');
    }

    if (!event.eventId || typeof event.eventId !== 'string') {
      throw new Error('Event must have a valid eventId string');
    }

    if (!event.orderId || typeof event.orderId !== 'string') {
      throw new Error('Event must have a valid orderId string');
    }

    if (!Array.isArray(event.items) || event.items.length === 0) {
      throw new Error('Event must have at least one item');
    }

    for (const item of event.items) {
      if (!item.id || !item.recipeId || typeof item.quantity !== 'number') {
        throw new Error('Invalid item structure in event');
      }
    }
  }
}