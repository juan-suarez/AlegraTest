import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { KitchenService, EventPublisher } from '../../services/KitchenService';
import { EventRepository } from '../../repositories';
import { IngredientsReservedHandler } from '../../events/handlers';
import { randomUUID } from 'node:crypto';

describe('Kitchen Service - IngredientsReserved Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let kitchenService: KitchenService;
  let ingredientsReservedHandler: IngredientsReservedHandler;
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
    ingredientsReservedHandler = new IngredientsReservedHandler(kitchenService);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    mockPublisher.published = [];
    await cleanDatabase(pool);
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
    expect(mockPublisher.published).toHaveLength(1);

    const completedPublished = mockPublisher.published[0];
    expect(completedPublished.type).toBe('OrderCompleted');
    expect(completedPublished.event.orderId).toBe(orderId);
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
    expect(mockPublisher.published).toHaveLength(1); // OrderCompleted
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);

    // Reset published events for second call
    mockPublisher.published = [];

    // Second call with same eventId
    await ingredientsReservedHandler.handle(event);
    expect(mockPublisher.published).toHaveLength(0); // Should not publish again
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true); // Still processed
  });
});