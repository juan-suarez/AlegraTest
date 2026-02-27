import { ProviderPurchaseResponse } from './types';

export class ProviderClient {
  private readonly apiUrl = 'https://recruitment.alegra.com/api/farmers-market/buy';

  async purchaseIngredient(ingredientName: string): Promise<ProviderPurchaseResponse> {
    const url = `${this.apiUrl}?ingredient=${encodeURIComponent(ingredientName)}`;
    console.log(`🌐 Calling provider API:`, { url, ingredient: ingredientName });
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Provider API response:`, { status: response.status, statusText: response.statusText });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error body');
        console.error(`❌ Provider API error:`, { status: response.status, statusText: response.statusText, body: errorText });
        throw new Error(`Provider API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { ingredient?: string; quantitySold?: number };
      console.log(`✅ Provider API success:`, data);
      
      return {
        ingredientName: data.ingredient || ingredientName,
        quantitySold: data.quantitySold || 0
      };
    } catch (error) {
      console.error(`❌ Error purchasing ingredient ${ingredientName}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        ingredientName,
        quantitySold: 0
      };
    }
  }
}
