import { InventoryService } from '../../services/InventoryService';
import { IngredientsRequiredEvent } from '../../services/types';

export class IngredientsRequiredHandler {
  constructor(private inventoryService: InventoryService) {}

  async handle(event: IngredientsRequiredEvent): Promise<void> {
    await this.inventoryService.handleIngredientsRequired(event);
  }
}
