import { ProviderPurchaseResponse } from './types';

export class ProviderClient {
  private readonly apiUrl = 'https://recruitment.alegra.com/api/farmers-market/buy';

  async purchaseIngredient(ingredientId: string): Promise<ProviderPurchaseResponse> {
    try {
      const url = `${this.apiUrl}?ingredient=${encodeURIComponent(ingredientId)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Provider API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { ingredientId?: string; quantitySold?: number };
      
      return {
        ingredientId: data.ingredientId || ingredientId,
        quantitySold: data.quantitySold || 0
      };
    } catch (error) {
      console.error(`Error purchasing ingredient ${ingredientId}:`, error);
      return {
        ingredientId,
        quantitySold: 0
      };
    }
  }
}
