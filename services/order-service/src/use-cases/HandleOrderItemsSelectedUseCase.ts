import { OrderRepository, EventRepository } from '../repositories';
import { OrderItemsSelectedEvent } from './types';
import { UseCase } from './UseCase';

export class HandleOrderItemsSelectedUseCase implements UseCase<OrderItemsSelectedEvent> {
  constructor(
    private orderRepo: OrderRepository,
    private eventRepo: EventRepository
  ) {}

  async execute(event: OrderItemsSelectedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    const orderItems = event.items.map((item) => ({
      id: item.id,
      order_id: event.orderId,
      recipe_id: item.recipeId,
      quantity: item.quantity,
    }));

    await this.orderRepo.createOrderItems(orderItems);
    await this.orderRepo.updateStatus(event.orderId, 'WAITING_INGREDIENTS');
    await this.eventRepo.markEventAsProcessed(event.eventId);
  }
}
