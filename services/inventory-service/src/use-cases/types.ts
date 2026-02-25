

export interface IngredientsRequiredEvent {
  eventId: string;
  orderId: string;
  ingredients: Record<string, number>; // { ingredientName: quantity }
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

export interface PurchaseRequestedEvent {
  eventId: string;
  orderId: string;
  ingredientId: string;
  ingredientName: string;
  quantityRequired: number;
}

