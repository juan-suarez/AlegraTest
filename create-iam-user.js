#!/usr/bin/env node
/**
 * Simple script to create iam_lambda_user in RDS
 * Run once: node create-iam-user.js
 */
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const sm = new SecretsManagerClient({ region: 'us-east-1' });

async function main() {
  try {
    console.log('📝 Creating IAM database user...\n');

    // Get the secret
    const secretArn = 'arn:aws:secretsmanager:us-east-1:682033507228:secret:DatabasePostgresInstanceSec-kMHZNdL4Ktfm-k2llqX';
    const result = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
    const secret = JSON.parse(result.SecretString);

    // Connect as master user (postgres)
    const pool = new Pool({
      host: secret.host,
      port: secret.port,
      user: 'postgres',
      password: secret.password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    });

    const client = await pool.connect();

    try {
      // Create user (idempotent)
      await client.query(`
        DO $$ BEGIN 
          CREATE USER iam_lambda_user WITH NOINHERIT;
        EXCEPTION WHEN duplicate_object THEN 
          NULL; 
        END $$;
      `);
      console.log('✅ User created (or already exists)');

      // Grant rds_iam role
      await client.query('GRANT rds_iam TO iam_lambda_user;');
      console.log('✅ rds_iam role granted');

      // Grant connect on all databases
      await client.query('GRANT CONNECT ON DATABASE postgres TO iam_lambda_user;');
      console.log('✅ CONNECT on postgres granted');

      // Verify
      const result = await client.query(
        `SELECT usename FROM pg_user WHERE usename = 'iam_lambda_user';`
      );

      if (result.rows.length > 0) {
        console.log('\n✅ SUCCESS! User iam_lambda_user created and configured');
        console.log(`   User: ${result.rows[0].usename}`);
        process.exit(0);
      } else {
        console.log('\n❌ User creation failed');
        process.exit(1);
      }
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
