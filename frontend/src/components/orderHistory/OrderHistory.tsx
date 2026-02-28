import React from 'react';
import type { Order, OrderStatus } from '../../types';
import './OrderHistory.css';

interface OrderHistoryProps {
  orders: Order[];
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ orders }) => {
  const completedOrders = orders.filter(
    (order) => order.status === 'COMPLETED' || order.status === 'FAILED'
  );

  const getStatusIcon = (status: OrderStatus): string => {
    if (status === 'COMPLETED') return '✓';
    if (status === 'FAILED') return '✕';
    return '•';
  };

  const getStatusColor = (status: OrderStatus): string => {
    if (status === 'COMPLETED') return 'completed';
    if (status === 'FAILED') return 'failed';
    return 'pending';
  };

  return (
    <div className="order-history">
      <h3>Historial de Pedidos</h3>
      {completedOrders.length === 0 ? (
        <div className="no-history">
          <p>No hay pedidos completados aún</p>
        </div>
      ) : (
        <div className="history-table">
          <table>
            <thead>
              <tr>
                <th>ID Orden</th>
                <th>Platos</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {completedOrders.map((order) => (
                <tr key={order.id} className={`row-${getStatusColor(order.status)}`}>
                  <td className="id-cell">
                    <span className="status-icon">{getStatusIcon(order.status)}</span>
                    {order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td>{order.total_dishes}</td>
                  <td>
                    <span className={`status-label ${getStatusColor(order.status)}`}>
                      {order.status === 'COMPLETED' ? 'Completada' : 'Falló'}
                    </span>
                  </td>
                  <td>{new Date(order.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
