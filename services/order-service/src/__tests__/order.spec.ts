import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from './helpers/database';

describe('Order Service - Database Tests', () => {
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

  test('should create an order in the database', async () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    
    await pool.query(
      'INSERT INTO orders (id, total_dishes, status) VALUES ($1, $2, $3)',
      [orderId, 1, 'CREATED']
    );

    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('CREATED');
  });

  test('should insert order items for an order', async () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    const itemId = '660e8400-e29b-41d4-a716-446655440000';
    const recipeId = '770e8400-e29b-41d4-a716-446655440001';
    
    await pool.query(
      'INSERT INTO orders (id, total_dishes, status) VALUES ($1, $2, $3)',
      [orderId, 2, 'CREATED']
    );

    await pool.query(
      'INSERT INTO order_items (id, order_id, recipe_id, quantity) VALUES ($1, $2, $3, $4)',
      [itemId, orderId, recipeId, 2]
    );

    const result = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].quantity).toBe(2);
  });

  test('should mark an event as processed for idempotency', async () => {
    const eventId = '770e8400-e29b-41d4-a716-446655440000';
    
    await pool.query(
      'INSERT INTO events_processed (event_id) VALUES ($1)',
      [eventId]
    );

    const result = await pool.query(
      'SELECT * FROM events_processed WHERE event_id = $1',
      [eventId]
    );
    
    expect(result.rows).toHaveLength(1);
  });
});