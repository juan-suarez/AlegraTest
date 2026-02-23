import { OrderService, IngredientsPurchaseFailedEvent } from '../../services/OrderService';

export class IngredientsPurchaseFailedHandler {
  constructor(private orderService: OrderService) {}

  async handle(event: IngredientsPurchaseFailedEvent): Promise<void> {
    await this.orderService.handleIngredientsPurchaseFailed(event);
  }
}