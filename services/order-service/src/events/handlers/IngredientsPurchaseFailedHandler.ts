import { OrderService } from '../../services/OrderService';
import { IngredientsPurchaseFailedEvent } from '../../services/types';

export class IngredientsPurchaseFailedHandler {
  constructor(private orderService: OrderService) {}

  async handle(event: IngredientsPurchaseFailedEvent): Promise<void> {
    await this.orderService.handleIngredientsPurchaseFailed(event);
  }
}