import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { randomUUID } from 'node:crypto';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { OrderService, IngredientsReservedEvent } from '../../services/OrderService';
import { EventRepository, OrderRepository } from '../../repositories';

describe('Order Service - IngredientsReserved Event', () => {
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
    await stopTestDatabase(pool,container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  test('should change order status to COOKING when IngredientsReserved is received', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 2, 'WAITING_INGREDIENTS');

    const eventId = randomUUID();
    const event: IngredientsReservedEvent = {
      eventId,
      orderId,
    };

    await orderService.handleIngredientsReserved(event);

    const order = await dbHelper.getOrder(orderId);
    expect(order.status).toBe('COOKING');
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
  });

  test('should be idempotent for duplicate IngredientsReserved events', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 2, 'WAITING_INGREDIENTS');

    const eventId = randomUUID();
    const event: IngredientsReservedEvent = {
      eventId,
      orderId,
    };

    await orderService.handleIngredientsReserved(event);
    const orderAfterFirstHandle = await dbHelper.getOrder(orderId);

    await orderService.handleIngredientsReserved(event);
    const orderAfterSecondHandle = await dbHelper.getOrder(orderId);

    expect(orderAfterFirstHandle.status).toBe('COOKING');
    expect(orderAfterSecondHandle.status).toBe('COOKING');

    const processedCount = await dbHelper.getProcessedEventCount(eventId);
    expect(processedCount).toBe(1);
  });
});