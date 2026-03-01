import { ProviderPurchaseResponse } from './types';

export class ProviderClient {
  private readonly apiUrl = 'https://recruitment.alegra.com/api/farmers-market/buy';
  private readonly REQUEST_TIMEOUT_MS = 5000; // 5 second timeout
  private readonly MAX_CONCURRENT_REQUESTS = 3; // Limit concurrent requests to external API
  private currentRequests = 0;

  async purchaseIngredient(ingredientName: string): Promise<ProviderPurchaseResponse> {
    // Wait if too many concurrent requests
    while (this.currentRequests >= this.MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.currentRequests++;
    try {
      const url = `${this.apiUrl}?ingredient=${encodeURIComponent(ingredientName)}`;
      console.log(`🌐 Calling provider API:`, { url, ingredient: ingredientName, concurrentRequests: this.currentRequests });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`⏱️ Provider API timeout after ${this.REQUEST_TIMEOUT_MS}ms for ${ingredientName}`);
      } else {
        console.error(`❌ Error purchasing ingredient ${ingredientName}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
      return {
        ingredientName,
        quantitySold: 0
      };
    } finally {
      this.currentRequests--;
    }
  }
}
