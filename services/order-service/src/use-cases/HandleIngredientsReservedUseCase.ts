import { OrderRepository, EventRepository } from '../repositories';
import { IngredientsReservedEvent } from './types';
import { UseCase } from './UseCase';

export class HandleIngredientsReservedUseCase implements UseCase<IngredientsReservedEvent> {
  constructor(
    private orderRepo: OrderRepository,
    private eventRepo: EventRepository
  ) {}

  async execute(event: IngredientsReservedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    await this.orderRepo.updateStatus(event.orderId, 'COOKING');
    await this.eventRepo.markEventAsProcessed(event.eventId);
  }
}
