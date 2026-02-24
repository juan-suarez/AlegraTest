import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const CONFIG_FILE = path.join(__dirname, '.test-db-config.json');

export default async function globalSetup() {
  console.log('\n🚀 [GLOBAL SETUP] Starting single PostgreSQL container for ALL tests...\n');
  
  try {
    const container = await new PostgreSqlContainer('postgres:15')
      .withDatabase('order_service')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    const connectionConfig = {
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
    };

    // Create pool to execute schema
    const pool = new Pool(connectionConfig);

    // Apply schema
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    await pool.end();

    // Save config to file
    const config = {
      ...connectionConfig,
      containerId: container.getId(),
      timestamp: Date.now(),
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    
    // Store container globally for teardown
    (global as any).__TEST_CONTAINER__ = container;

    console.log(`✅ [GLOBAL SETUP] PostgreSQL ready at ${connectionConfig.host}:${connectionConfig.port}\n`);
  } catch (error) {
    console.error('❌ [GLOBAL SETUP] Failed to start container:', error);
    throw error;
  }
}


