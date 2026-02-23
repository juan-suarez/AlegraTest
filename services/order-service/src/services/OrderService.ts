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
    id: string;
    recipeId: string;
    quantity: number;
  }>;
}

export interface IngredientsPurchaseFailedEvent {
  eventId: string;
  orderId: string;
  reason: string;
}

export interface IngredientsReservedEvent {
  eventId: string;
  orderId: string;
}

export interface OrderCompletedEvent {
  eventId: string;
  orderId: string;
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

    const orderItems = event.items.map((item) => ({
      id: item.id,
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

  async handleIngredientsReserved(event: IngredientsReservedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    await this.orderRepo.updateStatus(event.orderId, 'COOKING');
    await this.eventRepo.markEventAsProcessed(event.eventId);
  }

  async handleOrderCompleted(event: OrderCompletedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    await this.orderRepo.updateStatus(event.orderId, 'COMPLETED');
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