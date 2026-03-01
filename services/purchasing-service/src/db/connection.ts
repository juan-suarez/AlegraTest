import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import { globalConfig } from '../config/globalConfig';

dotenv.config();

let pool: Pool | null = null;

async function ensurePoolInitialized(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  console.log('🔑 Initializing database connection with password authentication');
  const password = await globalConfig.getDbPassword();

  // Determine SSL configuration based on environment
  // Development/Docker: no SSL
  // Production/RDS: SSL required
  const sslConfig = process.env.NODE_ENV === 'development' ? false : { rejectUnauthorized: false };

  pool = new Pool({
    user: globalConfig.dbUser,
    password,
    host: globalConfig.dbHostWithDefault,
    port: globalConfig.dbPort,
    database: globalConfig.dbName,
    ssl: sslConfig,
    max: 3, // Reduced to prevent exhausting RDS connections with Lambda scaling
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  return pool;
}

// Export a pool-like object that lazily initializes
const poolLike = {
  async query(text: string, params?: any[]) {
    const p = await ensurePoolInitialized();
    return p.query(text, params);
  },
  async connect(): Promise<PoolClient> {
    const p = await ensurePoolInitialized();
    return p.connect();
  },
  async end() {
    if (pool) {
      return pool.end();
    }
  },
};

export const getConnection = async (): Promise<PoolClient> => {
  const p = await ensurePoolInitialized();
  return p.connect();
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export default poolLike as unknown as Pool;

