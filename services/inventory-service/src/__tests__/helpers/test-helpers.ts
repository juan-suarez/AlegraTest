import { Pool } from 'pg';

// Helper functions for common database operations in tests
export class TestDatabaseHelper {
  constructor(private pool: Pool) {}

  // Event processing methods
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

  // Ingredient methods
  async createIngredient(id: string, name: string, stock: number) {
    await this.pool.query(
      'INSERT INTO ingredients (id, name, stock) VALUES ($1, $2, $3)',
      [id, name, stock]
    );
  }

  async getIngredient(id: string) {
    const result = await this.pool.query('SELECT * FROM ingredients WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getIngredientByName(name: string) {
    const result = await this.pool.query('SELECT * FROM ingredients WHERE name = $1', [name]);
    return result.rows[0];
  }

  async updateIngredientStock(id: string, stock: number) {
    await this.pool.query(
      'UPDATE ingredients SET stock = $2 WHERE id = $1',
      [id, stock]
    );
  }

  // Reservation methods
  async createReservation(
    id: string,
    orderId: string,
    ingredientId: string,
    quantityNeeded: number,
    quantityReserved: number,
    status: string = 'RESERVED'
  ) {
    await this.pool.query(
      'INSERT INTO ingredient_reservations (id, order_id, ingredient_id, quantity_needed, quantity_reserved, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, orderId, ingredientId, quantityNeeded, quantityReserved, status]
    );
  }

  async getReservation(id: string) {
    const result = await this.pool.query('SELECT * FROM ingredient_reservations WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getReservationsByOrder(orderId: string) {
    const result = await this.pool.query(
      'SELECT * FROM ingredient_reservations WHERE order_id = $1',
      [orderId]
    );
    return result.rows;
  }

  async getReservationByOrderAndIngredient(orderId: string, ingredientId: string) {
    const result = await this.pool.query(
      'SELECT * FROM ingredient_reservations WHERE order_id = $1 AND ingredient_id = $2',
      [orderId, ingredientId]
    );
    return result.rows[0];
  }

  async updateReservationStatus(id: string, status: string) {
    await this.pool.query(
      'UPDATE ingredient_reservations SET status = $2 WHERE id = $1',
      [id, status]
    );
  }

  async updateReservation(id: string, updates: { quantity_reserved?: number; status?: string }) {
    const setClauses: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    if (updates.quantity_reserved !== undefined) {
      setClauses.push(`quantity_reserved = $${paramIndex}`);
      values.push(updates.quantity_reserved);
      paramIndex++;
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (setClauses.length > 0) {
      await this.pool.query(
        `UPDATE ingredient_reservations SET ${setClauses.join(', ')} WHERE id = $1`,
        values
      );
    }
  }
}