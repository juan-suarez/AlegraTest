import { Pool } from 'pg';

// Helper functions for common database operations in tests
export class TestDatabaseHelper {
  constructor(private pool: Pool) {}

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

  async markEventAsProcessed(eventId: string) {
    await this.pool.query(
      'INSERT INTO events_processed (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [eventId]
    );
  }

  // Purchase History helpers
  async getPurchaseHistoryByOrderId(orderId: string): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM purchase_history WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );
    return result.rows;
  }

  async getPurchaseHistoryByIngredientId(ingredientId: string): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM purchase_history WHERE ingredient_id = $1 ORDER BY created_at DESC',
      [ingredientId]
    );
    return result.rows;
  }

  async getPurchaseHistoryCount(): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM purchase_history'
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getPurchaseHistoryStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
       FROM purchase_history`
    );
    return {
      total: parseInt(result.rows[0].total, 10),
      completed: parseInt(result.rows[0].completed, 10),
      failed: parseInt(result.rows[0].failed, 10),
    };
  }
}