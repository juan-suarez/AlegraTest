import React from 'react';
import type { Order, OrderStatus } from '../../types';
import './OrderHistory.css';

interface OrderHistoryProps {
  orders: Order[];
  stats: {
    total: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ orders, stats }) => {
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

      <div className="history-stats-grid">
        <div className="history-stat-card">
          <span className="history-stat-label">Total</span>
          <span className="history-stat-value">{stats.total}</span>
        </div>
        <div className="history-stat-card in-progress">
          <span className="history-stat-label">En preparación</span>
          <span className="history-stat-value">{stats.inProgress}</span>
        </div>
        <div className="history-stat-card completed">
          <span className="history-stat-label">Completadas</span>
          <span className="history-stat-value">{stats.completed}</span>
        </div>
        <div className="history-stat-card failed">
          <span className="history-stat-label">Fallidas</span>
          <span className="history-stat-value">{stats.failed}</span>
        </div>
      </div>

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
