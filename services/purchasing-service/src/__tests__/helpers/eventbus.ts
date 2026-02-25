import { EventBusLocal } from '../../infrastructure/messaging';

/**
 * Creates a mocked EventBusLocal instance for testing
 * Uses environment variables for configuration
 */
export function createMockEventBus(): jest.Mocked<EventBusLocal> {
	const mockEventBus = new EventBusLocal({
		region: process.env.AWS_REGION || 'us-east-1',
		endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
		queueUrl:
			process.env.SQS_QUEUE_URL ||
			'http://localhost:4566/000000000000/purchasing-service-queue',
		pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '1000', 10),
	}) as jest.Mocked<EventBusLocal>;

	// Mock the publish method to avoid actual AWS calls
	mockEventBus.publish = jest.fn().mockResolvedValue(undefined);

	// Mock other methods that might be called
	mockEventBus.startConsuming = jest.fn().mockResolvedValue(undefined);
	mockEventBus.stop = jest.fn();

	return mockEventBus;
}