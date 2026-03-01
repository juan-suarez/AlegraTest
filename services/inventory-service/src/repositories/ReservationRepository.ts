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

  async getById(id: string): Promise<Reservation | null> {
    const result = await this.pool.query(
      'SELECT * FROM ingredient_reservations WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
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
    status: ReservationStatus,
    client?: PoolClient
  ): Promise<void> {
    const executor = client || this.pool;
    await executor.query(
      'UPDATE ingredient_reservations SET status = $2, updated_at = NOW() WHERE id = $1',
      [reservationId, status]
    );
  }

  async lockAndGetReservation(
    reservationId: string,
    client: PoolClient
  ): Promise<{ quantity_needed: number; quantity_reserved: number }> {
    const result = await client.query(
      `SELECT quantity_needed, quantity_reserved 
       FROM ingredient_reservations 
       WHERE id = $1 
       FOR UPDATE`,
      [reservationId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    return result.rows[0];
  }

  async incrementReservedQuantity(
    reservationId: string,
    amount: number,
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `UPDATE ingredient_reservations 
       SET quantity_reserved = quantity_reserved + $2, updated_at = NOW()
       WHERE id = $1`,
      [reservationId, amount]
    );
  }

  async incrementAndCalculateOverflow(
    reservationId: string,
    quantityPurchased: number,
    client: PoolClient
  ): Promise<{ overflow: number; isComplete: boolean }> {
    // Lock and get current state
    const lockedReservation = await this.lockAndGetReservation(reservationId, client);
    
    // Calculate how much we can add to reserved without exceeding need
    const quantityStillNeeded = lockedReservation.quantity_needed - lockedReservation.quantity_reserved;
    const addedToReserved = Math.min(quantityPurchased, quantityStillNeeded);
    const overflow = quantityPurchased - addedToReserved;
    
    // Increment reserved quantity
    await this.incrementReservedQuantity(reservationId, addedToReserved, client);
    
    // Check if reservation is now complete
    const newReservedTotal = lockedReservation.quantity_reserved + addedToReserved;
    const isComplete = newReservedTotal >= lockedReservation.quantity_needed;
    
    return { overflow, isComplete };
  }

  async areAllReserved(orderId: string, client?: PoolClient): Promise<boolean> {
    const executor = client || this.pool;
    const result = await executor.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) as reserved
       FROM ingredient_reservations 
       WHERE order_id = $1`,
      [orderId]
    );
    const { total, reserved } = result.rows[0];
    return parseInt(total) > 0 && parseInt(total) === parseInt(reserved);
  }

  async releaseAllForOrder(orderId: string, client?: PoolClient): Promise<Array<{ ingredient_id: string; quantity_reserved: number }>> {
    const executor = client || this.pool;
    const result = await executor.query(
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
