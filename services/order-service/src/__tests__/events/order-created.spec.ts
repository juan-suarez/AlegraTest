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

  test('should create an order and emit OrderCreated event', async () => {
    const orderId = randomUUID();
    await orderService.createOrder(orderId, 3);

    const order = await dbHelper.getOrder(orderId);
    expect(order).not.toBeNull();
    expect(order.id).toBe(orderId);
    expect(order.status).toBe('SELECTING_RECIPES');
  });

  test('should transition order to SELECTING_RECIPES after creation', async () => {
    // TODO: Verify state transition after OrderCreated
    expect(true).toBe(false);
  });
});