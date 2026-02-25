import { EventRepository } from '../repositories';
import { EventBusLocal } from '../infrastructure/messaging';
import { IngredientsReservedEvent, OrderCompletedEvent } from './types';
import { UseCase } from './UseCase';
import { randomUUID } from 'node:crypto';

export class HandleIngredientsReservedUseCase implements UseCase<IngredientsReservedEvent> {
  constructor(
    private eventRepo: EventRepository,
    private eventBus: EventBusLocal
  ) {}

  async execute(event: IngredientsReservedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    const completedEvent: OrderCompletedEvent = {
      eventId: randomUUID(),
      orderId: event.orderId
    };

    await this.eventBus.publish('order-events', 'OrderCompleted', completedEvent, 'kitchen-service');

    await this.eventRepo.markEventProcessed(event.eventId);
  }
}
