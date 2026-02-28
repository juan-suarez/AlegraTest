import React from 'react';
import type { Recipe } from '../types';
import './RecipesMenu.css';

interface RecipesMenuProps {
  recipes: Recipe[];
}

export const RecipesMenu: React.FC<RecipesMenuProps> = ({ recipes }) => {
  return (
    <div className="recipes-menu">
      <h3>Recetas Disponibles</h3>
      <div className="recipes-grid">
        {recipes.map((recipe) => (
          <div key={recipe.id} className="recipe-card">
            <div className="recipe-header">
              <h4>{recipe.name}</h4>
              <span className="prep-time">⏱ {recipe.preparationTime} min</span>
            </div>
            <div className="recipe-ingredients">
              <h5>Ingredientes:</h5>
              <ul>
                {recipe.ingredients.map((ingredient) => (
                  <li key={ingredient.id}>
                    {ingredient.name} - {ingredient.quantity} {ingredient.unit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
