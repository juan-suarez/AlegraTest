import { ProviderPurchaseResponse } from './types';

export class ProviderClient {
  private readonly apiUrl = 'https://recruitment.alegra.com/api/farmers-market/buy';

  async purchaseIngredient(ingredientName: string): Promise<ProviderPurchaseResponse> {
    try {
      const url = `${this.apiUrl}?ingredient=${encodeURIComponent(ingredientName)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Provider API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { ingredient?: string; quantitySold?: number };
      
      return {
        ingredientName: data.ingredient || ingredientName,
        quantitySold: data.quantitySold || 0
      };
    } catch (error) {
      console.error(`Error purchasing ingredient ${ingredientName}:`, error);
      return {
        ingredientName,
        quantitySold: 0
      };
    }
  }
}
