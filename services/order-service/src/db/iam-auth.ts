import { Signer } from '@aws-sdk/rds-signer';

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * Generate an IAM database authentication token for RDS PostgreSQL
 * Tokens are valid for 15 minutes
 */
export async function getIAMAuthToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 1 min buffer)
  if (cachedToken && tokenExpiry && now < tokenExpiry - 60000) {
    return cachedToken;
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  const dbHost = process.env.DB_HOST;
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbIamUser = process.env.DB_IAM_USER;

  if (!dbHost || !dbIamUser) {
    throw new Error('DB_HOST and DB_IAM_USER environment variables are required for IAM auth');
  }

  try {
    // Create a signer to generate the authentication token
    const signer = new Signer({
      region,
      hostname: dbHost,
      port: dbPort,
      username: dbIamUser,
    });

    // Get the auth token (valid for 15 minutes)
    cachedToken = await signer.getAuthToken();

    // Token is valid for 15 minutes (900 seconds)
    tokenExpiry = now + 14 * 60 * 1000; // Cache for 14 minutes

    console.log('✅ Generated new IAM authentication token');
    return cachedToken;
  } catch (error) {
    console.error('Failed to generate IAM authentication token:', error);
    throw error;
  }
}

/**
 * Check if using IAM authentication
 */
export function isIAMAuthEnabled(): boolean {
  return !!process.env.DB_IAM_USER;
}
