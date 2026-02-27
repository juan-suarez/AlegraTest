import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { ProviderClient } from '../../services/ProviderClient';
import { EventRepository, PurchaseHistoryRepository } from '../../repositories';
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
    const purchaseHistoryRepo = new PurchaseHistoryRepository(pool);

    mockProviderClient = {
      purchaseIngredient: jest.fn(),
    } as any;

    mockEventBus = createMockEventBus();

    handlePurchaseRequestedUseCase = new HandlePurchaseRequestedUseCase(
      eventRepo,
      purchaseHistoryRepo,
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
      ingredientName: 'Tomato',
      quantityRequired: 5
    };

    await purchaseRequestedHandler.handle(event);

    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(1);
    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledWith(event.ingredientName);
    
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
      ingredientName: 'Onion',
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
      ingredientName: 'Pepper',
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
      ingredientName: 'Garlic',
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
      ingredientName: 'Salt',
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
      ingredientName: 'Basil',
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
      ingredientName: 'Rare Spice',
      quantityRequired: 5
    };

    await purchaseRequestedHandler.handle(event);

    expect(mockProviderClient.purchaseIngredient).toHaveBeenCalledTimes(3);
    
    expect(mockEventBus.publish).toHaveBeenCalled();
    const publishCall = mockEventBus.publish.mock.calls[0];
    expect(publishCall[1]).toBe('PurchaseFailed');
    expect(publishCall[2].quantityPurchased).toBe(0);
  });

  // ==================== Purchase History Integration Tests ====================

  test('should save purchase history when purchase is completed', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'tomato';
    const ingredientName = 'Tomato';
    
    mockProviderClient.purchaseIngredient.mockResolvedValueOnce({
      ingredientId,
      quantitySold: 5
    });

    const event = {
      eventId,
      orderId,
      ingredientId,
      ingredientName,
      quantityRequired: 5
    };

    await purchaseRequestedHandler.handle(event);

    // Verificar que se guardó en el historial
    const history = await dbHelper.getPurchaseHistoryByOrderId(orderId);
    expect(history).toHaveLength(1);
    expect(history[0].order_id).toBe(orderId);
    expect(history[0].ingredient_id).toBe(ingredientId);
    expect(history[0].ingredient_name).toBe(ingredientName);
    expect(history[0].quantity_requested).toBe(5);
    expect(history[0].quantity_purchased).toBe(5);
    expect(history[0].status).toBe('COMPLETED');
  });

  test('should save purchase history when purchase fails', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = 'pepper';
    const ingredientName = 'Pepper';
    
    mockProviderClient.purchaseIngredient.mockResolvedValue({
      ingredientId,
      quantitySold: 1
    });

    const event = {
      eventId,
      orderId,
      ingredientId,
      ingredientName,
      quantityRequired: 10
    };

    await purchaseRequestedHandler.handle(event);

    // Verificar que se guardó en el historial con status FAILED
    const history = await dbHelper.getPurchaseHistoryByOrderId(orderId);
    expect(history).toHaveLength(1);
    expect(history[0].order_id).toBe(orderId);
    expect(history[0].ingredient_id).toBe(ingredientId);
    expect(history[0].ingredient_name).toBe(ingredientName);
    expect(history[0].quantity_requested).toBe(10);
    expect(history[0].quantity_purchased).toBe(3); // 1 + 1 + 1 (3 retries)
    expect(history[0].status).toBe('FAILED');
  });
});

