import React from 'react';
import './Inventory.css';

export const Inventory: React.FC = () => {
  return (
    <div className="inventory">
      <h3>Inventario de Bodega</h3>
      <div className="placeholder">
        <p>📦 Próximamente - Endpoint no disponible aún</p>
        <p className="subtitle">Los datos de inventario se mostrarán aquí cuando el endpoint esté disponible</p>
      </div>
    </div>
  );
};
