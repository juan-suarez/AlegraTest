import React from 'react';
import type { PurchaseHistory, PurchaseStats } from '../types';
import './MarketPurchases.css';

interface MarketPurchasesProps {
  purchases: PurchaseHistory[];
  stats: PurchaseStats | null;
}

export const MarketPurchases: React.FC<MarketPurchasesProps> = ({ purchases, stats }) => {
  const getStatusColor = (status: string): string => {
    return status === 'COMPLETED' ? 'completed' : 'failed';
  };

  const getStatusLabel = (status: string): string => {
    return status === 'COMPLETED' ? '✓ Completada' : '✕ Falló';
  };

  return (
    <div className="market-purchases">
      <h3>🛒 Historial de Compras - Plaza de Mercado</h3>

      {stats && (
        <div className="purchase-stats">
          <div className="stat-card total">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.totalPurchases}</span>
          </div>
          <div className="stat-card completed">
            <span className="stat-label">Completadas</span>
            <span className="stat-value">{stats.completedPurchases}</span>
          </div>
          <div className="stat-card failed">
            <span className="stat-label">Fallidas</span>
            <span className="stat-value">{stats.failedPurchases}</span>
          </div>
        </div>
      )}

      {purchases.length === 0 ? (
        <div className="no-purchases">
          <p>No hay compras registradas aún</p>
        </div>
      ) : (
        <div className="purchases-table">
          <table>
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Solicitado</th>
                <th>Comprado</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="ingredient-name">{purchase.ingredient_name}</td>
                  <td className="quantity-cell">{purchase.quantity_requested}</td>
                  <td className="quantity-cell">{purchase.quantity_purchased}</td>
                  <td>
                    <span className={`status-badge ${getStatusColor(purchase.status)}`}>
                      {getStatusLabel(purchase.status)}
                    </span>
                  </td>
                  <td className="timestamp">{new Date(purchase.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
