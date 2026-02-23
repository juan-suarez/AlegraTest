import { EventRepository } from '../repositories';
import {
  OrderCreatedEvent,
  IngredientsReservedEvent,
  OrderItemsSelectedEvent,
  IngredientsRequiredEvent,
  OrderCompletedEvent,
  Recipe,
} from './types';
import { recipes } from './recipes';
import { randomUUID } from 'node:crypto';

export class EventPublisher {
  async publish(type: string, event: any): Promise<void> {
    // TODO: Implement actual publishing
    console.log(`Publishing ${type}:`, event);
  }
}

export class KitchenService {
  constructor(
    private eventRepo: EventRepository,
    private eventPublisher: EventPublisher
  ) {}

  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    const selectedRecipes: Recipe[] = [];
    for (let i = 0; i < event.totalDishes; i++) {
      const randomIndex = Math.floor(Math.random() * recipes.length);
      selectedRecipes.push(recipes[randomIndex]!);
    }

    const recipeCounts: Record<string, number> = {};
    selectedRecipes.forEach(recipe => {
      recipeCounts[recipe.id] = (recipeCounts[recipe.id] || 0) + 1;
    });

    const items = Object.entries(recipeCounts).map(([recipeId, quantity]) => ({
      recipeId,
      quantity
    }));

    const orderItemsEvent: OrderItemsSelectedEvent = {
      eventId: randomUUID(),
      orderId: event.orderId,
      items
    };
    await this.eventPublisher.publish('OrderItemsSelected', orderItemsEvent);

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
    await this.eventPublisher.publish('IngredientsRequired', ingredientsEvent);

    await this.eventRepo.markEventProcessed(event.eventId);
  }

  async handleIngredientsReserved(event: IngredientsReservedEvent): Promise<void> {
    if (await this.eventRepo.isEventProcessed(event.eventId)) {
      return;
    }

    const completedEvent: OrderCompletedEvent = {
      eventId: randomUUID(),
      orderId: event.orderId
    };
    await this.eventPublisher.publish('OrderCompleted', completedEvent);

    await this.eventRepo.markEventProcessed(event.eventId);
  }
}