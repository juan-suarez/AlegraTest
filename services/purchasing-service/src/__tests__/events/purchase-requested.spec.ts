import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { PurchasingService, EventPublisher } from '../../services/PurchasingService';
import { ProviderClient } from '../../services/ProviderClient';
import { EventRepository } from '../../repositories';
import { PurchaseRequestedHandler } from '../../events/handlers';
import { randomUUID } from 'node:crypto';
import { ProviderPurchaseResponse } from '../../services/types';

describe('Purchasing Service - PurchaseRequested Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let purchasingService: PurchasingService;
  let purchaseRequestedHandler: PurchaseRequestedHandler;
  let mockPublisher: { published: Array<any>; publish: (type: string, event: any) => Promise<void> };
  let mockProviderClient: jest.Mocked<ProviderClient>;

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

    const eventRepo = new EventRepository(pool);
    mockPublisher = {
      published: [],
      async publish(type: string, event: any) {
        this.published.push({ type, event });
      }
    };

    // Create mock provider client
    mockProviderClient = {
      purchaseIngredient: jest.fn(),
    } as any;

    purchasingService = new PurchasingService(eventRepo, mockProviderClient, mockPublisher as any);
    purchaseRequestedHandler = new PurchaseRequestedHandler(purchasingService);
  });

  test('should complete purchase on first attempt when provider sells enough quantity', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'tomato';
    
    // Provider sells 5 units on first call
    mockProviderClient.purchaseIngredient.mockResolvedValueOnce({
      ingredientId,
      quantitySold: 5
    });

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityRequired: 5
    };

    await purchaseRequestedHandler.handle(event);

    // Should mark event as processed
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    
    // Should call provider once
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(1);
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledWith(ingredientId);
    
    // Should publish PurchaseCompleted
    expect(mockPublisher.published).toHaveLength(1);
    const published = mockPublisher.published[0];
    expect(published.type).toBe('PurchaseCompleted');
    expect(published.event.orderId).toBe(orderId);
    expect(published.event.ingredientId).toBe(ingredientId);
    expect(published.event.quantityPurchased).toBe(5);
  });

  test('should complete purchase after multiple attempts when accumulating enough quantity', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'onion';
    
    // Provider sells 2, then 2, then 3 units (total 7 >= 6 required)
    mockProviderClient.purchaseIngredient
      .mockResolvedValueOnce({ ingredientId, quantitySold: 2 })
      .mockResolvedValueOnce({ ingredientId, quantitySold: 2 })
      .mockResolvedValueOnce({ ingredientId, quantitySold: 3 });

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityRequired: 6
    };

    await purchaseRequestedHandler.handle(event);

    // Should mark event as processed
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    
    // Should call provider 3 times
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    // Should publish PurchaseCompleted with accumulated quantity
    expect(mockPublisher.published).toHaveLength(1);
    const published = mockPublisher.published[0];
    expect(published.type).toBe('PurchaseCompleted');
    expect(published.event.quantityPurchased).toBe(7); // 2 + 2 + 3
  });

  test('should fail purchase when max retries reached without getting enough quantity', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'pepper';
    
    // Provider sells only 1 unit each time (total 3 after 3 attempts, but need 10)
    mockProviderClient.purchaseIngredient.mockResolvedValue({
      ingredientId,
      quantitySold: 1
    });

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityRequired: 10
    };

    await purchaseRequestedHandler.handle(event);

    // Should mark event as processed
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    
    // Should call provider MAX_RETRIES times (3)
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    // Should publish PurchaseFailed with partial quantity
    expect(mockPublisher.published).toHaveLength(1);
    const published = mockPublisher.published[0];
    expect(published.type).toBe('PurchaseFailed');
    expect(published.event.orderId).toBe(orderId);
    expect(published.event.ingredientId).toBe(ingredientId);
    expect(published.event.quantityPurchased).toBe(3); // 1 + 1 + 1
  });

  test('should be idempotent and not reprocess duplicate PurchaseRequested events', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'garlic';
    
    mockProviderClient.purchaseIngredient.mockResolvedValue({
      ingredientId,
      quantitySold: 5
    });

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityRequired: 5
    };

    // Handle event first time
    await purchaseRequestedHandler.handle(event);
    
    const firstCallCount = mockProviderClient.purchaseIngredient.mock.calls.length;
    const firstPublishedCount = mockPublisher.published.length;

    // Handle same event again
    await purchaseRequestedHandler.handle(event);

    // Should not call provider again
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(firstCallCount);
    
    // Should not publish again
    expect(mockPublisher.published).toHaveLength(firstPublishedCount);
  });

  test('should handle purchase that exceeds required quantity', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'salt';
    
    // Provider sells 8 units, but only need 5
    mockProviderClient.purchaseIngredient.mockResolvedValueOnce({
      ingredientId,
      quantitySold: 8
    });

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityRequired: 5
    };

    await purchaseRequestedHandler.handle(event);

    // Should complete with excess quantity
    const published = mockPublisher.published[0];
    expect(published.type).toBe('PurchaseCompleted');
    expect(published.event.quantityPurchased).toBe(8);
  });

  test('should implement exponential backoff between retry attempts', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'basil';
    
    // Provider requires multiple attempts
    mockProviderClient.purchaseIngredient
      .mockResolvedValueOnce({ ingredientId, quantitySold: 1 })
      .mockResolvedValueOnce({ ingredientId, quantitySold: 1 })
      .mockResolvedValueOnce({ ingredientId, quantitySold: 8 });

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityRequired: 10
    };

    const startTime = Date.now();
    await purchaseRequestedHandler.handle(event);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should have called provider 3 times
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    // With exponential backoff (200ms + 400ms) plus network simulation (~50ms each)
    // Total should be at least 600ms (200 + 400)
    // We use a lower bound to account for test execution variance
    expect(duration).toBeGreaterThanOrEqual(500);
  });

  test('should fail with zero quantity when provider returns nothing', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'rare-spice';
    
    // Provider sells 0 units every time
    mockProviderClient.purchaseIngredient.mockResolvedValue({
      ingredientId,
      quantitySold: 0
    });

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityRequired: 5
    };

    await purchaseRequestedHandler.handle(event);

    // Should fail after max retries
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    const published = mockPublisher.published[0];
    expect(published.type).toBe('PurchaseFailed');
    expect(published.event.quantityPurchased).toBe(0);
  });
});
