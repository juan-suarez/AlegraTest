import { Recipe } from '../use-cases/types';

export const recipes: Recipe[] = [
  {
    id: 'classic-burger',
    name: 'Classic Burger',
    ingredients: { meat: 1, cheese: 1, tomato: 1, lettuce: 1, onion: 1, ketchup: 1 }
  },
  {
    id: 'chicken-rice-bowl',
    name: 'Chicken Rice Bowl',
    ingredients: { chicken: 1, rice: 2, onion: 1, tomato: 1, lemon: 1 }
  },
  {
    id: 'meat-potato-plate',
    name: 'Meat & Potato Plate',
    ingredients: { meat: 1, potato: 2, onion: 1, ketchup: 1 }
  },
  {
    id: 'veggie-rice',
    name: 'Veggie Rice',
    ingredients: { rice: 2, tomato: 1, lettuce: 1, onion: 1, lemon: 1 }
  },
  {
    id: 'chicken-salad',
    name: 'Chicken Salad',
    ingredients: { chicken: 1, lettuce: 2, tomato: 1, onion: 1, lemon: 1 }
  },
  {
    id: 'cheesy-potato-bowl',
    name: 'Cheesy Potato Bowl',
    ingredients: { potato: 2, cheese: 1, onion: 1, ketchup: 1 }
  }
];
