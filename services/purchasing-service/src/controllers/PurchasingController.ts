import { IncomingMessage, ServerResponse } from 'http';
import { PurchaseHistoryRepository } from '../repositories';

export class PurchasingController {
  constructor(private purchaseHistoryRepository: PurchaseHistoryRepository) {}

  async handleGetPurchases(
    req: IncomingMessage,
    res: ServerResponse,
    queryParams?: any
  ): Promise<void> {
    try {
      const orderId = queryParams?.orderId;
      const ingredientId = queryParams?.ingredientId;
      const limit = queryParams?.limit ? parseInt(queryParams.limit, 10) : 50;

      let purchases;

      if (orderId) {
        purchases = await this.purchaseHistoryRepository.findByOrderId(orderId);
      } else if (ingredientId) {
        purchases = await this.purchaseHistoryRepository.findByIngredientId(ingredientId);
      } else {
        purchases = await this.purchaseHistoryRepository.findAll(limit);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(purchases));
    } catch (error) {
      console.error('Error fetching purchases:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  async handleGetPurchaseStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const stats = await this.purchaseHistoryRepository.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
    } catch (error) {
      console.error('Error fetching purchase stats:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
}
