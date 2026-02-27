/**
 * Repository types and interfaces
 */

export interface PurchaseHistory {
  id: string;
  order_id: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity_requested: number;
  quantity_purchased: number;
  status: 'COMPLETED' | 'FAILED';
  created_at: Date;
}

export interface CreatePurchaseHistoryInput {
  id: string;
  orderId: string;
  ingredientId: string;
  ingredientName: string;
  quantityRequested: number;
  quantityPurchased: number;
  status: 'COMPLETED' | 'FAILED';
}
