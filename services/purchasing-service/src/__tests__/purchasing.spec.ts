import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from './helpers/database';
import { TestDatabaseHelper } from './helpers/test-helpers';
import { randomUUID } from 'node:crypto';

describe('Purchasing Service - Database Tests', () => {
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

  test('should return true for already processed events', async () => {
    const eventId = randomUUID();
    
    await dbHelper.markEventAsProcessed(eventId);
    
    // Check multiple times
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
  });

  test('should return false for non-processed events', async () => {
    const eventId = randomUUID();
    
    expect(await dbHelper.isEventProcessed(eventId)).toBe(false);
  });

  test('should handle ON CONFLICT gracefully when marking same event twice', async () => {
    const eventId = randomUUID();
    
    // Mark event twice should not throw
    await dbHelper.markEventAsProcessed(eventId);
    await dbHelper.markEventAsProcessed(eventId);
    
    // Should still be marked as processed
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
    
    // Should only have one entry
    const count = await dbHelper.getProcessedEventCount(eventId);
    expect(count).toBe(1);
  });
});