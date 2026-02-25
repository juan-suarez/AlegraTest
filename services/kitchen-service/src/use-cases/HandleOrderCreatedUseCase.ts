import { EventRepository } from '../repositories';
import { EventBusLocal } from '../infrastructure/messaging';
import { recipes } from '../config/recipes';
import { 
  OrderCreatedEvent, 
  OrderItemsSelectedEvent, 
  IngredientsRequiredEvent,
  Recipe 
} from './types';
import { UseCase } from './UseCase';
import { randomUUID } from 'node:crypto';

export class HandleOrderCreatedUseCase implements UseCase<OrderCreatedEvent> {
  constructor(
    private eventRepo: EventRepository,
    private eventBus: EventBusLocal
  ) {}

  async execute(event: OrderCreatedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    // Seleccionar recetas aleatorias
    const selectedRecipes: Recipe[] = [];
    for (let i = 0; i < event.totalDishes; i++) {
      const randomIndex = Math.floor(Math.random() * recipes.length);
      selectedRecipes.push(recipes[randomIndex]!);
    }

    // Contar recetas seleccionadas
    const recipeCounts: Record<string, number> = {};
    selectedRecipes.forEach(recipe => {
      recipeCounts[recipe.id] = (recipeCounts[recipe.id] || 0) + 1;
    });

    // Crear evento OrderItemsSelected
    const items = Object.entries(recipeCounts).map(([recipeId, quantity]) => ({
      id: randomUUID(),
      recipeId,
      quantity
    }));

    const orderItemsEvent: OrderItemsSelectedEvent = {
      eventId: randomUUID(),
      orderId: event.orderId,
      items
    };

    await this.eventBus.publish('OrderItemsSelected', 'OrderItemsSelected', orderItemsEvent, 'kitchen-service');

    const totalIngredients: Record<string, number> = {};
    selectedRecipes.forEach(recipe => {
      Object.entries(recipe.ingredients).forEach(([ing, qty]) => {
        totalIngredients[ing] = (totalIngredients[ing] || 0) + qty;
      });
    });

    const ingredientsEvent: IngredientsRequiredEvent = {
      eventId: randomUUID(),
      orderId: event.orderId,
      ingredients: totalIngredients
    };

    await this.eventBus.publish('IngredientsRequired', 'IngredientsRequired', ingredientsEvent, 'kitchen-service');

    await this.eventRepo.markEventProcessed(event.eventId);
  }
}
