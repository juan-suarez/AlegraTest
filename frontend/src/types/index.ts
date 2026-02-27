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
  name: string;
  stock: number;
  created_at: string;
  updated_at?: string;
}

export interface Reservation {
  id: string;
  order_id: string;
  ingredient_id: string;
  quantity_requested: number;
  quantity_reserved: number;
  status: string;
  created_at: string;
}

export interface PurchaseHistory {
  id: string;
  order_id: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity_requested: number;
  quantity_purchased: number;
  status: 'COMPLETED' | 'FAILED';
  created_at: string;
}

export interface PurchaseStats {
  totalPurchases: number;
  completedPurchases: number;
  failedPurchases: number;
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
