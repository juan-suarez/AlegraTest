import { EventBusLocal } from '../../infrastructure/messaging';
import { globalConfig } from '../../config/globalConfig';

/**
 * Creates a mocked EventBusLocal instance for testing
 * Uses environment variables for configuration
 */
export function createMockEventBus(): jest.Mocked<EventBusLocal> {
  const mockEventBus = new EventBusLocal(
    globalConfig.createEventBusConfig({ defaultQueueUrl: 'http://localhost:4566/000000000000/kitchen-service-queue' })
  ) as jest.Mocked<EventBusLocal>;

  // Mock the publish method to avoid actual AWS calls
  mockEventBus.publish = jest.fn().mockResolvedValue(undefined);

  // Mock other methods that might be called
  mockEventBus.startConsuming = jest.fn().mockResolvedValue(undefined);
  mockEventBus.stop = jest.fn();

  return mockEventBus;
}
