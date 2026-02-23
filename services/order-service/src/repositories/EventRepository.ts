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

  async markEventAsProcessed(eventId: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO events_processed (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [eventId]
    );
  }
}