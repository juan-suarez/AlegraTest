import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { KitchenService, EventPublisher } from '../../services/KitchenService';
import { EventRepository } from '../../repositories';
import { OrderCreatedHandler } from '../../events/handlers';
import { randomUUID } from 'node:crypto';

describe('Kitchen Service - OrderCreated Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let kitchenService: KitchenService;
  let orderCreatedHandler: OrderCreatedHandler;
  let mockPublisher: { published: Array<any>; publish: (type: string, event: any) => Promise<void> };

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;
    dbHelper = new TestDatabaseHelper(pool);

    const eventRepo = new EventRepository(pool);
    mockPublisher = {
      published: [],
      async publish(type: string, event: any) {
        this.published.push({ type, event });
      }
    };
    kitchenService = new KitchenService(eventRepo, mockPublisher as any);
    orderCreatedHandler = new OrderCreatedHandler(kitchenService);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    mockPublisher.published = [];
    await cleanDatabase(pool);
  });

  test('should select recipes and publish OrderItemsSelected and IngredientsRequired when OrderCreated is received', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const event = {
      eventId,
      orderId,
      totalDishes: 3
    };

    await orderCreatedHandler.handle(event);

    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    expect(mockPublisher.published).toHaveLength(2);

    const orderItemsPublished = mockPublisher.published.find(p => p.type === 'OrderItemsSelected');
    expect(orderItemsPublished).toBeDefined();
    expect(orderItemsPublished.event.orderId).toBe(orderId);
    expect(orderItemsPublished.event.items).toBeInstanceOf(Array);
    expect(orderItemsPublished.event.items.length).toBeGreaterThan(0);

    const ingredientsPublished = mockPublisher.published.find(p => p.type === 'IngredientsRequired');
    expect(ingredientsPublished).toBeDefined();
    expect(ingredientsPublished.event.orderId).toBe(orderId);
    expect(ingredientsPublished.event.ingredients).toBeInstanceOf(Object);
  });

  test('should be idempotent - processing the same event twice should only publish once', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const event = {
      eventId,
      orderId,
      totalDishes: 2
    };

    // First call
    await orderCreatedHandler.handle(event);
    expect(mockPublisher.published).toHaveLength(2); // OrderItemsSelected and IngredientsRequired
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);

    // Reset published events for second call
    mockPublisher.published = [];

    // Second call with same eventId
    await orderCreatedHandler.handle(event);
    expect(mockPublisher.published).toHaveLength(0); // Should not publish again
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true); // Still processed
  });
});