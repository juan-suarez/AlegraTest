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

export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private eventRepo: EventRepository,
    private eventPublisher: EventPublisher // TODO: Implementar
  ) {}

  async createOrder(orderId: string, totalDishes: number): Promise<OrderCreatedEvent> {
    // Crear la orden
    const order = await this.orderRepo.create(orderId, totalDishes);

    // Cambiar estado a SELECTING_RECIPES
    await this.orderRepo.updateStatus(orderId, 'SELECTING_RECIPES');

    // Publicar evento
    const event: OrderCreatedEvent = {
      orderId,
      totalDishes,
      timestamp: new Date()
    };

    await this.eventPublisher.publish('OrderCreated', event);

    return event;
  }

  async handleOrderItemsSelected(event: OrderItemsSelectedEvent): Promise<void> {
    // Verificar idempotencia
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return; // Evento ya procesado
    }

    // Crear items de orden
    const orderItems = event.items.map((item, index) => ({
      id: `${event.eventId}-item-${index}`, // Generar IDs únicos
      order_id: event.orderId,
      recipe_id: item.recipeId,
      quantity: item.quantity
    }));

    await this.orderRepo.createOrderItems(orderItems);

    // Cambiar estado
    await this.orderRepo.updateStatus(event.orderId, 'WAITING_INGREDIENTS');

    // Marcar evento como procesado
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