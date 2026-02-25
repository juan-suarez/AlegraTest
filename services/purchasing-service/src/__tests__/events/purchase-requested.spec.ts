import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { ProviderClient } from '../../services/ProviderClient';
import { EventRepository } from '../../repositories';
import { PurchaseRequestedHandler } from '../../events/handlers';
import { HandlePurchaseRequestedUseCase } from '../../use-cases';
import { createMockEventBus } from '../helpers/eventbus';
import { randomUUID } from 'node:crypto';
import { ProviderPurchaseResponse } from '../../services/types';

describe('Purchasing Service - PurchaseRequested Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let handlePurchaseRequestedUseCase: HandlePurchaseRequestedUseCase;
  let purchaseRequestedHandler: PurchaseRequestedHandler;
  let mockEventBus: jest.Mocked<any>;
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

    mockProviderClient = {
      purchaseIngredient: jest.fn(),
    } as any;

    mockEventBus = createMockEventBus();

    handlePurchaseRequestedUseCase = new HandlePurchaseRequestedUseCase(
      eventRepo,
      mockProviderClient,
      mockEventBus
    );

    purchaseRequestedHandler = new PurchaseRequestedHandler(handlePurchaseRequestedUseCase);
  });

  test('should complete purchase on first attempt when provider sells enough quantity', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'tomato';
    
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

    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(1);
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledWith(ingredientId);
    
    expect(mockEventBus.publish).toHaveBeenCalled();
    const publishCall = mockEventBus.publish.mock.calls[0];
    expect(publishCall[1]).toBe('PurchaseCompleted');
    expect(publishCall[2].orderId).toBe(orderId);
    expect(publishCall[2].ingredientId).toBe(ingredientId);
    expect(publishCall[2].quantityPurchased).toBe(5);
  });

  test('should complete purchase after multiple attempts when accumulating enough quantity', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'onion';
    
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

    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    expect(mockEventBus.publish).toHaveBeenCalled();
    const publishCall = mockEventBus.publish.mock.calls[0];
    expect(publishCall[1]).toBe('PurchaseCompleted');
    expect(publishCall[2].quantityPurchased).toBe(7); // 2 + 2 + 3
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

    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    expect(mockEventBus.publish).toHaveBeenCalled();
    const publishCall = mockEventBus.publish.mock.calls[0];
    expect(publishCall[1]).toBe('PurchaseFailed');
    expect(publishCall[2].orderId).toBe(orderId);
    expect(publishCall[2].ingredientId).toBe(ingredientId);
    expect(publishCall[2].quantityPurchased).toBe(3); // 1 + 1 + 1
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

    await purchaseRequestedHandler.handle(event);
    
    const firstCallCount = mockProviderClient.purchaseIngredient.mock.calls.length;
    const firstPublishCount = mockEventBus.publish.mock.calls.length;

    await purchaseRequestedHandler.handle(event);

    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(firstCallCount);
    
    expect(mockEventBus.publish).toHaveBeenCalledTimes(firstPublishCount);
  });

  test('should handle purchase that exceeds required quantity', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'salt';
    
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

    expect(mockEventBus.publish).toHaveBeenCalled();
    const publishCall = mockEventBus.publish.mock.calls[0];
    expect(publishCall[1]).toBe('PurchaseCompleted');
    expect(publishCall[2].quantityPurchased).toBe(8);
  });

  test('should implement exponential backoff between retry attempts', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'basil';
    
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

    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    expect(duration).toBeGreaterThanOrEqual(500);
  });

  test('should fail with zero quantity when provider returns nothing', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'rare-spice';
    
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

    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    expect(mockEventBus.publish).toHaveBeenCalled();
    const publishCall = mockEventBus.publish.mock.calls[0];
    expect(publishCall[1]).toBe('PurchaseFailed');
    expect(publishCall[2].quantityPurchased).toBe(0);
  });
});
