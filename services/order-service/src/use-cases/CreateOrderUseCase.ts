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
    console.log(`📋 CreateOrderUseCase.execute() - orderId: ${data.orderId}, totalDishes: ${data.totalDishes}`);

    console.log(`🔍 Checking if order already exists...`);
    const existingOrder = await this.orderRepo.findById(data.orderId);
    if (existingOrder) {
      console.log(`✅ Order already exists, returning existing order`);
      return {
        eventId: randomUUID(),
        orderId: data.orderId,
        totalDishes: data.totalDishes,
        timestamp: new Date()
      };
    }

    console.log(`💾 Creating new order in database...`);
    await this.orderRepo.create(data.orderId, data.totalDishes);
    console.log(`✅ Order created in database`);

    const eventId = randomUUID();
    const event: OrderCreatedEvent = {
      eventId,
      orderId: data.orderId,
      totalDishes: data.totalDishes,
      timestamp: new Date()
    };
    
    console.log(`📤 Publishing OrderCreated event to SNS...`);
    await this.eventPublisher.publish('OrderCreated', 'OrderCreated', event, 'order-service');
    console.log(`✅ Event published successfully`);
    
    console.log(`🔄 Updating order status to SELECTING_RECIPES...`);
    await this.orderRepo.updateStatus(data.orderId, 'SELECTING_RECIPES');
    console.log(`✅ Order status updated`);

    console.log(`✨ Order creation use case completed`);
    return event;
  }
}
