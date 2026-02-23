import { KitchenService } from '../../services/KitchenService';
import { IngredientsReservedEvent } from '../../services/types';

export class IngredientsReservedHandler {
  constructor(private kitchenService: KitchenService) {}

  async handle(event: IngredientsReservedEvent): Promise<void> {
    await this.kitchenService.handleIngredientsReserved(event);
  }
}