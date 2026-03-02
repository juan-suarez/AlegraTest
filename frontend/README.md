# 🎨 Frontend - Restaurant Event-Driven System

SPA moderna construida con React 18 + TypeScript + Vite para gestionar órdenes de un restaurante distribuido.

---

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+
- npm o yarn

### Opción 1: Desarrollo Standalone

```bash
cd frontend
npm install
npm run dev
# Frontend disponible en: http://localhost:5173
```

**Nota**: Requiere backend corriendo (servicios en Docker o AWS)

### Opción 2: Sistema Completo con Docker (E2E)

```bash
# Desde la raíz del proyecto
docker-compose up

# Esto levanta:
# - Frontend (puerto 3000)
# - 4 Microservicios
# - PostgreSQL
# - LocalStack (SNS/SQS)

# Accede a: http://localhost:3000
```

---

## 🏗️ Arquitectura del Frontend

### Stack Técnico

- **React 18** - UI Library
- **TypeScript** - Type Safety
- **Vite** - Build Tool (ultra rápido)
- **AWS Cognito** - Autenticación OAuth2
- **Groq AI (Llama 3.3 70B)** - Chatbot inteligente

### Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/          # Componentes React
│   │   ├── auth/           # Login, autenticación
│   │   ├── chatbot/        # Chatbot con IA
│   │   ├── inventory/      # Vista de inventario
│   │   ├── marketPurchases/# Historial de compras
│   │   ├── orderCreation/  # Crear órdenes
│   │   ├── orderHistory/   # Órdenes completadas
│   │   ├── ordersInProgress/# Órdenes activas
│   │   └── recipesMenu/    # Menú de recetas
│   ├── services/           # Clients de API
│   │   ├── orderService.ts # API de órdenes, inventario, compras
│   │   └── chatService.ts  # Cliente Groq AI
│   ├── auth/               # Servicio de autenticación
│   │   └── authService.ts  # Manejo de Cognito
│   ├── config/             # Configuración
│   │   ├── globalConfig.ts # Variables de entorno
│   │   └── apiRouter.ts    # Routing local vs prod
│   ├── data/               # Datos estáticos
│   │   └── recipes.ts      # Catálogo de recetas
│   ├── types/              # TypeScript types
│   │   └── index.ts        # Interfaces y tipos
│   ├── App.tsx             # Componente principal
│   └── main.tsx            # Entry point
├── public/
│   └── runtime-config.js   # Configuración runtime
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🧩 Componentes Principales

### 1. **OrderCreation**
- Input para cantidad de platos
- Genera UUID automáticamente
- Envía `POST /orders` al backend
- Feedback visual de éxito/error

### 2. **OrdersInProgress**
- Lista órdenes activas (polling cada 5s)
- Estados: `CREATED`, `SELECTING_RECIPES`, `WAITING_INGREDIENTS`, `COOKING`
- Indicadores visuales por estado
- Muestra items seleccionados (recetas)

### 3. **OrderHistory**
- Órdenes completadas o fallidas
- Filtrado por estado
- Detalles de cada orden

### 4. **RecipesMenu**
- Catálogo de 6 recetas disponibles
- Ingredientes por receta
- Solo lectura (las recetas se seleccionan aleatoriamente en backend)

### 5. **Inventory**
- Stock actual de ingredientes
- Alertas de stock bajo
- Actualización en tiempo real

### 6. **MarketPurchases**
- Historial de compras al proveedor
- Estadísticas de compras
- Estado: `COMPLETED` o `FAILED`

### 7. **Chatbot** (Bonus Feature)
- Asistente virtual con IA (Groq/Llama 3.3 70B)
- Lenguaje natural: "Quiero 10 platos", "¿Qué recetas hay?"
- Integración directa con API de Groq
- Parseado de intenciones y ejecución de acciones

---

## 🔐 Autenticación con Cognito

### Flujo OAuth2 Implicit Grant

```
1. Usuario accede → Frontend detecta no autenticado
2. Redirect a Cognito Hosted UI
3. Usuario ingresa credenciales
4. Cognito redirect con tokens en URL hash:
   https://your-app.com/#id_token=xxx&access_token=yyy&expires_in=3600
5. Frontend captura tokens, limpia URL, guarda en localStorage
6. Requests incluyen header: Authorization: Bearer {id_token}
7. API Gateway valida con Cognito Authorizer
```

---

## 🤖 Chatbot con IA (Bonus Feature)

### Características

- **LLM**: Groq API con Llama 3.3 70B Versatile
- **Velocidad**: ~10x más rápido que OpenAI
- **Intenciones soportadas**:
  - Ver recetas/platos disponibles
  - Crear órdenes ("Quiero 5 platos")
  - Consultar estado de órdenes
  - Explicar cómo funciona el sistema

### ¿Por qué el Chatbot Accede Directamente?

El chatbot facilita enormemente la interacción del usuario:

**Creación de Órdenes Natural**
```
Usuario: "Quiero 10 platos"
Chatbot: [Parsea intent] → orderService.createOrder(10) → ✅ Orden creada
```

**Consulta de Estados Simplificada**
```
Usuario: "¿Dónde está mi orden?"
Chatbot: [Busca órdenes activas] → "Tienes 3 órdenes: 2 en cocina, 1 esperando ingredientes"
```

**Exploración del Sistema**
```
Usuario: "¿Qué platos tienen?"
Chatbot: [Lista recetas] → "Tenemos 6 recetas: Burger, Rice Bowl..."
```

El usuario puede **hablar naturalmente** en lugar de navegar por pestañas y hacer clicks. El chatbot actúa como un **asistente inteligente** que conoce todo el sistema y puede ejecutar acciones por el usuario.

### Arquitectura Técnica

```typescript
Usuario → Chatbot.tsx → chatService.ts → Groq API (Llama 3.3 70B)
                                            ↓
                                    Parse Intent (JSON)
                                            ↓
                      Execute Action (orderService.createOrder, etc.)
                                            ↓
                                  Respuesta al Usuario
```

Ver documentación completa en: [src/components/chatbot/README.md](src/components/chatbot/README.md)

---

## 🔄 Comunicación con Backend

### Polling Strategy

Frontend usa **polling** cada 5 segundos para mantener datos actualizados:

```typescript
useEffect(() => {
  const fetchData = async () => {
    const [orders, inventory, purchases] = await Promise.all([
      orderService.getOrders(),
      orderService.getInventory(),
      orderService.getPurchases(),
    ]);
    // Actualizar estado
  };

  fetchData(); // Inicial
  const interval = setInterval(fetchData, 5000); // Cada 5s
  return () => clearInterval(interval);
}, []);
```

**¿Por qué polling y no WebSockets?**
- Simplicidad: No requiere conexión persistente
- Funciona en cualquier infraestructura (Lambda, Fargate, EC2)
- Suficiente para el caso de uso (no es real-time crítico)
- AWS API Gateway tiene soporte limitado para WebSocket en Lambda

### API Endpoints Consumidos

```typescript
// Órdenes
POST   /orders              → Crear orden
GET    /orders              → Listar órdenes

// Inventario
GET    /inventory/ingredients          → Listar ingredientes
GET    /inventory/ingredients/{id}     → Ver ingrediente
GET    /inventory/reservations         → Ver reservas

// Compras
GET    /purchases          → Historial de compras
GET    /purchases/stats    → Estadísticas
```
