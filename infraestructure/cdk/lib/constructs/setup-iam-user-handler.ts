/**
 * Custom Resource Lambda handler to create IAM database user
 * This runs once during CloudFormation stack creation
 */
import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({});

interface CustomResourceEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceProperties: {
    DbHost: string;
    DbPort: number;
    DbSecretArn: string;
    IamUsername: string;
  };
}

async function getSecret(secretArn: string): Promise<any> {
  const result = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );
  return JSON.parse(result.SecretString!);
}

async function sendResponse(
  event: CustomResourceEvent,
  status: 'SUCCESS' | 'FAILED',
  reason: string = ''
): Promise<void> {
  const https = await import('https');
  const { URL } = await import('url');

  const responseBody = JSON.stringify({
    Status: status,
    Reason: reason,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    PhysicalResourceId: event.PhysicalResourceId || 'iam-user-setup',
  });

  const url = new URL(event.ResponseURL);
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length,
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      response.on('data', () => {});
      response.on('end', () => resolve());
    });

    request.on('error', (error) => {
      console.error('Failed to send response:', error);
      reject(error);
    });

    request.write(responseBody);
    request.end();
  });
}

async function setupIAMUser(props: CustomResourceEvent['ResourceProperties']): Promise<void> {
  const { DbHost, DbPort, DbSecretArn, IamUsername } = props;

  console.log('Setting up IAM user:', IamUsername, 'on', DbHost);

  // Get master password from Secrets Manager
  const secret = await getSecret(DbSecretArn);

  // Connect to database
  const pool = new Pool({
    host: DbHost,
    port: DbPort,
    user: 'postgres',
    password: secret.password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    // Create user if not exists (idempotent)
    await client.query(`
      DO $$ BEGIN 
        CREATE USER "${IamUsername}" WITH NOINHERIT;
      EXCEPTION WHEN duplicate_object THEN 
        NULL; 
      END $$;
    `);

    console.log('✅ User created or exists');

    // Grant rds_iam role
    await client.query(`GRANT rds_iam TO "${IamUsername}";`);
    console.log('✅ rds_iam role granted');

    // Grant connect on database
    await client.query(`GRANT CONNECT ON DATABASE postgres TO "${IamUsername}";`);
    console.log('✅ Database connect privilege granted');
  } finally {
    client.release();
    await pool.end();
  }
}

export async function handler(event: CustomResourceEvent): Promise<void> {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    if (event.RequestType === 'Delete') {
      // On delete, just acknowledge success (don't drop the user)
      await sendResponse(event, 'SUCCESS');
      return;
    }

    await setupIAMUser(event.ResourceProperties);
    await sendResponse(event, 'SUCCESS');
  } catch (error: any) {
    console.error('Handler error:', error);
    await sendResponse(event, 'FAILED', error.message);
  }
}
