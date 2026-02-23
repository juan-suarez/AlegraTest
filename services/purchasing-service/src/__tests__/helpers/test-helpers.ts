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
}