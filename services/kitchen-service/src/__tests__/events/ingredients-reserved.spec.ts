import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { createMockEventBus } from '../helpers/eventbus';
import { EventRepository } from '../../repositories';
import { IngredientsReservedHandler } from '../../events/handlers';
import { HandleIngredientsReservedUseCase } from '../../use-cases';
import { EventBusLocal } from '../../infrastructure/messaging';
import { randomUUID } from 'node:crypto';

// Mock EventBusLocal
jest.mock('../../infrastructure/messaging/EventBusLocal');

describe('Kitchen Service - IngredientsReserved Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let ingredientsReservedHandler: IngredientsReservedHandler;
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
    const useCase = new HandleIngredientsReservedUseCase(eventRepo, mockEventBus);
    ingredientsReservedHandler = new IngredientsReservedHandler(useCase);
  });

  test('should publish OrderCompleted when IngredientsReserved is received', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const event = {
      eventId,
      orderId
    };

    await ingredientsReservedHandler.handle(event);

    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'order-events',
      'OrderCompleted',
      expect.objectContaining({
        orderId,
      }),
      'kitchen-service'
    );
  });

  test('should be idempotent - processing the same event twice should only publish once', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const event = {
      eventId,
      orderId
    };

    // First call
    await ingredientsReservedHandler.handle(event);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1); // OrderCompleted
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);

    // Reset publish calls for second call
    mockEventBus.publish.mockClear();

    // Second call with same eventId
    await ingredientsReservedHandler.handle(event);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(0); // Should not publish again
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true); // Still processed
  });
});