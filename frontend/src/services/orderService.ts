import type { Order, CreateOrderResponse } from '../types';
import { globalConfig } from '../config/globalConfig';
import { resolveServiceUrl } from '../config/apiRouter';
import { authService } from '../auth/authService';

const API_ENDPOINT = globalConfig.apiEndpoint;
const API_KEY = globalConfig.apiKey;
const isDev = globalConfig.isDev;
const isLocalBrowser = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const isLocalMode = isDev || isLocalBrowser;

function buildHeaders(): Record<string, string> {
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Only send x-api-key if ALL conditions are met:
  // 1. NOT in local mode (local services don't require api-key)
  // 2. An explicit API_ENDPOINT is configured (not same-origin via CloudFront)
  // 3. AND an API_KEY is actually provided
  if (!isLocalMode && API_ENDPOINT && API_KEY) {
    requestHeaders['x-api-key'] = API_KEY;
  }
  // Note: CloudFront same-origin mode (VITE_API_ENDPOINT='') doesn't send header
  // because CloudFront adds it at the origin level

  const authHeader = authService.getAuthorizationHeader();
  if (authHeader) {
    requestHeaders.Authorization = authHeader;
  }

  return requestHeaders;
}

/**
 * Builds the complete API URL
 * In local browser: uses local service routing
 * With empty API_ENDPOINT: uses CloudFront same-origin (just the path)
 * With explicit API_ENDPOINT: uses that endpoint
 */
function buildUrl(path: string): string {
  if (isLocalMode) {
    const localUrl = resolveServiceUrl(path);
    if (localUrl) {
      return `${localUrl}${path}`;
    }
  }

  // In production, if API_ENDPOINT is empty, use same-origin (CloudFront scenario)
  if (!API_ENDPOINT) {
    // Same-origin request through CloudFront
    return path;
  }

  // Otherwise use explicit API_ENDPOINT
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
        headers: buildHeaders(),
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
        headers: buildHeaders(),
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
        headers: buildHeaders(),
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
        headers: buildHeaders(),
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
        headers: buildHeaders(),
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
        headers: buildHeaders(),
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
