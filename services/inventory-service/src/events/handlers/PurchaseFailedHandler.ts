import { InventoryService } from '../../services/InventoryService';
import { PurchaseFailedEvent } from '../../services/types';

export class PurchaseFailedHandler {
  constructor(private inventoryService: InventoryService) {}

  async handle(event: PurchaseFailedEvent): Promise<void> {
    await this.inventoryService.handlePurchaseFailed(event);
  }
}
