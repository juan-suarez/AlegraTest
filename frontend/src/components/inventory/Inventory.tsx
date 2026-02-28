import React from 'react';
import type { InventoryItem } from '../types';
import './Inventory.css';

interface InventoryProps {
  inventory: InventoryItem[];
}

export const Inventory: React.FC<InventoryProps> = ({ inventory }) => {
  
  return (
    <div className="inventory">
      <h3>📦 Inventario de Bodega</h3>
      {inventory.length === 0 ? (
        <div className="no-inventory">
          <p>No hay ingredientes en el inventario</p>
        </div>
      ) : (
        <div className="inventory-table">
          <table>
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Cantidad</th>
                <th>Última Actualización</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td className="ingredient-name">{item.name}</td>
                  <td className="quantity">{item.stock}</td>
                  <td className="timestamp">{new Date(item.updated_at || item.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
