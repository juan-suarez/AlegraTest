import type { EventBusConfig } from '../infrastructure/messaging/types';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const isLocalEndpoint = (endpoint: string | undefined): boolean =>
  Boolean(endpoint && (endpoint.includes('localhost') || endpoint.includes('localstack')));

// Cache for database password
let cachedDbPassword: string | null = null;

export const globalConfig = {
  get awsRegion(): string {
    return process.env.AWS_REGION || 'us-east-1';
  },

  get awsAccountId(): string | undefined {
    return process.env.AWS_ACCOUNT_ID;
  },

  get awsEndpoint(): string | undefined {
    return process.env.AWS_ENDPOINT;
  },

  get awsAccessKeyId(): string {
    return process.env.AWS_ACCESS_KEY_ID || 'test';
  },

  get awsSecretAccessKey(): string {
    return process.env.AWS_SECRET_ACCESS_KEY || 'test';
  },

  get sqsQueueUrl(): string {
    return process.env.SQS_QUEUE_URL || '';
  },

  get pollingIntervalMs(): number {
    return parseNumber(process.env.POLLING_INTERVAL_MS, 10000);
  },

  get servicePort(): number {
    return parseNumber(process.env.SERVICE_PORT, 3001);
  },

  get enableHttpServer(): boolean {
    return process.env.ENABLE_HTTP_SERVER !== 'false';
  },

  get dbUser(): string {
    return process.env.DB_USER || 'postgres';
  },

  get dbIamUser(): string | undefined {
    return process.env.DB_IAM_USER;
  },

  get dbHost(): string | undefined {
    return process.env.DB_HOST;
  },

  get dbHostWithDefault(): string {
    return process.env.DB_HOST || 'localhost';
  },

  get dbPort(): number {
    return parseNumber(process.env.DB_PORT, 5432);
  },

  get dbName(): string {
    return process.env.DB_NAME || 'order_service';
  },

  get dbPassword(): string | undefined {
    return process.env.DB_PASSWORD;
  },

  get dbSecretArn(): string | undefined {
    return process.env.DB_SECRET_ARN;
  },

  async getDbPassword(): Promise<string> {
    // Return cached password if available
    if (cachedDbPassword !== null) {
      return cachedDbPassword;
    }

    // If DB_PASSWORD is set directly (e.g., in local development), use it
    if (this.dbPassword) {
      cachedDbPassword = this.dbPassword;
      return cachedDbPassword;
    }

    // Otherwise, fetch from Secrets Manager using the ARN
    const secretArn = this.dbSecretArn;
    if (!secretArn) {
      throw new Error('Neither DB_PASSWORD nor DB_SECRET_ARN environment variable is set');
    }

    try {
      const client = new SecretsManagerClient({ region: this.awsRegion });
      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await client.send(command);

      // The password is stored in the secret as JSON with a 'password' field
      if (response.SecretString) {
        const secretObj = JSON.parse(response.SecretString);
        cachedDbPassword = secretObj.password as string;
        return cachedDbPassword;
      }

      throw new Error('No SecretString in Secrets Manager response');
    } catch (error) {
      console.error('Failed to retrieve database password from Secrets Manager:', error);
      throw error;
    }
  },

  get isLambdaRuntime(): boolean {
    return Boolean(process.env.AWS_EXECUTION_ENV);
  },

  createEventBusConfig(options?: {
    pollingIntervalMs?: number;
    defaultQueueUrl?: string;
  }): EventBusConfig {
    const endpoint = this.awsEndpoint;
    const accountId = this.awsAccountId;

    const config: EventBusConfig = {
      region: this.awsRegion,
      queueUrl: this.sqsQueueUrl || options?.defaultQueueUrl || '',
      pollingIntervalMs: options?.pollingIntervalMs ?? this.pollingIntervalMs,
    };

    if (accountId) {
      config.accountId = accountId;
    }

    if (isLocalEndpoint(endpoint)) {
      if (endpoint) {
        config.endpoint = endpoint;
      }
      config.accessKeyId = this.awsAccessKeyId;
      config.secretAccessKey = this.awsSecretAccessKey;
    }

    return config;
  },
};