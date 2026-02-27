import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let cachedPassword: string | null = null;

export async function getDbPassword(): Promise<string> {
  // Return cached password if available
  if (cachedPassword !== null) {
    return cachedPassword;
  }

  // If DB_PASSWORD is set directly (e.g., in local development), use it
  if (process.env.DB_PASSWORD) {
    cachedPassword = process.env.DB_PASSWORD;
    return cachedPassword;
  }

  // Otherwise, fetch from Secrets Manager using the ARN
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('Neither DB_PASSWORD nor DB_SECRET_ARN environment variable is set');
  }

  try {
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await client.send(command);

    // The password is stored in the secret as JSON with a 'password' field
    if (response.SecretString) {
      const secretObj = JSON.parse(response.SecretString);
      cachedPassword = secretObj.password as string;
      return cachedPassword;
    }

    throw new Error('No SecretString in Secrets Manager response');
  } catch (error) {
    console.error('Failed to retrieve database password from Secrets Manager:', error);
    throw error;
  }
}
