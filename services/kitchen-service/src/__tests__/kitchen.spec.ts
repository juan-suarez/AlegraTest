import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from './helpers/database';
import { TestDatabaseHelper } from './helpers/test-helpers';
import { randomUUID } from 'node:crypto';

describe('Kitchen Service - Database Tests', () => {
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
});