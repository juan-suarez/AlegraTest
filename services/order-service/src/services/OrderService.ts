import { OrderRepository, EventRepository } from '../repositories';

export interface OrderCreatedEvent {
  orderId: string;
  totalDishes: number;
  timestamp: Date;
}

export interface OrderItemsSelectedEvent {
  eventId: string;
  orderId: string;
  items: Array<{
    recipeId: string;
    quantity: number;
  }>;
}

export interface IngredientsPurchaseFailedEvent {
  eventId: string;
  orderId: string;
  ingredientId: string;
  reason: string;
}

export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private eventRepo: EventRepository,
    private eventPublisher: EventPublisher // TODO: Implementar
  ) {}

  async createOrder(orderId: string, totalDishes: number): Promise<OrderCreatedEvent> {
    const order = await this.orderRepo.create(orderId, totalDishes);

    await this.orderRepo.updateStatus(orderId, 'SELECTING_RECIPES');

    const event: OrderCreatedEvent = {
      orderId,
      totalDishes,
      timestamp: new Date()
    };

    await this.eventPublisher.publish('OrderCreated', event);

    return event;
  }

  async handleOrderItemsSelected(event: OrderItemsSelectedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return; 
    }

    const orderItems = event.items.map((item, index) => ({
      id: `${event.eventId}-item-${index}`, 
      order_id: event.orderId,
      recipe_id: item.recipeId,
      quantity: item.quantity
    }));

    await this.orderRepo.createOrderItems(orderItems);

    await this.orderRepo.updateStatus(event.orderId, 'WAITING_INGREDIENTS');

    await this.eventRepo.markEventAsProcessed(event.eventId);
  }

  async handleIngredientsPurchaseFailed(event: IngredientsPurchaseFailedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    await this.orderRepo.updateStatus(event.orderId, 'FAILED');

    await this.eventRepo.markEventAsProcessed(event.eventId);
  }
}

// TODO: Implementar EventPublisher
export class EventPublisher {
  async publish(eventType: string, event: any): Promise<void> {
    // TODO: Implementar publicación a SNS/SQS
    console.log(`Publishing ${eventType}:`, event);
  }
}