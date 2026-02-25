/**
 * Domain types for Inventory Service
 */

export interface Ingredient {
  id: string;
  name: string;
  stock: number;
  created_at: Date;
  updated_at: Date;
}

export interface Reservation {
  id: string;
  order_id: string;
  ingredient_id: string;
  quantity_needed: number;
  quantity_reserved: number;
  status: ReservationStatus;
  created_at: Date;
  updated_at: Date;
}

export type ReservationStatus = 'RESERVED' | 'PURCHASE_PENDING' | 'RELEASED';
