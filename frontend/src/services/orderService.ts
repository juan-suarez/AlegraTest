import type { Order, CreateOrderResponse } from '../types';
import { globalConfig } from '../config/globalConfig';
import { resolveServiceUrl } from '../config/apiRouter';

const API_ENDPOINT = globalConfig.apiEndpoint;
const DEV_API_KEY = globalConfig.apiKey;
const isDev = globalConfig.isDev;
const isLocalBrowser = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};

if (isDev && DEV_API_KEY) {
  headers['x-api-key'] = DEV_API_KEY;
}

/**
 * Builds the complete API URL
 * In local browser: uses local service routing
 * Otherwise: uses centralized API Gateway endpoint
 */
function buildUrl(path: string): string {
  if (isLocalBrowser) {
    const localUrl = resolveServiceUrl(path);
    if (localUrl) {
      return `${localUrl}${path}`;
    }
  }

  return `${API_ENDPOINT}${path}`;
}

export const orderService = {
  // ORDERS
  async createOrder(totalDishes: number): Promise<CreateOrderResponse> {
    // Generar UUID v4
    const orderId = generateUUID();

    try {
      const response = await fetch(buildUrl('/orders'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId,
          totalDishes,
        }),
      });

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
      const response = await fetch(buildUrl('/orders'), {
        method: 'GET',
        headers,
      });

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

  // INVENTORY
  async getInventory() {
    try {
      const response = await fetch(buildUrl('/inventory/ingredients'), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching inventory:', error);
      throw error;
    }
  },

  async getReservations() {
    try {
      const response = await fetch(buildUrl('/inventory/reservations'), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching reservations:', error);
      throw error;
    }
  },

  // PURCHASES
  async getPurchases() {
    try {
      const response = await fetch(buildUrl('/purchases'), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching purchases:', error);
      throw error;
    }
  },

  async getPurchaseStats() {
    try {
      const response = await fetch(buildUrl('/purchases/stats'), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching purchase stats:', error);
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
