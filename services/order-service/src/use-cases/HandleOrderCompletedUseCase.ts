import { OrderRepository, EventRepository } from '../repositories';
import { OrderCompletedEvent } from './types';
import { UseCase } from './UseCase';

export class HandleOrderCompletedUseCase implements UseCase<OrderCompletedEvent> {
  constructor(
    private orderRepo: OrderRepository,
    private eventRepo: EventRepository
  ) {}

  async execute(event: OrderCompletedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    await this.orderRepo.updateStatus(event.orderId, 'COMPLETED');
    await this.eventRepo.markEventAsProcessed(event.eventId);
  }

}
