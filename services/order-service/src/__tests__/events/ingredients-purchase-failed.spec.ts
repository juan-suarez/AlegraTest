import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { OrderService, IngredientsPurchaseFailedEvent } from '../../services/OrderService';
import { OrderRepository, EventRepository } from '../../repositories';
import { randomUUID } from 'node:crypto';

describe('Order Service - IngredientsPurchaseFailed Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let orderService: OrderService;

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;
    dbHelper = new TestDatabaseHelper(pool);

    // Instanciar dependencias
    const orderRepo = new OrderRepository(pool);
    const eventRepo = new EventRepository(pool);
    orderService = new OrderService(orderRepo, eventRepo, null!); // null! for EventPublisher (not needed for this test)
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  test('should change order status to FAILED when IngredientsPurchaseFailed is received', async () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    await dbHelper.createOrder(orderId, 2, 'WAITING_INGREDIENTS');

    const eventId = randomUUID();
    const event: IngredientsPurchaseFailedEvent = {
      eventId,
      orderId,
      ingredientId: randomUUID(),
      reason: 'Insufficient stock'
    };

    await orderService.handleIngredientsPurchaseFailed(event);

    const order = await dbHelper.getOrder(orderId);
    expect(order.status).toBe('FAILED');
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
  });

  test('should be idempotent for duplicate IngredientsPurchaseFailed events', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 2, 'WAITING_INGREDIENTS');

    const eventId = randomUUID();
    const event: IngredientsPurchaseFailedEvent = {
      eventId,
      orderId,
      ingredientId: randomUUID(),
      reason: 'Insufficient stock'
    };

    await orderService.handleIngredientsPurchaseFailed(event);
    const orderAfterFirstHandle = await dbHelper.getOrder(orderId);

    await orderService.handleIngredientsPurchaseFailed(event);
    const orderAfterSecondHandle = await dbHelper.getOrder(orderId);

    expect(orderAfterFirstHandle.status).toBe('FAILED');
    expect(orderAfterSecondHandle.status).toBe('FAILED');

    const processedCount = await pool.query(
      'SELECT COUNT(*) FROM events_processed WHERE event_id = $1',
      [eventId]
    );
    expect(processedCount.rows[0].count).toBe('1');
  });
});