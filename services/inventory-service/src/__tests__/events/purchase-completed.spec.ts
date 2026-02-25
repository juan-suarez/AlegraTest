import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { HandlePurchaseCompletedUseCase } from '../../use-cases';
import { EventRepository, IngredientRepository, ReservationRepository } from '../../repositories';
import { PurchaseCompletedHandler } from '../../events/handlers';
import { randomUUID } from 'node:crypto';
import { createMockEventBus } from '../helpers/eventbus';

describe('Inventory Service - PurchaseCompleted Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let handlePurchaseCompletedUseCase: HandlePurchaseCompletedUseCase;
  let purchaseCompletedHandler: PurchaseCompletedHandler;
  let mockEventBus: any;

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
    const ingredientRepo = new IngredientRepository(pool);
    const reservationRepo = new ReservationRepository(pool);

    mockEventBus = createMockEventBus();

    handlePurchaseCompletedUseCase = new HandlePurchaseCompletedUseCase(
      pool,
      eventRepo,
      ingredientRepo,
      reservationRepo,
      mockEventBus
    );

    purchaseCompletedHandler = new PurchaseCompletedHandler(handlePurchaseCompletedUseCase);
  });

  test('should update reservation to RESERVED when purchase completes', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();
    const reservationId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 0);
    await dbHelper.createReservation(reservationId, orderId, ingredientId, 10, 0, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 10
    };

    await purchaseCompletedHandler.handle(event);

    // Check reservation status changed to RESERVED
    const reservation = await dbHelper.getReservation(reservationId);
    expect(reservation.status).toBe('RESERVED');

    // No extra stock should be added (exact quantity)
    const ingredient = await dbHelper.getIngredient(ingredientId);
    expect(ingredient.stock).toBe(0);

    // Should publish IngredientsReserved if all reservations are RESERVED
    expect(mockEventBus.published).toHaveLength(1);
    expect(mockEventBus.published[0].type).toBe('IngredientsReserved');
    expect(mockEventBus.published[0].event.orderId).toBe(orderId);
  });

  test('should add excess quantity to stock when purchase exceeds need', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();
    const reservationId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 5);
    await dbHelper.createReservation(reservationId, orderId, ingredientId, 10, 0, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 15 // 5 more than needed
    };

    await purchaseCompletedHandler.handle(event);

    const reservation = await dbHelper.getReservation(reservationId);
    expect(reservation.status).toBe('RESERVED');

    const ingredient = await dbHelper.getIngredient(ingredientId);
    expect(ingredient.stock).toBe(10); // original 5 + excess 5
  });

  test('should publish IngredientsReserved only when all reservations are RESERVED', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId1 = randomUUID();
    const ingredientId2 = randomUUID();

    // Create two ingredients and reservations
    await dbHelper.createIngredient(ingredientId1, 'tomato', 0);
    await dbHelper.createIngredient(ingredientId2, 'onion', 0);
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId1, 10, 0, 'PURCHASE_PENDING');
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId2, 5, 0, 'PURCHASE_PENDING');

    // Complete first purchase
    const event1 = {
      eventId: randomUUID(),
      orderId,
      ingredientId: ingredientId1,
      quantityPurchased: 10
    };

    await purchaseCompletedHandler.handle(event1);

    // Should NOT publish IngredientsReserved yet (onion still pending)
    expect(mockEventBus.published).toHaveLength(0);

    // Complete second purchase
    const event2 = {
      eventId: randomUUID(),
      orderId,
      ingredientId: ingredientId2,
      quantityPurchased: 5
    };

    await purchaseCompletedHandler.handle(event2);

    // Now should publish IngredientsReserved
    expect(mockEventBus.published).toHaveLength(1);
    expect(mockEventBus.published[0].type).toBe('IngredientsReserved');
  });

  test('should add purchased quantity to stock if order was already released', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();
    const reservationId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 10);
    await dbHelper.createReservation(reservationId, orderId, ingredientId, 10, 0, 'RELEASED');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 8
    };

    await purchaseCompletedHandler.handle(event);

    // Should add purchased quantity to stock
    const ingredient = await dbHelper.getIngredient(ingredientId);
    expect(ingredient.stock).toBe(18); // 10 + 8

    // Reservation status should remain RELEASED
    const reservation = await dbHelper.getReservation(reservationId);
    expect(reservation.status).toBe('RELEASED');

    // Should NOT publish IngredientsReserved (order was already released)
    expect(mockEventBus.published).toHaveLength(0);
  });

  test('should be idempotent for duplicate PurchaseCompleted events', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();
    const reservationId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 5);
    await dbHelper.createReservation(reservationId, orderId, ingredientId, 10, 0, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 10
    };

    await purchaseCompletedHandler.handle(event);
    const stockAfterFirst = (await dbHelper.getIngredient(ingredientId)).stock;
    const reservationAfterFirst = await dbHelper.getReservation(reservationId);

    // Handle same event again
    await purchaseCompletedHandler.handle(event);
    const stockAfterSecond = (await dbHelper.getIngredient(ingredientId)).stock;
    const reservationAfterSecond = await dbHelper.getReservation(reservationId);

    // Nothing should change
    expect(stockAfterSecond).toBe(stockAfterFirst);
    expect(reservationAfterSecond.status).toBe(reservationAfterFirst.status);
  });

  test('should handle exact quantity match', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();
    const reservationId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 3);
    // Need 10, reserved 0
    await dbHelper.createReservation(reservationId, orderId, ingredientId, 10, 0, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 10 
    };

    await purchaseCompletedHandler.handle(event);

    const ingredient = await dbHelper.getIngredient(ingredientId);
    const reservation = await dbHelper.getReservation(reservationId);

    expect(reservation.status).toBe('RESERVED');
    expect(ingredient.stock).toBe(3); 
  });

  test('should handle partial reservation with purchase completing it', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();
    const reservationId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 0);
    await dbHelper.createReservation(reservationId, orderId, ingredientId, 10, 3, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 7
    };

    await purchaseCompletedHandler.handle(event);

    const reservation = await dbHelper.getReservation(reservationId);
    expect(reservation.status).toBe('RESERVED');

    expect(mockEventBus.published).toHaveLength(1);
    expect(mockEventBus.published[0].type).toBe('IngredientsReserved');
  });
});
