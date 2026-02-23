import { Pool } from 'pg';
import { OrderItem } from '../services/types';

export class OrderItemsRepository {
  constructor(private pool: Pool) {}

  async create(items: Omit<OrderItem, 'created_at'>[]): Promise<OrderItem[]> {
    const placeholders = items
      .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(', ');
    
    const params = items.flatMap(item => [
      item.id,
      item.order_id,
      item.recipe_id,
      item.quantity
    ]);

    const query = `
      INSERT INTO order_items (id, order_id, recipe_id, quantity)
      VALUES ${placeholders}
      RETURNING *
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async findByOrderId(orderId: string): Promise<OrderItem[]> {
    const result = await this.pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    return result.rows;
  }
}
