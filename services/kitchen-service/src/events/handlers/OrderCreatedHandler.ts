import { HandleOrderCreatedUseCase } from '../../use-cases';
import { OrderCreatedEvent } from '../../use-cases/types';

export class OrderCreatedHandler {
  constructor(private useCase: HandleOrderCreatedUseCase) {}

  async handle(event: OrderCreatedEvent): Promise<void> {
    try {
      this.validateEventStructure(event);
      await this.useCase.execute(event);
    } catch (error) {
      console.error('❌ Error in OrderCreatedHandler', {
        eventId: event.eventId,
        orderId: event.orderId,
        totalDishes: event.totalDishes,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private validateEventStructure(event: OrderCreatedEvent): void {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be an object');
    }

    if (!event.eventId || typeof event.eventId !== 'string') {
      throw new Error('Event must have a valid eventId string');
    }

    if (!event.orderId || typeof event.orderId !== 'string') {
      throw new Error('Event must have a valid orderId string');
    }

    if (typeof event.totalDishes !== 'number' || event.totalDishes <= 0) {
      throw new Error('Event must have a valid totalDishes number');
    }
  }
}