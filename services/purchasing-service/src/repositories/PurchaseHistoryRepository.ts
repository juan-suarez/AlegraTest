import { Pool, PoolClient } from 'pg';
import { PurchaseHistory, CreatePurchaseHistoryInput } from './types';

export class PurchaseHistoryRepository {
  constructor(private pool: Pool) {}

  async create(data: CreatePurchaseHistoryInput, client?: PoolClient): Promise<void> {
    const queryClient = client || this.pool;
    
    await queryClient.query(
      `INSERT INTO purchase_history (
        id, 
        order_id, 
        ingredient_id, 
        ingredient_name, 
        quantity_requested, 
        quantity_purchased, 
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        data.id,
        data.orderId,
        data.ingredientId,
        data.ingredientName,
        data.quantityRequested,
        data.quantityPurchased,
        data.status,
      ]
    );
  }

  async findByOrderId(orderId: string): Promise<PurchaseHistory[]> {
    const result = await this.pool.query<PurchaseHistory>(
      `SELECT * FROM purchase_history 
       WHERE order_id = $1 
       ORDER BY created_at DESC`,
      [orderId]
    );
    return result.rows;
  }

  async findByIngredientId(ingredientId: string): Promise<PurchaseHistory[]> {
    const result = await this.pool.query<PurchaseHistory>(
      `SELECT * FROM purchase_history 
       WHERE ingredient_id = $1 
       ORDER BY created_at DESC`,
      [ingredientId]
    );
    return result.rows;
  }

  async findAll(limit: number = 50): Promise<PurchaseHistory[]> {
    const result = await this.pool.query<PurchaseHistory>(
      `SELECT * FROM purchase_history 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async getStats(): Promise<{
    totalPurchases: number;
    completedPurchases: number;
    failedPurchases: number;
  }> {
    const result = await this.pool.query<{
      status: string;
      count: string;
    }>(
      `SELECT status, COUNT(*) as count 
       FROM purchase_history 
       GROUP BY status`
    );

    const stats = {
      totalPurchases: 0,
      completedPurchases: 0,
      failedPurchases: 0,
    };

    result.rows.forEach((row) => {
      const count = parseInt(row.count, 10);
      stats.totalPurchases += count;
      
      if (row.status === 'COMPLETED') {
        stats.completedPurchases = count;
      } else if (row.status === 'FAILED') {
        stats.failedPurchases = count;
      }
    });

    return stats;
  }
}
