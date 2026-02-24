import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';
import { InventoryService, EventPublisher } from '../../services/InventoryService';
import { EventRepository, IngredientRepository, ReservationRepository } from '../../repositories';
import { IngredientsRequiredHandler } from '../../events/handlers';
import { randomUUID } from 'node:crypto';

describe('Inventory Service - IngredientsRequired Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;
  let inventoryService: InventoryService;
  let ingredientsRequiredHandler: IngredientsRequiredHandler;
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

    ingredientsRequiredHandler = new IngredientsRequiredHandler(inventoryService);
  });

  test('should reserve ingredients when stock is sufficient', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    
    const tomatoId = randomUUID();
    const onionId = randomUUID();
    await dbHelper.createIngredient(tomatoId, 'tomato', 20);
    await dbHelper.createIngredient(onionId, 'onion', 15);

    const event = {
      eventId,
      orderId,
      ingredients: {
        tomato: 5,
        onion: 3
      }
    };

    await ingredientsRequiredHandler.handle(event);

    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);

    const tomato = await dbHelper.getIngredient(tomatoId);
    const onion = await dbHelper.getIngredient(onionId);
    expect(tomato.stock).toBe(15); 
    expect(onion.stock).toBe(12); 

    const reservations = await dbHelper.getReservationsByOrder(orderId);
    expect(reservations).toHaveLength(2);
    expect(reservations.every(r => r.status === 'RESERVED')).toBe(true);

    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].type).toBe('IngredientsReserved');
    expect(mockPublisher.published[0].event.orderId).toBe(orderId);
  });

  test('should create PURCHASE_PENDING reservation when stock is insufficient', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    
    const tomatoId = randomUUID();
    await dbHelper.createIngredient(tomatoId, 'tomato', 3);

    const event = {
      eventId,
      orderId,
      ingredients: {
        tomato: 10
      }
    };

    await ingredientsRequiredHandler.handle(event);

    const tomato = await dbHelper.getIngredient(tomatoId);
    expect(tomato.stock).toBe(0);

    const reservation = await dbHelper.getReservationByOrderAndIngredient(orderId, tomatoId);
    expect(reservation).toBeDefined();
    expect(reservation.status).toBe('PURCHASE_PENDING');
    expect(reservation.quantity_needed).toBe(10);
    expect(reservation.quantity_reserved).toBe(3);

    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].type).toBe('PurchaseRequested');
    expect(mockPublisher.published[0].event.orderId).toBe(orderId);
    expect(mockPublisher.published[0].event.ingredientId).toBe(tomatoId);
    expect(mockPublisher.published[0].event.quantityRequired).toBe(7);
  });

  test('should handle mixed scenario: some reserved, some need purchase', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    
    const tomatoId = randomUUID();
    const onionId = randomUUID();
    await dbHelper.createIngredient(tomatoId, 'tomato', 20);
    await dbHelper.createIngredient(onionId, 'onion', 2);

    const event = {
      eventId,
      orderId,
      ingredients: {
        tomato: 5,
        onion: 10
      }
    };

    await ingredientsRequiredHandler.handle(event);

    const reservations = await dbHelper.getReservationsByOrder(orderId);
    expect(reservations).toHaveLength(2);

    const tomatoReservation = reservations.find(r => r.ingredient_id === tomatoId);
    const onionReservation = reservations.find(r => r.ingredient_id === onionId);

    expect(tomatoReservation?.status).toBe('RESERVED');
    expect(onionReservation?.status).toBe('PURCHASE_PENDING');

    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].type).toBe('PurchaseRequested');
  });

  test('should be idempotent for duplicate IngredientsRequired events', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    
    const tomatoId = randomUUID();
    await dbHelper.createIngredient(tomatoId, 'tomato', 20);

    const event = {
      eventId,
      orderId,
      ingredients: {
        tomato: 5
      }
    };

    await ingredientsRequiredHandler.handle(event);
    const stockAfterFirst = (await dbHelper.getIngredient(tomatoId)).stock;
    const reservationsAfterFirst = await dbHelper.getReservationsByOrder(orderId);

    await ingredientsRequiredHandler.handle(event);
    const stockAfterSecond = (await dbHelper.getIngredient(tomatoId)).stock;
    const reservationsAfterSecond = await dbHelper.getReservationsByOrder(orderId);

    expect(stockAfterSecond).toBe(stockAfterFirst);
    expect(reservationsAfterSecond).toHaveLength(reservationsAfterFirst.length);
  });

  test('should handle ingredient with zero stock', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    
    const tomatoId = randomUUID();
    await dbHelper.createIngredient(tomatoId, 'tomato', 0);

    const event = {
      eventId,
      orderId,
      ingredients: {
        tomato: 5
      }
    };

    await ingredientsRequiredHandler.handle(event);

    const tomato = await dbHelper.getIngredient(tomatoId);
    expect(tomato.stock).toBe(0);

    const reservation = await dbHelper.getReservationByOrderAndIngredient(orderId, tomatoId);
    expect(reservation.status).toBe('PURCHASE_PENDING');
    expect(reservation.quantity_reserved).toBe(0);
    expect(reservation.quantity_needed).toBe(5);

    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].event.quantityRequired).toBe(5);
  });

  test('should handle multiple ingredients all with sufficient stock', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();
    
    const tomatoId = randomUUID();
    const onionId = randomUUID();
    const garlicId = randomUUID();
    await dbHelper.createIngredient(tomatoId, 'tomato', 20);
    await dbHelper.createIngredient(onionId, 'onion', 15);
    await dbHelper.createIngredient(garlicId, 'garlic', 10);

    const event = {
      eventId,
      orderId,
      ingredients: {
        tomato: 5,
        onion: 3,
        garlic: 2
      }
    };

    await ingredientsRequiredHandler.handle(event);

    const reservations = await dbHelper.getReservationsByOrder(orderId);
    expect(reservations).toHaveLength(3);
    expect(reservations.every(r => r.status === 'RESERVED')).toBe(true);

    expect(mockPublisher.published).toHaveLength(1);
    expect(mockPublisher.published[0].type).toBe('IngredientsReserved');
  });

  test('should throw error when ingredient does not exist', async () => {
    const orderId = randomUUID();
    const eventId = randomUUID();

    const event = {
      eventId,
      orderId,
      ingredients: {
        'non-existent-ingredient': 5
      }
    };

    await expect(
      ingredientsRequiredHandler.handle(event)
    ).rejects.toThrow('not found');
  });
});
