import { HandleOrderCompletedUseCase } from '../../use-cases';
import { OrderCompletedEvent } from '../../use-cases/types';

export class OrderCompletedHandler {
  constructor(private useCase: HandleOrderCompletedUseCase) {}

  async handle(event: OrderCompletedEvent): Promise<void> {
    try {
      this.validateEventStructure(event);
      await this.useCase.execute(event);
    } catch (error) {
      console.error('❌ Error in OrderCompletedHandler', {
        eventId: event.eventId,
        orderId: event.orderId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private validateEventStructure(event: OrderCompletedEvent): void {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be an object');
    }

    if (!event.eventId || typeof event.eventId !== 'string') {
      throw new Error('Event must have a valid eventId string');
    }

    if (!event.orderId || typeof event.orderId !== 'string') {
      throw new Error('Event must have a valid orderId string');
    }
  }
}
