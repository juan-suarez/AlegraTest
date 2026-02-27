import { IncomingMessage, ServerResponse } from 'http';
import { IngredientRepository, ReservationRepository } from '../repositories';

export class InventoryController {
  constructor(
    private ingredientRepository: IngredientRepository,
    private reservationRepository: ReservationRepository
  ) {}

  async handleGetIngredients(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const ingredients = await this.ingredientRepository.getAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ingredients));
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  async handleGetIngredientById(
    req: IncomingMessage,
    res: ServerResponse,
    ingredientId: string
  ): Promise<void> {
    try {
      const ingredient = await this.ingredientRepository.getById(ingredientId);
      
      if (!ingredient) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ingredient not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ingredient));
    } catch (error) {
      console.error('Error fetching ingredient:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  async handleGetReservations(
    req: IncomingMessage,
    res: ServerResponse,
    queryParams?: any
  ): Promise<void> {
    try {
      const orderId = queryParams?.orderId;

      if (orderId) {
        // Filter by orderId if provided
        const reservations = await this.reservationRepository.getByOrder(orderId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reservations));
      } else {
        // Return all active reservations
        const reservations = await this.reservationRepository.getAllActive();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reservations));
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
}
