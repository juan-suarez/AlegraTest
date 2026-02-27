import { Pool } from 'pg';
import { Ingredient } from './interfaces';

export class IngredientRepository {
  constructor(private pool: Pool) {}

  async getByName(name: string): Promise<Ingredient | null> {
    const result = await this.pool.query(
      'SELECT * FROM ingredients WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }

  async getById(id: string): Promise<Ingredient | null> {
    const result = await this.pool.query(
      'SELECT * FROM ingredients WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async lockAndGetStock(ingredientId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT stock FROM ingredients WHERE id = $1 FOR UPDATE',
      [ingredientId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Ingredient ${ingredientId} not found`);
    }
    return result.rows[0].stock;
  }

  async updateStock(ingredientId: string, newStock: number): Promise<void> {
    await this.pool.query(
      'UPDATE ingredients SET stock = $2, updated_at = NOW() WHERE id = $1',
      [ingredientId, newStock]
    );
  }

  async addStock(ingredientId: string, quantity: number): Promise<void> {
    await this.pool.query(
      'UPDATE ingredients SET stock = stock + $2, updated_at = NOW() WHERE id = $1',
      [ingredientId, quantity]
    );
  }

  async create(id: string, name: string, stock: number): Promise<Ingredient> {
    const result = await this.pool.query(
      'INSERT INTO ingredients (id, name, stock) VALUES ($1, $2, $3) RETURNING *',
      [id, name, stock]
    );
    return result.rows[0];
  }

  async getAll(): Promise<Ingredient[]> {
    const result = await this.pool.query(
      'SELECT * FROM ingredients ORDER BY name ASC'
    );
    return result.rows;
  }
}
