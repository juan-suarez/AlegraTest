import { EventBusLocal } from '../../infrastructure/messaging';
import { globalConfig } from '../../config/globalConfig';

/**
 * Creates a mocked EventBusLocal instance for testing
 * Captures published events in a format compatible with test assertions
 */
export function createMockEventBus(): jest.Mocked<EventBusLocal> & {
  published: Array<{ type: string; event: any }>;
} {
  const mockEventBus = new EventBusLocal({
    ...globalConfig.createEventBusConfig({
      pollingIntervalMs: 1000,
      defaultQueueUrl: 'http://localhost:4566/000000000000/inventory-service-queue',
    }),
    endpoint: globalConfig.awsEndpoint || 'http://localhost:4566',
  }) as jest.Mocked<EventBusLocal> & { published: Array<{ type: string; event: any }> };

  // Add published array to track what was published
  (mockEventBus as any).published = [];

  // Mock the publish method to capture calls
  const originalPublish = mockEventBus.publish;
  mockEventBus.publish = jest
    .fn()
    .mockImplementation(async (topicName: string, eventType: string, data: any, source: string) => {
      (mockEventBus as any).published.push({ type: eventType, event: data });
      return undefined;
    });

  // Mock other methods that might be called
  mockEventBus.startConsuming = jest.fn().mockResolvedValue(undefined);
  mockEventBus.stop = jest.fn();

  return mockEventBus;
}
