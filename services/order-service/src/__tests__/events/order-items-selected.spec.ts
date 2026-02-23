import { Pool } from 'pg';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { startTestDatabase, stopTestDatabase, cleanDatabase } from '../helpers/database';
import { TestDatabaseHelper } from '../helpers/test-helpers';

describe('Order Service - OrderItemsSelected Event', () => {
  let pool: Pool;
  let container: StartedPostgreSqlContainer;
  let dbHelper: TestDatabaseHelper;

  beforeAll(async () => {
    const { pool: testPool, container: testContainer } = await startTestDatabase();
    pool = testPool;
    container = testContainer;
    dbHelper = new TestDatabaseHelper(pool);
  });

  afterAll(async () => {
    await stopTestDatabase(pool, container);
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  test('should save order items when OrderItemsSelected is received', async () => {
    // Given: an order exists in SELECTING_RECIPES state
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    await dbHelper.createOrder(orderId, 2, 'SELECTING_RECIPES');

    // When: OrderItemsSelected event is received
    const eventId = 'event-123';
    const event = {
      eventId,
      orderId,
      items: [
        { recipeId: 'recipe-001', quantity: 1 },
        { recipeId: 'recipe-002', quantity: 1 }
      ]
    };

    // TODO: Call OrderService.handleOrderItemsSelected(event)

    // Then: order items should be created
    const orderItems = await dbHelper.getOrderItems(orderId);
    expect(orderItems).toHaveLength(2);

    // And: order status should change to WAITING_INGREDIENTS
    const order = await dbHelper.getOrder(orderId);
    expect(order.status).toBe('WAITING_INGREDIENTS');

    // And: event should be marked as processed
    expect(await dbHelper.isEventProcessed(eventId)).toBe(true);
  });

  test('should handle multiple recipes in OrderItemsSelected', async () => {
    // TODO: Test with multiple recipe items
    expect(true).toBe(false);
  });

  test('should be idempotent for duplicate OrderItemsSelected events', async () => {
    // TODO: Test idempotency using events_processed table
    expect(true).toBe(false);
  });
});