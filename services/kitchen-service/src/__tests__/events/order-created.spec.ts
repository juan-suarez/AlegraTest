import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { createMockEventBus } from '../helpers/eventbus';
import { EventRepository } from '../../repositories';
import { OrderCreatedHandler } from '../../events/handlers';
import { HandleOrderCreatedUseCase } from '../../use-cases';
import { EventBusLocal } from '../../infrastructure/messaging';
import { randomUUID } from 'node:crypto';

// Mock EventBusLocal
jest.mock('../../infrastructure/messaging/EventBusLocal');

describe('Kitchen Service - OrderCreated Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let orderCreatedHandler: OrderCreatedHandler;
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

    const eventRepo = new EventRepository(pool);
    const useCase = new HandleOrderCreatedUseCase(eventRepo, mockEventBus);
    orderCreatedHandler = new OrderCreatedHandler(useCase);
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
    expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'order-events',
      'OrderItemsSelected',
      expect.objectContaining({
        orderId,
        items: expect.any(Array),
      }),
      'kitchen-service'
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'inventory-events',
      'IngredientsRequired',
      expect.objectContaining({
        orderId,
        ingredients: expect.any(Object),
      }),
      'kitchen-service'
    );
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
    expect(mockEventBus.publish).toHaveBeenCalledTimes(2); // OrderItemsSelected and IngredientsRequired
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);

    // Reset publish calls for second call
    mockEventBus.publish.mockClear();

    // Second call with same eventId
    await orderCreatedHandler.handle(event);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(0); // Should not publish again
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true); // Still processed
  });
});