import { InventoryService } from '../../services/InventoryService';
import { PurchaseCompletedEvent } from '../../services/types';

export class PurchaseCompletedHandler {
  constructor(private inventoryService: InventoryService) {}

  async handle(event: PurchaseCompletedEvent): Promise<void> {
    await this.inventoryService.handlePurchaseCompleted(event);
  }
}
