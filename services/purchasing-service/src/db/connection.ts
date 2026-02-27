import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import { getDbPassword } from './secrets';
import { getIAMAuthToken, isIAMAuthEnabled } from './iam-auth';

dotenv.config();

let pool: Pool | null = null;

async function ensurePoolInitialized(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  let password: string;

  // Use IAM authentication if configured, otherwise fall back to password
  if (isIAMAuthEnabled()) {
    console.log('🔐 Using IAM Database Authentication');
    password = await getIAMAuthToken();
  } else {
    console.log('🔑 Using password authentication');
    password = await getDbPassword();
  }

  pool = new Pool({
    user: isIAMAuthEnabled() ? process.env.DB_IAM_USER! : process.env.DB_USER || 'postgres',
    password,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'purchasing_service',
    ssl: { rejectUnauthorized: false }, // RDS requires SSL for all connections
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

