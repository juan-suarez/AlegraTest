import { useEffect, useState } from 'react';
import './App.css';
import type { Order, InventoryItem, PurchaseHistory, PurchaseStats } from './types';
import { orderService } from './services/orderService';
import { RECIPES } from './data/recipes';
import { OrderCreation } from './components/orderCreation/OrderCreation';
import { OrdersInProgress } from './components/ordersInProgress/OrdersInProgress';
import { OrderHistory } from './components/orderHistory/OrderHistory';
import { RecipesMenu } from './components/recipesMenu/RecipesMenu';
import { Inventory } from './components/inventory/Inventory';
import { MarketPurchases } from './components/marketPurchases/MarketPurchases';
import { globalConfig } from './config/globalConfig';
import { authService } from './auth/authService';
import { LoginScreen } from './components/auth/LoginScreen';
import { Chatbot } from './components/chatbot/Chatbot';

type DashboardTab =
  | 'ordersInProgress'
  | 'recipes'
  | 'inventory'
  | 'purchases'
  | 'orderHistory';

const TAB_STORAGE_KEY = 'dashboardActiveTab';

const parseStoredTab = (value: string | null): DashboardTab => {
  switch (value) {
    case 'ordersInProgress':
    case 'recipes':
    case 'inventory':
    case 'purchases':
    case 'orderHistory':
      return value;
    default:
      return 'ordersInProgress';
  }
};

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [purchaseStats, setPurchaseStats] = useState<PurchaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!globalConfig.auth.enabled);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    if (typeof window === 'undefined') {
      return 'ordersInProgress';
    }

    return parseStoredTab(window.localStorage.getItem(TAB_STORAGE_KEY));
  });

  const pollingInterval = globalConfig.pollingInterval;

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!authService.isEnabled()) {
      setIsAuthenticated(true);
      setAuthReady(true);
      return;
    }

    authService.completeLoginFromUrl();
    setIsAuthenticated(authService.isAuthenticated());
    setAuthReady(true);
  }, []);

  // Polling para obtener órdenes
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

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
  }, [pollingInterval, isAuthenticated]);

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

  const handleLogout = () => {
    authService.logout();
  };

  const tabs = [
    {
      key: 'ordersInProgress' as const,
      label: 'En progreso',
      count: getInProgressCount(),
    },
    {
      key: 'recipes' as const,
      label: 'Recetas',
      count: RECIPES.length,
    },
    {
      key: 'inventory' as const,
      label: 'Inventario',
      count: inventory.length,
    },
    {
      key: 'purchases' as const,
      label: 'Compras',
      count: purchases.length,
    },
    {
      key: 'orderHistory' as const,
      label: 'Historial',
      count: orders.length,
    },
  ];

  if (!authReady) {
    return null;
  }

  if (authService.isEnabled() && !isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top-row">
          <div className="header-content">
            <h1>🍽️ Sistema de Gestión de Órdenes</h1>
            <p className="subtitle">Jornada de Donación de Comida Gratis</p>
          </div>

          {authService.isEnabled() && (
            <button type="button" className="logout-button" onClick={handleLogout}>
              Cerrar sesión
            </button>
          )}

          <nav className="section-tabs" aria-label="Secciones del dashboard">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="tab-count">{tab.count}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="header-order-creation">
          <OrderCreation onCreateOrder={handleCreateOrder} isLoading={isLoading} />
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

          <div className="dashboard-single-section">
            {activeTab === 'ordersInProgress' && <OrdersInProgress orders={orders} />}
            {activeTab === 'recipes' && <RecipesMenu recipes={RECIPES} />}
            {activeTab === 'inventory' && <Inventory inventory={inventory} />}
            {activeTab === 'purchases' && (
              <MarketPurchases purchases={purchases} stats={purchaseStats} />
            )}
            {activeTab === 'orderHistory' && (
              <OrderHistory
                orders={orders}
                stats={{
                  total: getTotalOrders(),
                  inProgress: getInProgressCount(),
                  completed: getCompletedCount(),
                  failed: getFailedCount(),
                }}
              />
            )}
          </div>

          <footer className="app-footer">
            <p>Última actualización: {lastUpdate.toLocaleTimeString()}</p>
          </footer>
        </div>
      </main>

      {/* Chatbot con IA */}
      <Chatbot />
    </div>
  );
}

export default App;
