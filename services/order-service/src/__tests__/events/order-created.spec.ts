import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { OrderService } from '../../services/OrderService';
import { EventRepository, OrderRepository } from '../../repositories';
import { randomUUID } from 'node:crypto';

describe('Order Service - OrderCreated Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let orderService: OrderService;
  let mockPublisher: { published: Array<any>; publish: (type: string, event: any) => Promise<void> };

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;

    dbHelper = new TestDatabaseHelper(pool);
    const orderRepo = new OrderRepository(pool);
    const eventRepo = new EventRepository(pool);
    mockPublisher = {
      published: [],
      async publish(type: string, event: any) {
        this.published.push({ type, event });
      }
    };
    orderService = new OrderService(orderRepo, eventRepo, mockPublisher as any);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    mockPublisher.published = []; 
    await cleanDatabase(pool);
  });

  test('should create an order and emit OrderCreated event', async () => {
    const orderId = randomUUID();
    await orderService.createOrder(orderId, 3);

    const order = await dbHelper.getOrder(orderId);
    expect(order).not.toBeNull();
    expect(order.id).toBe(orderId);
    expect(order.status).toBe('SELECTING_RECIPES');

    expect(mockPublisher.published.length).toBe(1);
    const published = mockPublisher.published[0];
    expect(published.type).toBe('OrderCreated');
    expect(published.event).toMatchObject(
    { 
      orderId,
      totalDishes: 3 
    });
  });

  test('should be idempotent for duplicate OrderCreated calls', async () => {
    const orderId = randomUUID();
    await orderService.createOrder(orderId, 3);
    expect(mockPublisher.published.length).toBe(1);

    await orderService.createOrder(orderId, 3);
    expect(mockPublisher.published.length).toBe(1);

    const order = await dbHelper.getOrder(orderId);
    expect(order.id).toBe(orderId);
    expect(order.status).toBe('SELECTING_RECIPES');
  });

});
