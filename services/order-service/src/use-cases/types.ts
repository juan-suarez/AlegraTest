/**
 * Shared types and interfaces for order service use cases
 */

export interface Order {
  id: string;
  total_dishes: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  id: string;
  order_id: string;
  recipe_id: string;
  quantity: number;
  created_at: Date;
}

export interface CreateOrderInput {
  orderId: string;
  totalDishes: number;
}

export interface OrderCreatedEvent {
  eventId: string;
  orderId: string;
  totalDishes: number;
  timestamp: Date;
}

export interface OrderItemsSelectedEvent {
  eventId: string;
  orderId: string;
  items: Array<{
    id: string;
    recipeId: string;
    quantity: number;
  }>;
}

export interface IngredientsPurchaseFailedEvent {
  eventId: string;
  orderId: string;
}

export interface IngredientsReservedEvent {
  eventId: string;
  orderId: string;
}

export interface OrderCompletedEvent {
  eventId: string;
  orderId: string;
}
