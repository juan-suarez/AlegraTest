import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from './helpers/database';
import { TestDatabaseHelper } from './helpers/test-helpers';
import { randomUUID } from 'node:crypto';

describe('Inventory Service - Database Tests', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;

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
  });

  test('should initialize database successfully', async () => {
    // Test basic database connection
    const result = await pool.query('SELECT NOW()');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].now).toBeDefined();
  });

  test('should mark an event as processed for idempotency', async () => {
    const eventId = randomUUID();
    
    await dbHelper.markEventAsProcessed(eventId);

    const isProcessed = await dbHelper.isEventProcessed(eventId);
    
    expect(isProcessed).toBe(true);
  });

  describe('Ingredients', () => {
    test('should create an ingredient', async () => {
      const ingredientId = randomUUID();
      const name = 'tomato';
      const stock = 10;

      await dbHelper.createIngredient(ingredientId, name, stock);

      const ingredient = await dbHelper.getIngredient(ingredientId);
      expect(ingredient).toBeDefined();
      expect(ingredient.name).toBe(name);
      expect(ingredient.stock).toBe(stock);
    });

    test('should retrieve an ingredient by name', async () => {
      const ingredientId = randomUUID();
      const name = 'onion';
      const stock = 15;

      await dbHelper.createIngredient(ingredientId, name, stock);

      const ingredient = await dbHelper.getIngredientByName(name);
      expect(ingredient).toBeDefined();
      expect(ingredient.id).toBe(ingredientId);
      expect(ingredient.stock).toBe(stock);
    });

    test('should update ingredient stock', async () => {
      const ingredientId = randomUUID();
      await dbHelper.createIngredient(ingredientId, 'garlic', 20);

      await dbHelper.updateIngredientStock(ingredientId, 15);

      const ingredient = await dbHelper.getIngredient(ingredientId);
      expect(ingredient.stock).toBe(15);
    });

    test('should enforce unique constraint on ingredient name', async () => {
      const name = 'salt';
      await dbHelper.createIngredient(randomUUID(), name, 10);

      await expect(
        dbHelper.createIngredient(randomUUID(), name, 20)
      ).rejects.toThrow();
    });

    test('should enforce non-negative stock constraint', async () => {
      const ingredientId = randomUUID();
      
      await expect(
        dbHelper.createIngredient(ingredientId, 'pepper', -5)
      ).rejects.toThrow();
    });
  });

  describe('Reservations', () => {
    let ingredientId: string;

    beforeEach(async () => {
      ingredientId = randomUUID();
      await dbHelper.createIngredient(ingredientId, 'tomato', 20);
    });

    test('should create a reservation', async () => {
      const reservationId = randomUUID();
      const orderId = randomUUID();
      const quantityNeeded = 5;
      const quantityReserved = 5;

      await dbHelper.createReservation(
        reservationId,
        orderId,
        ingredientId,
        quantityNeeded,
        quantityReserved,
        'RESERVED'
      );

      const reservation = await dbHelper.getReservation(reservationId);
      expect(reservation).toBeDefined();
      expect(reservation.order_id).toBe(orderId);
      expect(reservation.ingredient_id).toBe(ingredientId);
      expect(reservation.quantity_needed).toBe(quantityNeeded);
      expect(reservation.quantity_reserved).toBe(quantityReserved);
      expect(reservation.status).toBe('RESERVED');
    });

    test('should retrieve reservations by order', async () => {
      const orderId = randomUUID();
      const ingredient2Id = randomUUID();
      await dbHelper.createIngredient(ingredient2Id, 'onion', 15);

      await dbHelper.createReservation(randomUUID(), orderId, ingredientId, 5, 5, 'RESERVED');
      await dbHelper.createReservation(randomUUID(), orderId, ingredient2Id, 3, 3, 'RESERVED');

      const reservations = await dbHelper.getReservationsByOrder(orderId);
      expect(reservations).toHaveLength(2);
    });

    test('should create reservation with PURCHASE_PENDING status when stock insufficient', async () => {
      const reservationId = randomUUID();
      const orderId = randomUUID();
      const quantityNeeded = 25; // More than available stock (20)
      const quantityReserved = 0; // Nothing reserved yet

      await dbHelper.createReservation(
        reservationId,
        orderId,
        ingredientId,
        quantityNeeded,
        quantityReserved,
        'PURCHASE_PENDING'
      );

      const reservation = await dbHelper.getReservation(reservationId);
      expect(reservation.status).toBe('PURCHASE_PENDING');
      expect(reservation.quantity_reserved).toBe(0);
    });

    test('should update reservation status', async () => {
      const reservationId = randomUUID();
      const orderId = randomUUID();

      await dbHelper.createReservation(
        reservationId,
        orderId,
        ingredientId,
        10,
        0,
        'PURCHASE_PENDING'
      );

      await dbHelper.updateReservationStatus(reservationId, 'RESERVED');

      const reservation = await dbHelper.getReservation(reservationId);
      expect(reservation.status).toBe('RESERVED');
    });

    test('should get reservation by order and ingredient', async () => {
      const orderId = randomUUID();
      const reservationId = randomUUID();

      await dbHelper.createReservation(
        reservationId,
        orderId,
        ingredientId,
        7,
        7,
        'RESERVED'
      );

      const reservation = await dbHelper.getReservationByOrderAndIngredient(orderId, ingredientId);
      expect(reservation).toBeDefined();
      expect(reservation.id).toBe(reservationId);
    });

    test('should allow multiple reservations for same ingredient from different orders', async () => {
      const order1Id = randomUUID();
      const order2Id = randomUUID();

      await dbHelper.createReservation(randomUUID(), order1Id, ingredientId, 5, 5, 'RESERVED');
      await dbHelper.createReservation(randomUUID(), order2Id, ingredientId, 3, 3, 'RESERVED');

      const reservations1 = await dbHelper.getReservationsByOrder(order1Id);
      const reservations2 = await dbHelper.getReservationsByOrder(order2Id);

      expect(reservations1).toHaveLength(1);
      expect(reservations2).toHaveLength(1);
    });

    test('should enforce positive quantity_needed constraint', async () => {
      await expect(
        dbHelper.createReservation(
          randomUUID(),
          randomUUID(),
          ingredientId,
          0, // quantity_needed must be > 0
          0,
          'RESERVED'
        )
      ).rejects.toThrow();
    });

    test('should enforce non-negative quantity_reserved constraint', async () => {
      await expect(
        dbHelper.createReservation(
          randomUUID(),
          randomUUID(),
          ingredientId,
          5,
          -1, // quantity_reserved cannot be negative
          'RESERVED'
        )
      ).rejects.toThrow();
    });
  });

  describe('Integration - Stock and Reservations', () => {
    test('should lock ingredient row with FOR UPDATE', async () => {
      const ingredientId = randomUUID();
      await dbHelper.createIngredient(ingredientId, 'basil', 10);

      // Start a transaction and lock the row
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          'SELECT stock FROM ingredients WHERE id = $1 FOR UPDATE',
          [ingredientId]
        );
        
        expect(result.rows[0].stock).toBe(10);
        
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    test('should update stock and create reservation atomically', async () => {
      const ingredientId = randomUUID();
      const orderId = randomUUID();
      await dbHelper.createIngredient(ingredientId, 'cheese', 15);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Lock and get current stock
        const stockResult = await client.query(
          'SELECT stock FROM ingredients WHERE id = $1 FOR UPDATE',
          [ingredientId]
        );
        const currentStock = stockResult.rows[0].stock;
        const quantityNeeded = 8;
        const quantityToReserve = Math.min(currentStock, quantityNeeded);
        
        // Update stock
        await client.query(
          'UPDATE ingredients SET stock = stock - $1 WHERE id = $2',
          [quantityToReserve, ingredientId]
        );
        
        // Create reservation
        await client.query(
          'INSERT INTO ingredient_reservations (id, order_id, ingredient_id, quantity_needed, quantity_reserved, status) VALUES ($1, $2, $3, $4, $5, $6)',
          [randomUUID(), orderId, ingredientId, quantityNeeded, quantityToReserve, 'RESERVED']
        );
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const ingredient = await dbHelper.getIngredient(ingredientId);
      const reservations = await dbHelper.getReservationsByOrder(orderId);
      
      expect(ingredient.stock).toBe(7); // 15 - 8
      expect(reservations).toHaveLength(1);
      expect(reservations[0].quantity_reserved).toBe(8);
    });
  });
});
