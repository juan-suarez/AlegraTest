export type OrderStatus = 'CREATED' | 'SELECTING_RECIPES' | 'COOKING' | 'FAILED' | 'COMPLETED';

export interface Order {
  id: string;
  total_dishes: number;
  status: OrderStatus;
  created_at: string;
}

export interface CreateOrderResponse {
  success: boolean;
  data: {
    eventId: string;
    orderId: string;
    totalDishes: number;
    timestamp: string;
  };
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  preparationTime: number; // en minutos
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface InventoryItem {
  id: string;
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  lastUpdated: string;
}

export interface MarketPurchase {
  id: string;
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  purchaseDate: string;
}
