import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

let globalContainer: StartedPostgreSqlContainer;
let globalPool: Pool;

export async function setupTestDatabase() {
  if (globalContainer && globalPool) {
    return { container: globalContainer, pool: globalPool };
  }

  const container = await new PostgreSqlContainer('postgres:15').start();
  const pool = new Pool({
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getPassword(),
  });

  // Ejecutar el schema
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);

  globalContainer = container;
  globalPool = pool;

  return { container, pool };
}

export async function teardownTestDatabase() {
  if (globalPool) {
    await globalPool.end();
  }
  if (globalContainer) {
    await globalContainer.stop();
  }
}

export function getTestDatabase() {
  if (!globalPool || !globalContainer) {
    throw new Error('Test database not initialized. Call setupTestDatabase first.');
  }
  return { pool: globalPool, container: globalContainer };
}
