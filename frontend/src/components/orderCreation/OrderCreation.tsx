import React from 'react';
import './OrderCreation.css';

interface OrderCreationProps {
  onCreateOrder: (totalDishes: number) => void;
  isLoading: boolean;
}

export const OrderCreation: React.FC<OrderCreationProps> = ({ onCreateOrder, isLoading }) => {
  const [totalDishes, setTotalDishes] = React.useState(1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setTotalDishes(0); // Permitir campo vacío temporalmente
    } else {
      const num = parseInt(value);
      if (!isNaN(num)) {
        setTotalDishes(Math.min(Math.max(num, 1), 100)); // Limitar entre 1-100
      }
    }
  };

  const handleBlur = () => {
    // Cuando pierda el foco, establecer mínimo 1 si está vacío
    if (totalDishes < 1) {
      setTotalDishes(1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalDishes > 0) {
      onCreateOrder(totalDishes);
      setTotalDishes(1);
    }
  };

  return (
    <div className="order-creation">
      <form onSubmit={handleSubmit} className="order-creation-form">
        <h2>Nueva Orden</h2>
        <div className="order-creation-controls">
          <label htmlFor="totalDishes" className="inline-label">Platos:</label>
          <input
            type="number"
            id="totalDishes"
            min="1"
            max="100"
            value={totalDishes || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || totalDishes < 1} className="create-button">
            {isLoading ? 'Creando...' : '+ Crear Orden'}
          </button>
        </div>
      </form>
    </div>
  );
};
