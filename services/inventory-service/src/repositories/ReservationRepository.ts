import { Pool, PoolClient } from 'pg';
import { Reservation, ReservationStatus } from './interfaces';

export class ReservationRepository {
  constructor(private pool: Pool) {}

  async create(
    id: string,
    orderId: string,
    ingredientId: string,
    quantityNeeded: number,
    quantityReserved: number,
    status: ReservationStatus,
    client?: PoolClient
  ): Promise<Reservation> {
    const executor = client || this.pool;
    const result = await executor.query(
      `INSERT INTO ingredient_reservations 
       (id, order_id, ingredient_id, quantity_needed, quantity_reserved, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [id, orderId, ingredientId, quantityNeeded, quantityReserved, status]
    );
    return result.rows[0];
  }

  async getByOrderAndIngredient(
    orderId: string,
    ingredientId: string
  ): Promise<Reservation | null> {
    const result = await this.pool.query(
      'SELECT * FROM ingredient_reservations WHERE order_id = $1 AND ingredient_id = $2',
      [orderId, ingredientId]
    );
    return result.rows[0] || null;
  }

  async getByOrder(orderId: string): Promise<Reservation[]> {
    const result = await this.pool.query(
      'SELECT * FROM ingredient_reservations WHERE order_id = $1',
      [orderId]
    );
    return result.rows;
  }

  async updateStatus(
    reservationId: string,
    status: ReservationStatus
  ): Promise<void> {
    await this.pool.query(
      'UPDATE ingredient_reservations SET status = $2, updated_at = NOW() WHERE id = $1',
      [reservationId, status]
    );
  }

  async areAllReserved(orderId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) as reserved
       FROM ingredient_reservations 
       WHERE order_id = $1`,
      [orderId]
    );
    const { total, reserved } = result.rows[0];
    return parseInt(total) > 0 && parseInt(total) === parseInt(reserved);
  }

  async releaseAllForOrder(orderId: string): Promise<Array<{ ingredient_id: string; quantity_reserved: number }>> {
    const result = await this.pool.query(
      `UPDATE ingredient_reservations
       SET status = 'RELEASED', updated_at = NOW()
       WHERE order_id = $1
       AND status <> 'RELEASED'
       RETURNING ingredient_id, quantity_reserved`,
      [orderId]
    );
    return result.rows;
  }

  async getAllActive(): Promise<Reservation[]> {
    const result = await this.pool.query(
      `SELECT * FROM ingredient_reservations 
       WHERE status <> 'RELEASED' 
       ORDER BY created_at DESC`
    );
    return result.rows;
  }
}
