/**
 * Shared types and interfaces for kitchen service
 */

export interface OrderCreatedEvent {
  eventId: string;
  orderId: string;
  totalDishes: number;
}

export interface IngredientsReservedEvent {
  eventId: string;
  orderId: string;
}

export interface IngredientsPurchaseFailedEvent {
  eventId: string;
  orderId: string;
  reason: string;
}

export interface OrderItemsSelectedEvent {
  eventId: string;
  orderId: string;
  items: Array<{
    recipeId: string;
    quantity: number;
  }>;
}

export interface IngredientsRequiredEvent {
  eventId: string;
  orderId: string;
  ingredients: Record<string, number>;
}

export interface OrderCompletedEvent {
  eventId: string;
  orderId: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Record<string, number>;
}