import { Pool } from 'pg';

export interface Order {
  id: string;
  total_dishes: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  id: string;
  order_id: string;
  recipe_id: string;
  quantity: number;
  created_at: Date;
}

export class OrderRepository {
  constructor(private pool: Pool) {}

  async create(orderId: string, totalDishes: number): Promise<Order> {
    const result = await this.pool.query(
      `INSERT INTO orders (id, total_dishes, status)
       VALUES ($1, $2, 'CREATED')
       RETURNING *`,
      [orderId, totalDishes]
    );
    return result.rows[0];
  }

  async findById(orderId: string): Promise<Order | null> {
    const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    return result.rows[0] || null;
  }

  async updateStatus(orderId: string, status: string): Promise<Order> {
    const result = await this.pool.query(
      `UPDATE orders
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, status]
    );
    return result.rows[0];
  }

  async createOrderItems(items: Omit<OrderItem, 'created_at'>[]): Promise<OrderItem[]> {
    const values = items.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
    const params = items.flatMap(item => [item.id, item.order_id, item.recipe_id, item.quantity]);

    const result = await this.pool.query(
      `INSERT INTO order_items (id, order_id, recipe_id, quantity) VALUES ${values} RETURNING *`,
      params
    );
    return result.rows;
  }

  async findOrderItems(orderId: string): Promise<OrderItem[]> {
    const result = await this.pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    return result.rows;
  }
}