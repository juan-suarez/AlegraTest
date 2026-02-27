import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from './helpers/database';
import { PurchaseHistoryRepository } from '../repositories';
import { randomUUID } from 'node:crypto';

describe('Purchasing Service - Purchase History Repository', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let purchaseHistoryRepo: PurchaseHistoryRepository;

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;
    purchaseHistoryRepo = new PurchaseHistoryRepository(pool);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  test('should create and find purchase history by order id', async () => {
    const orderId = randomUUID();

    await purchaseHistoryRepo.create({
      id: randomUUID(),
      orderId,
      ingredientId: 'tomato',
      ingredientName: 'Tomato',
      quantityRequested: 5,
      quantityPurchased: 5,
      status: 'COMPLETED',
    });

    const history = await purchaseHistoryRepo.findByOrderId(orderId);
    expect(history).toHaveLength(1);
    expect(history[0].order_id).toBe(orderId);
    expect(history[0].ingredient_name).toBe('Tomato');
    expect(history[0].status).toBe('COMPLETED');
  });

  test('should find purchase history by ingredient id', async () => {
    const ingredientId = 'tomato';

    // Crear 2 compras del mismo ingrediente
    for (let i = 0; i < 2; i++) {
      await purchaseHistoryRepo.create({
        id: randomUUID(),
        orderId: randomUUID(),
        ingredientId,
        ingredientName: 'Tomato',
        quantityRequested: 5,
        quantityPurchased: 5,
        status: 'COMPLETED',
      });
    }

    const history = await purchaseHistoryRepo.findByIngredientId(ingredientId);
    expect(history).toHaveLength(2);
    expect(history.every(h => h.ingredient_id === ingredientId)).toBe(true);
  });

  test('should calculate correct stats', async () => {
    // Crear 2 compras exitosas
    for (let i = 0; i < 2; i++) {
      await purchaseHistoryRepo.create({
        id: randomUUID(),
        orderId: randomUUID(),
        ingredientId: 'tomato',
        ingredientName: 'Tomato',
        quantityRequested: 5,
        quantityPurchased: 5,
        status: 'COMPLETED',
      });
    }

    // Crear 1 compra fallida
    await purchaseHistoryRepo.create({
      id: randomUUID(),
      orderId: randomUUID(),
      ingredientId: 'pepper',
      ingredientName: 'Pepper',
      quantityRequested: 10,
      quantityPurchased: 3,
      status: 'FAILED',
    });

    const stats = await purchaseHistoryRepo.getStats();
    expect(stats.totalPurchases).toBe(3);
    expect(stats.completedPurchases).toBe(2);
    expect(stats.failedPurchases).toBe(1);
  });

  test('should return all purchase history with limit', async () => {
    // Crear 5 registros
    for (let i = 0; i < 5; i++) {
      await purchaseHistoryRepo.create({
        id: randomUUID(),
        orderId: randomUUID(),
        ingredientId: `ingredient-${i}`,
        ingredientName: `Ingredient ${i}`,
        quantityRequested: 5,
        quantityPurchased: 5,
        status: 'COMPLETED',
      });
    }

    const history = await purchaseHistoryRepo.findAll(3);
    expect(history).toHaveLength(3);
  });

  test('should return empty array when no history exists', async () => {
    const orderId = randomUUID();
    const history = await purchaseHistoryRepo.findByOrderId(orderId);
    expect(history).toHaveLength(0);
  });

  test('should handle quantity purchased exceeding requested', async () => {
    const orderId = randomUUID();

    await purchaseHistoryRepo.create({
      id: randomUUID(),
      orderId,
      ingredientId: 'salt',
      ingredientName: 'Salt',
      quantityRequested: 5,
      quantityPurchased: 10, // Compró más de lo necesario
      status: 'COMPLETED',
    });

    const history = await purchaseHistoryRepo.findByOrderId(orderId);
    expect(history[0].quantity_requested).toBe(5);
    expect(history[0].quantity_purchased).toBe(10);
  });
});

