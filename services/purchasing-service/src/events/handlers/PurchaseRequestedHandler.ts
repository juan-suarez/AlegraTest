import { PurchasingService } from '../../services/PurchasingService';
import { PurchaseRequestedEvent } from '../../services/types';

export class PurchaseRequestedHandler {
  constructor(private purchasingService: PurchasingService) {}

  async handle(event: PurchaseRequestedEvent): Promise<void> {
    await this.purchasingService.handlePurchaseRequested(event);
  }
}
