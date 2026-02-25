/**
 * Shared types and interfaces for purchasing service use cases
 */

export interface PurchaseRequestedEvent {
  eventId: string;
  orderId: string;
  ingredientId: string;
  ingredientName: string;
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
