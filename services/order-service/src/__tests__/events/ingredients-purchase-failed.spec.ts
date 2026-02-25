import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { IngredientsPurchaseFailedHandler } from '../../events/handlers';
import { HandleIngredientsPurchaseFailedUseCase } from '../../use-cases';
import { OrderRepository, EventRepository } from '../../repositories';
import { randomUUID } from 'node:crypto';
import { IngredientsPurchaseFailedEvent } from '../../use-cases/types';

describe('Order Service - IngredientsPurchaseFailed Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let handler: IngredientsPurchaseFailedHandler;

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;
    dbHelper = new TestDatabaseHelper(pool);

    const orderRepo = new OrderRepository(pool);
    const eventRepo = new EventRepository(pool);
    const useCase = new HandleIngredientsPurchaseFailedUseCase(orderRepo, eventRepo);
    handler = new IngredientsPurchaseFailedHandler(useCase);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  test('should change order status to FAILED when IngredientsPurchaseFailed is received', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 2, 'WAITING_INGREDIENTS');

    const eventId = randomUUID();
    const event: IngredientsPurchaseFailedEvent = {
      eventId,
      orderId
    };

    await handler.handle(event);

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
      orderId
    };

    await handler.handle(event);
    const orderAfterFirstHandle = await dbHelper.getOrder(orderId);

    await handler.handle(event);
    const orderAfterSecondHandle = await dbHelper.getOrder(orderId);

    expect(orderAfterFirstHandle.status).toBe('FAILED');
    expect(orderAfterSecondHandle.status).toBe('FAILED');

    const processedCount = await dbHelper.getProcessedEventCount(eventId);
    expect(processedCount).toBe(1);
  });
});