// Event Types

export interface IngredientsRequiredEvent {
  eventId: string;
  orderId: string;
  ingredients: Record<string, number>; // { ingredientName: quantity }
}

export interface PurchaseRequestedEvent {
  eventId: string;
  orderId: string;
  ingredientId: string;
  quantityRequired: number;
}

export interface PurchaseCompletedEvent {
  eventId: string;
  orderId: string;
  ingredientId: string;
  quantityPurchased: number;
}

export interface PurchaseFailedEvent {
  eventId: string;
  orderId: string;
  ingredientId: string;
  quantityPurchased: number;
}

export interface IngredientsReservedEvent {
  eventId: string;
  orderId: string;
}

export interface IngredientsPurchaseFailedEvent {
  eventId: string;
  orderId: string;
}

// Database Models
export interface Ingredient {
  id: string;
  name: string;
  stock: number;
  created_at: Date;
  updated_at: Date;
}

export interface Reservation {
  id: string;
  order_id: string;
  ingredient_id: string;
  quantity_needed: number;
  quantity_reserved: number;
  status: 'RESERVED' | 'PURCHASE_PENDING' | 'RELEASED';
  created_at: Date;
  updated_at: Date;
}

export type ReservationStatus = 'RESERVED' | 'PURCHASE_PENDING' | 'RELEASED';
