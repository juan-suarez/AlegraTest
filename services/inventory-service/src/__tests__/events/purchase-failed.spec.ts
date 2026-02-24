import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { InventoryService, EventPublisher } from '../../services/InventoryService';
import { EventRepository, IngredientRepository, ReservationRepository } from '../../repositories';
import { PurchaseFailedHandler } from '../../events/handlers';
import { randomUUID } from 'node:crypto';

describe('Inventory Service - PurchaseFailed Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let inventoryService: InventoryService;
  let purchaseFailedHandler: PurchaseFailedHandler;
  let mockPublisher: { published: Array<any>; publish: (type: string, event: any) => Promise<void> };

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

    mockPublisher = {
      published: [],
      async publish(type: string, event: any) {
        this.published.push({ type, event });
      }
    };

    inventoryService = new InventoryService(
      pool,
      eventRepo,
      ingredientRepo,
      reservationRepo,
      mockPublisher as any
    );

    purchaseFailedHandler = new PurchaseFailedHandler(inventoryService);
  });

  test('should release all reservations and return stock when purchase fails', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId1 = randomUUID();
    const ingredientId2 = randomUUID();

    await dbHelper.createIngredient(ingredientId1, 'tomato', 5);
    await dbHelper.createIngredient(ingredientId2, 'onion', 3);

    await dbHelper.createReservation(randomUUID(), orderId, ingredientId1, 10, 5, 'PURCHASE_PENDING');
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId2, 8, 3, 'RESERVED');

    const event = {
      eventId,
      orderId,
      ingredientId: ingredientId1,
      quantityPurchased: 0 // Failed to purchase anything
    };

    await purchaseFailedHandler.handle(event);

    // All reservations should be marked as RELEASED
    const reservations = await dbHelper.getReservationsByOrder(orderId);
    expect(reservations.every(r => r.status === 'RELEASED')).toBe(true);

    // Stock should be returned
    const tomato = await dbHelper.getIngredient(ingredientId1);
    const onion = await dbHelper.getIngredient(ingredientId2);
    expect(tomato.stock).toBe(10); // 5 + 5 (returned)
    expect(onion.stock).toBe(6);   // 3 + 3 (returned)

    // Should publish IngredientsPurchaseFailed
    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].type).toBe('IngredientsPurchaseFailed');
    expect(mockPublisher.published[0].event.orderId).toBe(orderId);
  });

  test('should add partial purchased quantity to stock when purchase fails', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 0);
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId, 10, 0, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 3 // Partial purchase
    };

    await purchaseFailedHandler.handle(event);

    // Stock should include the partial purchase
    const ingredient = await dbHelper.getIngredient(ingredientId);
    expect(ingredient.stock).toBe(3); // 0 + 0 (reserved) + 3 (partial)

    // Reservation should be RELEASED
    const reservation = await dbHelper.getReservationByOrderAndIngredient(orderId, ingredientId);
    expect(reservation.status).toBe('RELEASED');
  });

  test('should handle multiple reservations being released', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId1 = randomUUID();
    const ingredientId2 = randomUUID();
    const ingredientId3 = randomUUID();

    // Create multiple ingredients with different reservation states
    await dbHelper.createIngredient(ingredientId1, 'tomato', 2);
    await dbHelper.createIngredient(ingredientId2, 'onion', 0);
    await dbHelper.createIngredient(ingredientId3, 'garlic', 5);

    await dbHelper.createReservation(randomUUID(), orderId, ingredientId1, 8, 2, 'PURCHASE_PENDING');
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId2, 5, 0, 'PURCHASE_PENDING');
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId3, 3, 3, 'RESERVED');

    const event = {
      eventId,
      orderId,
      ingredientId: ingredientId2, // Failed ingredient
      quantityPurchased: 0
    };

    await purchaseFailedHandler.handle(event);

    // All reservations should be released
    const reservations = await dbHelper.getReservationsByOrder(orderId);
    expect(reservations).toHaveLength(3);
    expect(reservations.every(r => r.status === 'RELEASED')).toBe(true);

    // All stock should be returned
    const tomato = await dbHelper.getIngredient(ingredientId1);
    const onion = await dbHelper.getIngredient(ingredientId2);
    const garlic = await dbHelper.getIngredient(ingredientId3);

    expect(tomato.stock).toBe(4);  // 2 + 2
    expect(onion.stock).toBe(0);   // 0 + 0
    expect(garlic.stock).toBe(8);  // 5 + 3
  });

  test('should be idempotent for duplicate PurchaseFailed events', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 0);
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId, 10, 0, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 2
    };

    await purchaseFailedHandler.handle(event);
    const stockAfterFirst = (await dbHelper.getIngredient(ingredientId)).stock;
    const publishedAfterFirst = mockPublisher.published.length;

    // Handle same event again
    await purchaseFailedHandler.handle(event);
    const stockAfterSecond = (await dbHelper.getIngredient(ingredientId)).stock;

    // Nothing should change
    expect(stockAfterSecond).toBe(stockAfterFirst);
    expect(mockPublisher.published.length).toBe(publishedAfterFirst);
  });

  test('should handle zero quantity purchased on failure', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 0);
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId, 10, 0, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 0 // Nothing purchased
    };

    await purchaseFailedHandler.handle(event);

    // Stock should remain 0 (nothing to add)
    const ingredient = await dbHelper.getIngredient(ingredientId);
    expect(ingredient.stock).toBe(0);

    // Should still publish failure event
    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].type).toBe('IngredientsPurchaseFailed');
  });

  test('should not release already RELEASED reservations twice', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 10);
    // Create reservation already RELEASED
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId, 5, 5, 'RELEASED');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 0
    };

    await purchaseFailedHandler.handle(event);

    // Stock should remain unchanged (already released)
    const ingredient = await dbHelper.getIngredient(ingredientId);
    expect(ingredient.stock).toBe(10); // No change

    // Should still publish failure
    expect(mockPublisher.published).toHaveLength(1);
  });

  test('should only expose eventId and orderId in published event', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();

    await dbHelper.createIngredient(ingredientId, 'tomato', 0);
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId, 10, 0, 'PURCHASE_PENDING');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 3
    };

    await purchaseFailedHandler.handle(event);

    const publishedEvent = mockPublisher.published[0];
    expect(publishedEvent.type).toBe('IngredientsPurchaseFailed');
    expect(publishedEvent.event).toEqual({
      eventId: expect.any(String),
      orderId: orderId
    });
    // Ensure no ingredient details are exposed
    expect(publishedEvent.event.ingredientId).toBeUndefined();
    expect(publishedEvent.event.reason).toBeUndefined();
  });

  test('should handle complex scenario with mixed reservation states', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId1 = randomUUID();
    const ingredientId2 = randomUUID();

    // Setup: tomato partially reserved, onion fully reserved
    await dbHelper.createIngredient(ingredientId1, 'tomato', 0);
    await dbHelper.createIngredient(ingredientId2, 'onion', 0);

    await dbHelper.createReservation(randomUUID(), orderId, ingredientId1, 10, 3, 'PURCHASE_PENDING');
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId2, 5, 5, 'RESERVED');

    const event = {
      eventId,
      orderId,
      ingredientId: ingredientId1,
      quantityPurchased: 2 // Partial purchase but not enough
    };

    await purchaseFailedHandler.handle(event);

    // Both reservations should be released
    const reservations = await dbHelper.getReservationsByOrder(orderId);
    expect(reservations.every(r => r.status === 'RELEASED')).toBe(true);

    // Check stock
    const tomato = await dbHelper.getIngredient(ingredientId1);
    const onion = await dbHelper.getIngredient(ingredientId2);

    expect(tomato.stock).toBe(5); // 0 + 3 (reserved) + 2 (partial purchase)
    expect(onion.stock).toBe(5);  // 0 + 5 (reserved)
  });

  test('should add partial purchase to stock when RELEASED reservation receives PurchaseFailed', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    const ingredientId = randomUUID();

    // Create ingredient with some stock and a RELEASED reservation
    await dbHelper.createIngredient(ingredientId, 'tomato', 5);
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId, 10, 8, 'RELEASED');

    const event = {
      eventId,
      orderId,
      ingredientId,
      quantityPurchased: 1 // Some units were purchased before failure
    };

    await purchaseFailedHandler.handle(event);

    // Stock should include the partial purchased quantity
    // Original: 5, Partial purchased: 1 → Total: 6
    const ingredient = await dbHelper.getIngredient(ingredientId);
    expect(ingredient.stock).toBe(6);

    // Reservation should remain RELEASED
    const reservation = await dbHelper.getReservationByOrderAndIngredient(orderId, ingredientId);
    expect(reservation.status).toBe('RELEASED');

    // Should publish IngredientsPurchaseFailed with minimal info
    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].type).toBe('IngredientsPurchaseFailed');
    expect(mockPublisher.published[0].event.orderId).toBe(orderId);
  });

  test('should only publish IngredientsPurchaseFailed once per order, on first failure', async () => {
    const orderId = randomUUID();
    const ingredientId1 = randomUUID();
    const ingredientId2 = randomUUID();

    // Create ingredients and reservations
    await dbHelper.createIngredient(ingredientId1, 'tomato', 0);
    await dbHelper.createIngredient(ingredientId2, 'onion', 0);

    await dbHelper.createReservation(randomUUID(), orderId, ingredientId1, 10, 5, 'PURCHASE_PENDING');
    await dbHelper.createReservation(randomUUID(), orderId, ingredientId2, 8, 3, 'PURCHASE_PENDING');

    // First failure for tomato
    const event1 = {
      eventId: randomUUID(),
      orderId,
      ingredientId: ingredientId1,
      quantityPurchased: 2
    };

    await purchaseFailedHandler.handle(event1);

    // Should publish the event
    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].type).toBe('IngredientsPurchaseFailed');
    expect(mockPublisher.published[0].event.orderId).toBe(orderId);

    // Stock should have partial purchase + ALL reserved amounts (all reservations released)
    let tomato = await dbHelper.getIngredient(ingredientId1);
    expect(tomato.stock).toBe(7); // 0 + 5 (reserved) + 2 (partial)
    
    let onion = await dbHelper.getIngredient(ingredientId2);
    expect(onion.stock).toBe(3); // 0 + 3 (reserved from onion)

    // Second failure for onion (different ingredient, same order)
    const event2 = {
      eventId: randomUUID(),
      orderId,
      ingredientId: ingredientId2,
      quantityPurchased: 1
    };

    await purchaseFailedHandler.handle(event2);

    // Should NOT publish the event again (still 1 published)
    expect(mockPublisher.published).toHaveLength(1);

    // Stock should only add the partial purchase (reservations already released)
    onion = await dbHelper.getIngredient(ingredientId2);
    expect(onion.stock).toBe(4); // 3 (already returned) + 1 (new partial)

    // Third failure for tomato again
    const event3 = {
      eventId: randomUUID(),
      orderId,
      ingredientId: ingredientId1,
      quantityPurchased: 4
    };

    await purchaseFailedHandler.handle(event3);

    // Still should NOT publish
    expect(mockPublisher.published).toHaveLength(1);

    // Stock should be updated with new partial purchase
    tomato = await dbHelper.getIngredient(ingredientId1);
    expect(tomato.stock).toBe(11); // 7 + 4 (new partial)
  });
});
