import React from 'react';
import type { Order, OrderStatus } from '../../types';
import './OrdersInProgress.css';

interface OrdersInProgressProps {
  orders: Order[];
}

export const OrdersInProgress: React.FC<OrdersInProgressProps> = ({ orders }) => {
  const inProgressOrders = orders.filter(
    (order) => order.status !== 'COMPLETED' && order.status !== 'FAILED'
  );

  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'CREATED':
        return 'status-created';
      case 'SELECTING_RECIPES':
        return 'status-selecting';
      case 'COOKING':
        return 'status-cooking';
      case 'FAILED':
        return 'status-failed';
      case 'COMPLETED':
        return 'status-completed';
      default:
        return '';
    }
  };

  const getStatusLabel = (status: OrderStatus): string => {
    switch (status) {
      case 'CREATED':
        return 'Creada';
      case 'SELECTING_RECIPES':
        return 'Seleccionando Receta';
      case 'COOKING':
        return 'Cocinando';
      case 'FAILED':
        return 'Falló';
      case 'COMPLETED':
        return 'Completada';
      default:
        return status;
    }
  };

  return (
    <div className="orders-in-progress">
      <h3>Órdenes en Preparación</h3>
      {inProgressOrders.length === 0 ? (
        <div className="no-orders">
          <p>No hay órdenes en preparación en este momento</p>
        </div>
      ) : (
        <div className="orders-grid">
          {inProgressOrders.map((order) => (
            <div key={order.id} className={`order-card ${getStatusColor(order.status)}`}>
              <div className="order-header">
                <h4>Orden #{order.id.slice(0, 8).toUpperCase()}</h4>
                <span className="status-badge">{getStatusLabel(order.status)}</span>
              </div>
              <div className="order-body">
                <p>
                  <strong>Platos:</strong> {order.total_dishes}
                </p>
                <p>
                  <strong>Creada:</strong> {new Date(order.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
