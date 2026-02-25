import { randomUUID } from 'node:crypto';
import { OrderRepository } from '../repositories';
import { CreateOrderInput, OrderCreatedEvent } from './types';
import { UseCase } from './UseCase';
import { EventBusLocal } from '../infrastructure/messaging';

export class CreateOrderUseCase implements UseCase<CreateOrderInput, OrderCreatedEvent> {
  constructor(
    private orderRepo: OrderRepository,
    private eventPublisher: EventBusLocal
  ) {}

  async execute(data: CreateOrderInput): Promise<OrderCreatedEvent> {
    const existingOrder = await this.orderRepo.findById(data.orderId);
    if (existingOrder) {
      return {
        orderId: data.orderId,
        totalDishes: data.totalDishes,
        timestamp: new Date()
      };
    }

    await this.orderRepo.create(data.orderId, data.totalDishes);

    const event: OrderCreatedEvent = {
      orderId: data.orderId,
      totalDishes: data.totalDishes,
      timestamp: new Date()
    };
    
    await this.eventPublisher.publish('OrderCreated', 'OrderCreated', event, 'order-service');
    await this.orderRepo.updateStatus(data.orderId, 'SELECTING_RECIPES');

    return event;
  }
}
