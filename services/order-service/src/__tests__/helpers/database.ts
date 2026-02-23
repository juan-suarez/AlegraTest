import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Config file written by globalSetup.ts in __tests__ folder
const CONFIG_FILE = path.join(__dirname, '../.test-db-config.json');

/**
 * Each test file gets its own Pool connected to the GLOBAL database managed by globalSetup/globalTeardown
 */
let poolForThisFile: Pool | null = null;

export async function startTestDatabase(): Promise<{
  pool: Pool;
  container: any;
}> {
  if (poolForThisFile) {
    return { pool: poolForThisFile, container: {} };
  }

  // Read the config written by globalSetup
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(
      `❌ Test database config file not found: ${CONFIG_FILE}\n` +
      'Make sure globalSetup is running (check jest.config.js has globalSetup set).'
    );
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

  // Create pool for this test file
  poolForThisFile = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  });

  // Add error listener to suppress connection errors on teardown
  poolForThisFile.on('error', (err: any) => {
    // Suppress "terminating connection" errors from container shutdown
    if (err.code !== '57P01') {
      console.error('Pool error:', err);
    }
  });

  // Verify connection works
  try {
    const client = await poolForThisFile.connect();
    client.release();
  } catch (error) {
    throw new Error(
      `❌ Failed to connect to test database at ${config.host}:${config.port}\n` +
      `Error: ${error}`
    );
  }

  // Register pool in global for cleanup
  if (!(global as any).__TEST_POOLS__) {
    (global as any).__TEST_POOLS__ = [];
  }
  (global as any).__TEST_POOLS__.push(poolForThisFile);

  // Return pool and mock container (real container is managed globally)
  return {
    pool: poolForThisFile,
    container: { getId: () => config.containerId },
  };
}

export async function stopTestDatabase(pool: Pool, container: any): Promise<void> {
  // Do NOT close the pool or container here
  // They are managed globally by globalSetup/globalTeardown
  // Jest will clean up all resources at the end
}

export async function cleanDatabase(pool: Pool): Promise<void> {
  try {
    // Truncate all tables between tests
    await pool.query('TRUNCATE TABLE order_items CASCADE');
    await pool.query('TRUNCATE TABLE orders CASCADE');
    await pool.query('TRUNCATE TABLE events_processed CASCADE');
  } catch (error) {
    console.error('Error cleaning database:', error);
    throw error;
  }
}