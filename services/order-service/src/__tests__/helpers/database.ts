import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export async function startTestDatabase(): Promise<{
  pool: Pool;
  container: StartedPostgreSqlContainer;
}> {
  const container = await new PostgreSqlContainer('postgres:15').start();

  const pool = new Pool({
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getPassword(),
  });

  // Ejecutar el schema
  const schemaPath = path.join(__dirname, '../../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);

  return { pool, container };
}

export async function stopTestDatabase(pool: Pool, container: StartedPostgreSqlContainer): Promise<void> {
  await pool.end();
  await container.stop();
}

export async function cleanDatabase(pool: Pool): Promise<void> {
  // Truncate todas las tablas
  await pool.query('TRUNCATE TABLE order_items CASCADE');
  await pool.query('TRUNCATE TABLE orders CASCADE');
  await pool.query('TRUNCATE TABLE events_processed CASCADE');
}