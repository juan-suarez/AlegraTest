import type { Recipe } from '../types';

export const RECIPES: Recipe[] = [
  {
    id: 'classic-burger',
    name: 'Classic Burger',
    preparationTime: 15,
    ingredients: [
      { id: 'meat1', name: 'Meat', quantity: 1, unit: 'unidad' },
      { id: 'cheese1', name: 'Cheese', quantity: 1, unit: 'unidad' },
      { id: 'tomato1', name: 'Tomato', quantity: 1, unit: 'unidad' },
      { id: 'lettuce1', name: 'Lettuce', quantity: 1, unit: 'unidad' },
      { id: 'onion1', name: 'Onion', quantity: 1, unit: 'unidad' },
      { id: 'ketchup1', name: 'Ketchup', quantity: 1, unit: 'unidad' },
    ],
  },
  {
    id: 'chicken-rice-bowl',
    name: 'Chicken Rice Bowl',
    preparationTime: 25,
    ingredients: [
      { id: 'chicken1', name: 'Chicken', quantity: 1, unit: 'unidad' },
      { id: 'rice1', name: 'Rice', quantity: 2, unit: 'unidades' },
      { id: 'onion2', name: 'Onion', quantity: 1, unit: 'unidad' },
      { id: 'tomato2', name: 'Tomato', quantity: 1, unit: 'unidad' },
      { id: 'lemon1', name: 'Lemon', quantity: 1, unit: 'unidad' },
    ],
  },
  {
    id: 'meat-potato-plate',
    name: 'Meat & Potato Plate',
    preparationTime: 20,
    ingredients: [
      { id: 'meat2', name: 'Meat', quantity: 1, unit: 'unidad' },
      { id: 'potato1', name: 'Potato', quantity: 2, unit: 'unidades' },
      { id: 'onion3', name: 'Onion', quantity: 1, unit: 'unidad' },
      { id: 'ketchup2', name: 'Ketchup', quantity: 1, unit: 'unidad' },
    ],
  },
  {
    id: 'veggie-rice',
    name: 'Veggie Rice',
    preparationTime: 15,
    ingredients: [
      { id: 'rice2', name: 'Rice', quantity: 2, unit: 'unidades' },
      { id: 'tomato3', name: 'Tomato', quantity: 1, unit: 'unidad' },
      { id: 'lettuce2', name: 'Lettuce', quantity: 2, unit: 'unidades' },
      { id: 'onion4', name: 'Onion', quantity: 1, unit: 'unidad' },
      { id: 'lemon2', name: 'Lemon', quantity: 1, unit: 'unidad' },
    ],
  },
  {
    id: 'chicken-salad',
    name: 'Chicken Salad',
    preparationTime: 10,
    ingredients: [
      { id: 'chicken2', name: 'Chicken', quantity: 1, unit: 'unidad' },
      { id: 'lettuce3', name: 'Lettuce', quantity: 2, unit: 'unidades' },
      { id: 'tomato4', name: 'Tomato', quantity: 1, unit: 'unidad' },
      { id: 'onion5', name: 'Onion', quantity: 1, unit: 'unidad' },
      { id: 'lemon3', name: 'Lemon', quantity: 1, unit: 'unidad' },
    ],
  },
  {
    id: 'cheesy-potato-bowl',
    name: 'Cheesy Potato Bowl',
    preparationTime: 20,
    ingredients: [
      { id: 'potato2', name: 'Potato', quantity: 2, unit: 'unidades' },
      { id: 'cheese2', name: 'Cheese', quantity: 1, unit: 'unidad' },
      { id: 'onion6', name: 'Onion', quantity: 1, unit: 'unidad' },
      { id: 'ketchup3', name: 'Ketchup', quantity: 1, unit: 'unidad' },
    ],
  },
];
