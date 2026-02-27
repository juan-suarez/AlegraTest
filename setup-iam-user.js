#!/usr/bin/env node
/**
 * Setup script to create IAM database user with RDS IAM authentication
 * This must be run with the postgres master credentials
 */

const { Pool } = require('pg');

const dbHost = process.env.DB_HOST || 'restaurantstack-databasepostgresinstance819ac82a-6ri3ckdmnu6e.cyxikkgaoucr.us-east-1.rds.amazonaws.com';
const dbPort = parseInt(process.env.DB_PORT || '5432');
const masterUser = process.env.DB_MASTER_USER || 'postgres';
const masterPassword = process.env.DB_MASTER_PASSWORD;

if (!masterPassword) {
  console.error('❌ DB_MASTER_PASSWORD environment variable is required');
  console.error('   Get this from: aws secretsmanager get-secret-value --secret-id <secret-arn>');
  process.exit(1);
}

const pool = new Pool({
  host: dbHost,
  port: dbPort,
  user: masterUser,
  password: masterPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const sqls = [
  "-- Create the IAM database user",
  "CREATE USER iam_lambda_user;",
  "",
  "-- Grant the rds_iam role (enables PostgreSQL IAM Database Authentication)",
  "GRANT rds_iam TO iam_lambda_user;",
  "",
  "-- Grant database-level permissions",
  "GRANT CONNECT ON DATABASE postgres TO iam_lambda_user;",
  "GRANT CONNECT ON DATABASE order_service TO iam_lambda_user;",
  "GRANT CONNECT ON DATABASE kitchen_service TO iam_lambda_user;",
  "GRANT CONNECT ON DATABASE inventory_service TO iam_lambda_user;",
  "GRANT CONNECT ON DATABASE purchasing_service TO iam_lambda_user;",
  "",
  "-- Grant schema-level permissions",
  "GRANT USAGE ON SCHEMA public TO iam_lambda_user;",
  "",
  "-- Grant table-level permissions",
  "ALTER DEFAULT PRIVILEGES FOR USER postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO iam_lambda_user;",
  "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO iam_lambda_user;",
  "",
  "-- Grant sequence permissions",
  "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iam_lambda_user;",
  "ALTER DEFAULT PRIVILEGES FOR USER postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO iam_lambda_user;",
];

async function setupIAMUser() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Setting up IAM database user...\n');
    
    for (const sql of sqls) {
      if (sql.trim().length === 0 || sql.startsWith('--')) {
        if (sql.startsWith('--')) {
          console.log(`📝 ${sql}`);
        }
        continue;
      }
      
      try {
        console.log(`  → Executing: ${sql.substring(0, 60)}...`);
        await client.query(sql);
        console.log(`     ✅ Success`);
      } catch (err) {
        // Handle "already exists" errors gracefully
        if (err.code === '42710') {
          console.log(`     ⚠️  Already exists (skipping)`);
        } else if (err.message.includes('already exists')) {
          console.log(`     ⚠️  Already exists (skipping)`);
        } else if (err.message.includes('does not exist')) {
          console.log(`     ⚠️  Database doesn't exist (skipping)`);
        } else {
          throw err;
        }
      }
    }
    
    // Verify the user was created
    const result = await client.query(
      "SELECT usename, usecanlogin FROM pg_user WHERE usename = 'iam_lambda_user';"
    );
    
    if (result.rows.length > 0) {
      console.log('\n✅ IAM user created successfully!');
      console.log(`   User: ${result.rows[0].usename}`);
      console.log(`   Can Login: ${result.rows[0].usecanlogin}`);
    } else {
      console.log('\n❌ Failed to create IAM user');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error setting up IAM user:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

setupIAMUser();
