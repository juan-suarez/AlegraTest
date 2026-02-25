import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { OrderItemsSelectedHandler } from '../../events/handlers';
import { HandleOrderItemsSelectedUseCase } from '../../use-cases';
import { OrderRepository, EventRepository } from '../../repositories';
import { randomUUID } from 'node:crypto';
import { OrderItemsSelectedEvent } from '../../use-cases/types';

describe('Order Service - OrderItemsSelected Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let handler: OrderItemsSelectedHandler;

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;
    dbHelper = new TestDatabaseHelper(pool);

    const orderRepo = new OrderRepository(pool);
    const eventRepo = new EventRepository(pool);
    const useCase = new HandleOrderItemsSelectedUseCase(orderRepo, eventRepo);
    handler = new OrderItemsSelectedHandler(useCase);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  test('should save order items when OrderItemsSelected is received', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 2, 'SELECTING_RECIPES');

    const eventId = randomUUID();
    const event: OrderItemsSelectedEvent = {
      eventId,
      orderId,
      items: [
        { id: randomUUID(), recipeId: randomUUID(), quantity: 1 },
        { id: randomUUID(), recipeId: randomUUID(), quantity: 1 }
      ]
    };

    await handler.handle(event);

    const orderItems = await dbHelper.getOrderItems(orderId);
    expect(orderItems).toHaveLength(2);
    expect(orderItems[0].id).toBe(event.items[0]!.id);
    expect(orderItems[1].id).toBe(event.items[1]!.id);

    const order = await dbHelper.getOrder(orderId);
    expect(order.status).toBe('WAITING_INGREDIENTS');

    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
  });

  test('should handle multiple recipes in OrderItemsSelected', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 3, 'SELECTING_RECIPES');

    const eventId = randomUUID();
    const event: OrderItemsSelectedEvent = {
      eventId,
      orderId,
      items: [
        { id: randomUUID(), recipeId: randomUUID(), quantity: 1 },
        { id: randomUUID(), recipeId: randomUUID(), quantity: 2 },
        { id: randomUUID(), recipeId: randomUUID(), quantity: 1 }
      ]
    };

    await handler.handle(event);

    const orderItems = await dbHelper.getOrderItems(orderId);
    expect(orderItems).toHaveLength(3);
    expect(orderItems.map(item => item.quantity)).toEqual([1, 2, 1]);
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
  });

  test('should be idempotent for duplicate OrderItemsSelected events', async () => {
    const orderId = randomUUID();
    await dbHelper.createOrder(orderId, 2, 'SELECTING_RECIPES');

    const eventId = randomUUID();
    const event: OrderItemsSelectedEvent = {
      eventId,
      orderId,
      items: [
        { id: randomUUID(), recipeId: randomUUID(), quantity: 1 },
        { id: randomUUID(), recipeId: randomUUID(), quantity: 1 }
      ]
    };

    await handler.handle(event);
    const itemsAfterFirstHandle = await dbHelper.getOrderItems(orderId);

    await handler.handle(event);
    const itemsAfterSecondHandle = await dbHelper.getOrderItems(orderId);

    expect(itemsAfterFirstHandle).toHaveLength(2);
    expect(itemsAfterSecondHandle).toHaveLength(2);

    const processedCount = await dbHelper.getProcessedEventCount(eventId);
    expect(processedCount).toBe(1);
  });
});