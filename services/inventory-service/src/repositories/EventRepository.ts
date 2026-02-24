import { Pool } from 'pg';

export class EventRepository {
  constructor(private pool: Pool) {}

  async isEventProcessed(eventId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM events_processed WHERE event_id = $1',
      [eventId]
    );
    return result.rows.length > 0;
  }

  async markEventProcessed(eventId: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO events_processed (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [eventId]
    );
  }

  async hasPurchaseFailedEventPublished(orderId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM orders_purchase_failed_published WHERE order_id = $1',
      [orderId]
    );
    return result.rows.length > 0;
  }

  async markPurchaseFailedEventPublished(orderId: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO orders_purchase_failed_published (order_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [orderId]
    );
  }
}
