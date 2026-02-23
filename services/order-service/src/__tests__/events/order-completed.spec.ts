import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { randomUUID } from 'node:crypto';
import { OrderService } from '../../services/OrderService';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { EventRepository, OrderRepository } from '../../repositories';
import { OrderCompletedEvent } from '../../services/types';

describe('Order Service - OrderCompleted Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let orderService: OrderService;

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;

    dbHelper = new TestDatabaseHelper(pool);
    const orderRepo = new OrderRepository(pool);
    const eventRepo = new EventRepository(pool);
    orderService = new OrderService(orderRepo, eventRepo, null!);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  test('should change order status to COMPLETED when OrderCompleted is received', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 2, 'COOKING');

    const eventId = randomUUID();
    const event: OrderCompletedEvent = {
      eventId,
      orderId
    };

    await orderService.handleOrderCompleted(event);

    const order = await dbHelper.getOrder(orderId);
    expect(order.status).toBe('COMPLETED');
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
  });

  test('should be idempotent for duplicate OrderCompleted events', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 2, 'WAITING_INGREDIENTS');

    const eventId = randomUUID();
    const event: OrderCompletedEvent = {
      eventId,
      orderId,
    };

    await orderService.handleOrderCompleted(event);
    const orderAfterFirstHandle = await dbHelper.getOrder(orderId);

    await orderService.handleOrderCompleted(event);
    const orderAfterSecondHandle = await dbHelper.getOrder(orderId);

    expect(orderAfterFirstHandle.status).toBe('COMPLETED');
    expect(orderAfterSecondHandle.status).toBe('COMPLETED');

    const processedCount = await dbHelper.getProcessedEventCount(eventId);
    expect(processedCount).toBe(1);
  });
});