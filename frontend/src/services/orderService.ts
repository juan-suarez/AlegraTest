import type { Order, CreateOrderResponse } from '../types';

const isDev = import.meta.env.DEV;
const API_ENDPOINT = isDev ? '/prod' : import.meta.env.VITE_API_ENDPOINT;
const API_KEY = import.meta.env.VITE_API_KEY;

console.log('🔧 API Config:', {
  isDev,
  endpoint: API_ENDPOINT,
  apiKeyConfigured: !!API_KEY && API_KEY !== 'your_api_key_here',
  apiKeyValue: API_KEY?.substring(0, 10) + '...' || 'NOT SET',
});

if (!isDev && (!API_ENDPOINT || !API_KEY)) {
  console.warn('Missing environment variables: VITE_API_ENDPOINT or VITE_API_KEY');
}

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

export const orderService = {
  async createOrder(totalDishes: number): Promise<CreateOrderResponse> {
    // Generar UUID v4
    const orderId = generateUUID();

    try {
      const response = await fetch(`${API_ENDPOINT}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId,
          totalDishes,
        }),
      });

      if (response.status === 403) {
        throw new Error('Forbidden: Invalid API Key');
      }

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  async getOrders(): Promise<Order[]> {
    try {
      const response = await fetch(`${API_ENDPOINT}/orders`, {
        method: 'GET',
        headers,
      });

      if (response.status === 403) {
        throw new Error('Forbidden: Invalid API Key');
      }

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  },
};

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
