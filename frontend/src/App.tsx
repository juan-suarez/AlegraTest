import { useEffect, useState } from 'react';
import './App.css';
import type { Order, InventoryItem, PurchaseHistory, PurchaseStats } from './types';
import { orderService } from './services/orderService';
import { RECIPES } from './data/recipes';
import { OrderCreation } from './components/OrderCreation';
import { OrdersInProgress } from './components/OrdersInProgress';
import { OrderHistory } from './components/OrderHistory';
import { RecipesMenu } from './components/RecipesMenu';
import { Inventory } from './components/Inventory';
import { MarketPurchases } from './components/MarketPurchases';

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [purchaseStats, setPurchaseStats] = useState<PurchaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const pollingInterval = parseInt(import.meta.env.VITE_POLLING_INTERVAL || '1000');

  // Polling para obtener órdenes
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await orderService.getOrders();
        setOrders(data);
        setError(null);
        setLastUpdate(new Date());
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        console.error('Error fetching orders:', err);
      }
    };

    // Polling para inventario
    const fetchInventory = async () => {
      try {
        const data = await orderService.getInventory();
        setInventory(data);
      } catch (err) {
        console.error('Error fetching inventory:', err);
      }
    };

    // Polling para compras
    const fetchPurchases = async () => {
      try {
        const [purchases, stats] = await Promise.all([
          orderService.getPurchases(),
          orderService.getPurchaseStats(),
        ]);
        setPurchases(purchases);
        setPurchaseStats(stats);
      } catch (err) {
        console.error('Error fetching purchases:', err);
      }
    };

    // Verificar si tenemos API configurada
    const hasApiConfig = import.meta.env.VITE_API_ENDPOINT && 
                         import.meta.env.VITE_API_KEY && 
                         import.meta.env.VITE_API_KEY !== 'your_api_key_here';

    if (!hasApiConfig) {
      setError('Configura las variables de entorno en .env.local (VITE_API_ENDPOINT y VITE_API_KEY)');
      return;
    }

    // Fetch inicial
    fetchOrders();
    fetchInventory();
    fetchPurchases();

    // Setup polling
    const interval = setInterval(() => {
      fetchOrders();
      fetchInventory();
      fetchPurchases();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval]);

  const handleCreateOrder = async (totalDishes: number) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await orderService.createOrder(totalDishes);
      // Hacer un fetch inmediato para actualizar la lista
      const data = await orderService.getOrders();
      setOrders(data);
      setLastUpdate(new Date());
      setSuccess(`✅ Orden creada exitosamente (ID: ${response.data.orderId.slice(0, 8)})`);
      // Limpiar mensaje después de 4 segundos
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error creating order:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalOrders = () => orders.length;
  const getInProgressCount = () =>
    orders.filter(
      (o) => o.status !== 'COMPLETED' && o.status !== 'FAILED'
    ).length;
  const getCompletedCount = () =>
    orders.filter((o) => o.status === 'COMPLETED').length;
  const getFailedCount = () =>
    orders.filter((o) => o.status === 'FAILED').length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🍽️ Sistema de Gestión de Órdenes</h1>
          <p className="subtitle">Jornada de Donación de Comida Gratis</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{getTotalOrders()}</span>
          </div>
          <div className="stat in-progress">
            <span className="stat-label">En Preparación</span>
            <span className="stat-value">{getInProgressCount()}</span>
          </div>
          <div className="stat completed">
            <span className="stat-label">Completadas</span>
            <span className="stat-value">{getCompletedCount()}</span>
          </div>
          <div className="stat failed">
            <span className="stat-label">Fallidas</span>
            <span className="stat-value">{getFailedCount()}</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          {error && (
            <div className="error-banner">
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          {success && (
            <div className="success-banner">
              {success}
            </div>
          )}

          <OrderCreation onCreateOrder={handleCreateOrder} isLoading={isLoading} />

          <div className="dashboard-grid">
            <div className="dashboard-section">
              <OrdersInProgress orders={orders} />
            </div>

            <div className="dashboard-section">
              <RecipesMenu recipes={RECIPES} />
            </div>

            <div className="dashboard-section">
              <Inventory inventory={inventory} />
            </div>

            <div className="dashboard-section">
              <MarketPurchases purchases={purchases} stats={purchaseStats} />
            </div>

            <div className="dashboard-section full-width">
              <OrderHistory orders={orders} />
            </div>
          </div>

          <footer className="app-footer">
            <p>Última actualización: {lastUpdate.toLocaleTimeString()}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
