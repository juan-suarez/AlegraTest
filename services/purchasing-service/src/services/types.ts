// Event Types

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

// Provider Response
export interface ProviderPurchaseResponse {
  ingredientId: string;
  quantitySold: number;
}
