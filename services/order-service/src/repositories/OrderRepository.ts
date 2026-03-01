import { Pool } from 'pg';
import { Order, OrderItem } from '../use-cases/types';
import { OrderItemsRepository } from './OrderItemsRepository';

export class OrderRepository {
  private orderItemsRepo: OrderItemsRepository;

  constructor(private pool: Pool) {
    this.orderItemsRepo = new OrderItemsRepository(pool);
  }

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

  async findAll(): Promise<Order[]> {
    const result = await this.pool.query(
      `SELECT * FROM orders 
       ORDER BY created_at DESC`
    );
    return result.rows;
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
    return this.orderItemsRepo.create(items);
  }

  async findOrderItems(orderId: string): Promise<OrderItem[]> {
    return this.orderItemsRepo.findByOrderId(orderId);
  }
}