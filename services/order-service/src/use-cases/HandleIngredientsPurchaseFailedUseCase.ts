import { OrderRepository, EventRepository } from '../repositories';
import { IngredientsPurchaseFailedEvent } from './types';
import { UseCase } from './UseCase';


export class HandleIngredientsPurchaseFailedUseCase implements UseCase<IngredientsPurchaseFailedEvent> {
  constructor(
    private orderRepo: OrderRepository,
    private eventRepo: EventRepository
  ) {}

  async execute(event: IngredientsPurchaseFailedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    await this.orderRepo.updateStatus(event.orderId, 'FAILED');
    await this.eventRepo.markEventAsProcessed(event.eventId);

  }

}
