import { HandleIngredientsRequiredUseCase } from '../../use-cases';
import { IngredientsRequiredEvent } from '../../use-cases/types';

export class IngredientsRequiredHandler {
  constructor(private useCase: HandleIngredientsRequiredUseCase) {}

  async handle(event: IngredientsRequiredEvent): Promise<void> {
    try {
      this.validateEventStructure(event);
      await this.useCase.execute(event);
    } catch (error) {
      console.error('❌ Error in IngredientsRequiredHandler', {
        eventId: event.eventId,
        orderId: event.orderId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private validateEventStructure(event: IngredientsRequiredEvent): void {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be an object');
    }

    if (!event.eventId || typeof event.eventId !== 'string') {
      throw new Error('Event must have a valid eventId string');
    }

    if (!event.orderId || typeof event.orderId !== 'string') {
      throw new Error('Event must have a valid orderId string');
    }

    if (!event.ingredients || typeof event.ingredients !== 'object') {
      throw new Error('Event must have a valid ingredients object');
    }
  }
}
