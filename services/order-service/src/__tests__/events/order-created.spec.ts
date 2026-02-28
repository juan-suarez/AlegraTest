import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { createMockEventBus } from '../helpers/eventbus';
import { OrderRepository } from '../../repositories';
import { CreateOrderUseCase } from '../../use-cases/CreateOrderUseCase';
import { EventBusLocal } from '../../infrastructure/messaging';
import { randomUUID } from 'node:crypto';

// Mock EventBusLocal
jest.mock('../../infrastructure/messaging/EventBusLocal');

describe('Order Service - OrderCreated Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let createOrderUseCase: CreateOrderUseCase;
  let mockEventBus: jest.Mocked<EventBusLocal>;

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;

    dbHelper = new TestDatabaseHelper(pool);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);

    mockEventBus = createMockEventBus();

    const orderRepo = new OrderRepository(pool);
    createOrderUseCase = new CreateOrderUseCase(orderRepo, mockEventBus);
  });

  test('should create an order and publish OrderCreated event', async () => {
    const orderId = randomUUID();
    
    const event = await createOrderUseCase.execute({ orderId, totalDishes: 2 });

    const order = await dbHelper.getOrder(event.orderId);
    expect(order).not.toBeNull();
    expect(order.id).toBe(orderId);
    expect(order.total_dishes).toBe(2);
    expect(order.status).toBe('SELECTING_RECIPES');

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'OrderCreated',
      'OrderCreated',
      expect.objectContaining({
        orderId,
        totalDishes: 2,
      }),
      'order-service'
    );
  });

  test('should handle multiple orders independently', async () => {
    const orderId1 = randomUUID();
    const orderId2 = randomUUID();
    
    const event1 = await createOrderUseCase.execute({ orderId: orderId1, totalDishes: 3 });
    const event2 = await createOrderUseCase.execute({ orderId: orderId2, totalDishes: 5 });

    const order1 = await dbHelper.getOrder(event1.orderId);
    const order2 = await dbHelper.getOrder(event2.orderId);

    expect(order1.total_dishes).toBe(3);
    expect(order2.total_dishes).toBe(5);
    expect(order1.id).not.toBe(order2.id);

    expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    expect(mockEventBus.publish).toHaveBeenNthCalledWith(
      1,
      'OrderCreated',
      'OrderCreated',
      expect.objectContaining({ orderId: orderId1, totalDishes: 3 }),
      'order-service'
    );
    expect(mockEventBus.publish).toHaveBeenNthCalledWith(
      2,
      'OrderCreated',
      'OrderCreated',
      expect.objectContaining({ orderId: orderId2, totalDishes: 5 }),
      'order-service'
    );
  });
});
