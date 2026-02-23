import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';

describe('Order Service - IngredientsReserved Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  test('should change order status to COOKING when IngredientsReserved is received', async () => {
    // Given: an order exists in WAITING_INGREDIENTS state
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    await pool.query(
      'INSERT INTO orders (id, total_dishes, status) VALUES ($1, $2, $3)',
      [orderId, 2, 'WAITING_INGREDIENTS']
    );

    // TODO: Implement event handler for IngredientsReserved
    // TODO: Verify order status changes to COOKING
    expect(true).toBe(false);
  });

  test('should be idempotent for duplicate IngredientsReserved events', async () => {
    // TODO: Test idempotency
    expect(true).toBe(false);
  });
});