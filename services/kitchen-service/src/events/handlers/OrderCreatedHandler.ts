import { KitchenService } from '../../services/KitchenService';
import { OrderCreatedEvent } from '../../services/types';

export class OrderCreatedHandler {
  constructor(private kitchenService: KitchenService) {}

  async handle(event: OrderCreatedEvent): Promise<void> {
    await this.kitchenService.handleOrderCreated(event);
  }
}