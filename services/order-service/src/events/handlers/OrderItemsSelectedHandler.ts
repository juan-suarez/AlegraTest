import { OrderService } from '../../services/OrderService';
import { OrderItemsSelectedEvent } from '../../services/types';

export class OrderItemsSelectedHandler {
  constructor(private orderService: OrderService) {}

  async handle(event: OrderItemsSelectedEvent): Promise<void> {
    await this.orderService.handleOrderItemsSelected(event);
  }
}