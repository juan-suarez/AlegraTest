import { Pool } from 'pg';

// Helper functions for common database operations in tests
export class TestDatabaseHelper {
  constructor(private pool: Pool) {}

  async createOrder(orderId: string, totalDishes: number, status: string = 'CREATED') {
    await this.pool.query(
      'INSERT INTO orders (id, total_dishes, status) VALUES ($1, $2, $3)',
      [orderId, totalDishes, status]
    );
  }

  async createOrderItem(itemId: string, orderId: string, recipeId: string, quantity: number) {
    await this.pool.query(
      'INSERT INTO order_items (id, order_id, recipe_id, quantity) VALUES ($1, $2, $3, $4)',
      [itemId, orderId, recipeId, quantity]
    );
  }

  async getOrder(orderId: string) {
    const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    return result.rows[0];
  }

  async getOrderItems(orderId: string) {
    const result = await this.pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    return result.rows;
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM events_processed WHERE event_id = $1',
      [eventId]
    );
    return result.rows.length > 0;
  }

  async getProcessedEventCount(eventId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM events_processed WHERE event_id = $1',
      [eventId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}