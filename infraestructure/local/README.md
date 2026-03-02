# 🐳 Setup Local - Docker Compose

Guía completa para ejecutar el sistema event-driven completo en tu máquina local.

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Docker y Docker Compose instalados
- Node.js 18+ (solo si quieres correr servicios sin Docker)
- Git

### Opción 1: Sistema Completo (Recomendado)

```bash
# Desde la raíz del proyecto
docker-compose up

# Esperar a que todos los servicios estén listos (~30 segundos)
# Luego accede a:
# - Frontend: http://localhost:3000
# - Order Service (API): http://localhost:3001/health
# - Inventory Service: http://localhost:3003/health
# - Purchasing Service: http://localhost:3004/health
```

**¿Qué se levanta?**
- PostgreSQL (4 databases)
- LocalStack (SNS/SQS)
- Frontend (React)
- Order Service
- Kitchen Service
- Inventory Service
- Purchasing Service

### Opción 2: Solo Infraestructura + Servicios

```bash
# Levanta PostgreSQL + LocalStack + 4 Microservicios (SIN frontend)
npm run dev:services

# Luego accede a los servicios en:
# http://localhost:3001 (order)
# http://localhost:3002 (kitchen)
# http://localhost:3003 (inventory)
# http://localhost:3004 (purchasing)
```

### Opción 3: Sistema Completo + E2E Tests

```bash
# Levanta todo y ejecuta tests automáticamente
npm run dev:test

# Verás en la consola el resultado de los tests
```

### Opción 4: Servicio Específico

```bash
# Solo levanta un servicio específico
docker-compose up order-service

# O múltiples servicios
docker-compose up order-service kitchen-service postgres localstack
```

---

## 📊 Estructura del Setup

### 📁 Directorios

```
infraestructure/local/
├── README.md                  # Documentación (este archivo)
├── e2e-tests/                 # Tests end-to-end automatizados
│   ├── Dockerfile             # Imagen para tests
│   ├── test-e2e.ts           # Suite de tests
│   └── tsconfig.json         # TypeScript config
├── localstack/                # AWS Services emulation
│   ├── init-aws.sh           # Script de inicialización
│   ├── verify.sh             # Verificar setup
│   └── wait-for-localstack.sh # Health check
├── postgres/                  # PostgreSQL initialization
│   ├── init-databases.sh     # Crear databases
│   └── verify-databases.sh   # Verificar conexión
└── scripts/                   # Helper scripts
    ├── start-services.sh     # Levantar microservicios
    └── wait-for-services.sh  # Esperar health checks
```

### 🐳 Servicios Disponibles en Docker

```
postgres          | PostgreSQL 15 (4 databases)
localstack        | SNS/SQS emulation
localstack-init   | Inicializa topics y queues
order-service     | Puerto 3001 (HTTP + Events)
kitchen-service   | Sin puerto (solo eventos)
inventory-service | Puerto 3003 (HTTP + Events)
purchasing-service| Puerto 3004 (HTTP + Events)
frontend          | Puerto 3000 (React SPA)
e2e-tester        | Ejecuta tests automatizados
```

---

## 🔧 Componentes del Setup

### 1. PostgreSQL

**Imagen**: `postgres:15`

**Bases de Datos**:
- `order_service` - Gestión de órdenes
- `kitchen_service` - Selección de recetas
- `inventory_service` - Gestión de stock
- `purchasing_service` - Historial de compras

**Credenciales**:
```
Username: postgres
Password: postgres
Host: postgres (dentro de Docker)
Port: 5432
```

**Inicialización**:
- Script: `postgres/init-databases.sh`
- Ejecuta al primer inicio
- Crea las 4 databases

**Verificación**:
```bash
docker-compose exec postgres psql -U postgres -c "SELECT datname FROM pg_database WHERE datname LIKE '%_service';"
```

---

### 2. LocalStack (SNS + SQS)

**Imagen**: `localstack/localstack:latest`

**Servicios emulados**:
- **SNS** (Simple Notification Service) - Event Bus
- **SQS** (Simple Queue Service) - Message Queues

**Configuración**:
```
Endpoint: http://localhost:4566 (desde local)
          http://localstack:4566 (desde Docker)
Region: us-east-1
Access Key: test (dummy)
Secret Key: test (dummy)
```

**Recursos creados en SNS**:

9 Topics para eventos:
- `OrderCreated`
- `OrderItemsSelected`
- `IngredientsRequired`
- `IngredientsReserved`
- `PurchaseRequested`
- `PurchaseCompleted`
- `PurchaseFailed`
- `IngredientsPurchaseFailed`
- `OrderCompleted`

**Recursos creados en SQS**:

4 Queues con 4 DLQ cada una:
```
order-service-queue            → order-service-dlq
kitchen-service-queue          → kitchen-service-dlq
inventory-service-queue        → inventory-service-dlq
purchasing-service-queue       → purchasing-service-dlq
```

**Subscriptions** (enrutamiento de eventos):
```
OrderCreated → kitchen-service-queue + order-service-queue

OrderItemsSelected → order-service-queue

IngredientsRequired → inventory-service-queue

IngredientsReserved → kitchen-service-queue + order-service-queue

PurchaseRequested → purchasing-service-queue

PurchaseCompleted → inventory-service-queue

PurchaseFailed → inventory-service-queue

IngredientsPurchaseFailed → order-service-queue

OrderCompleted → order-service-queue
```

**Inicialización**:
- Script: `localstack/init-aws.sh`
- Ejecuta automáticamente al startup
- Crea topics, queues y subscriptions

**Verificación**:
```bash
# Listar topics
docker-compose exec localstack awslocal sns list-topics

# Listar queues
docker-compose exec localstack awslocal sqs list-queues
```

---

### 3. Microservicios

**Levantamiento en paralelo**:
Cada servicio:
1. Espera a que PostgreSQL esté healthy
2. Espera a que LocalStack esté healthy
3. Instala dependencias (`npm install`)
4. Ejecuta migraciones (schema.sql)
5. Inicia polling de mensajes

**Variables de entorno** (configuradas automáticamente):
```bash
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME={service}_service
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localstack:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/000000000000/{service}-service-queue
POLLING_INTERVAL_MS=1000
SERVICE_PORT=300X
```

**Health Checks**:
- Cada servicio expone `GET /health`
- Docker Compose espera a que responda 200 OK
- Servicio es accesible cuando está "healthy"

---

### 4. Frontend

**Build**: Automático con variables de entorno locales
- URL del API: `http://localhost:3001` (detecta automáticamente local)
- Auth: Deshabilitado en local (`VITE_AUTH_ENABLED=false`)
- Polling: Actualiza datos cada 5 segundos

**Endpoints consumidos**:
```
POST http://localhost:3001/orders                  → crear orden
GET  http://localhost:3001/orders                  → listar órdenes
GET  http://localhost:3003/inventory/ingredients   → listar ingredientes
GET  http://localhost:3004/purchases               → historial de compras
```

---

### 5. E2E Tests

**Imagen**: Dockerfile personalizado en `e2e-tests/`

**Flujo de Test**:
```
1. Espera a que todos los servicios sean healthy
2. Limpia eventos previos de las databases
3. Crea una orden: POST /orders con 3 platos
4. Espera 15 segundos para propagación de eventos
5. Verifica eventos en todas las databases
6. Reporta resultados (PASS/FAIL)
```

**Eventos verificados**:
- `OrderCreated` en order_service.events_processed
- `OrderItemsSelected` en kitchen_service.events_processed
- `IngredientsRequired` en inventory_service.events_processed
- `IngredientsReserved` en inventory_service.events_processed
- `PurchaseRequested` (si hay stock faltante)
- `PurchaseCompleted` en purchasing_service
- `OrderCompleted` en order_service.events_processed
- Orden con estado `COMPLETED` en order_service.orders

---

## 📋 Gestión de Contenedores

### Ver Estado

```bash
# Ver estado de todos los contenedores
docker-compose ps

# Ver logs en tiempo real (todos los servicios)
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f order-service
docker-compose logs -f kitchen-service
docker-compose logs -f localstack
docker-compose logs -f postgres
```

### Iniciar/Parar

```bash
# Levantar todo (foreground)
docker-compose up

# Levantar en background
docker-compose up -d

# Parar todos los servicios (mantiene volúmenes)
docker-compose down

# Parar y eliminar volúmenes (elimina BD)
docker-compose down -v

# Reiniciar un servicio
docker-compose restart order-service
```

### Rebuild

```bash
# Reconstruir imágenes (si hay cambios en código)
docker-compose build

# Build específico
docker-compose build order-service

# Build sin caché
docker-compose build --no-cache
```

---

## 🧪 Ejecutar Tests

### E2E Tests Automáticos

```bash
# Con docker-compose (levanta todo + tests)
npm run dev:test

# Solo tests (si servicios ya están corriendo)
npm run test:e2e
```

**Output esperado**:
```
✅ Connected to all databases
✅ Event propagated: OrderCreated
✅ Event propagated: OrderItemsSelected
✅ Event propagated: IngredientsRequired
✅ Event propagated: IngredientsReserved
✅ Event propagated: OrderCompleted
✅ Order status is COMPLETED
✅ All tests passed!
```

### Tests Unitarios por Servicio

```bash
cd services/order-service
npm test                # Ejecutar tests
npm run test:coverage   # Con reporte de cobertura
npm run test:watch     # En modo watch
```

---

## 🔍 Debugging

### Ver Mensajes en Queue

```bash
# Conectar a LocalStack y ver topics
docker-compose exec localstack awslocal sns list-topics

# Ver subscriptions de un topic
docker-compose exec localstack awslocal sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:us-east-1:000000000000:OrderCreated
```

### Ver Eventos en Base de Datos

```bash
# Conectar a PostgreSQL
docker-compose exec postgres psql -U postgres

# Ver eventos procesados en cada servicio
SELECT * FROM order_service.events_processed ORDER BY processed_at DESC;
SELECT * FROM kitchen_service.events_processed ORDER BY processed_at DESC;
SELECT * FROM inventory_service.events_processed ORDER BY processed_at DESC;
SELECT * FROM purchasing_service.events_processed ORDER BY processed_at DESC;

# Ver órdenes y su estado
SELECT id, total_dishes, status FROM order_service.orders;

# Ver ingredientes y stock
SELECT name, stock FROM inventory_service.ingredients;

# Ver reservas
SELECT order_id, quantity_needed, quantity_reserved, status FROM inventory_service.ingredient_reservations;
```

### Ver Logs de Servicio (tiempo real)

```bash
# Ver logs de un servicio mientras ocurre una acción
docker-compose logs -f order-service &
# [Luego crear orden desde frontend]
# Verás logs del servicio en tiempo real
```

### Health Check Manual

```bash
# Verificar que cada servicio responde
curl http://localhost:3001/health      # Order
curl http://localhost:3002/health      # Kitchen (si expone)
curl http://localhost:3003/health      # Inventory
curl http://localhost:3004/health      # Purchasing
curl http://localhost:3000             # Frontend
```

---

## ⚡ Flujo Completo (Prueba Manual)

```bash
# 1. Levantar sistema
docker-compose up -d

# 2. Esperar ~30 segundos a que esté ready
docker-compose ps  # Ver que todo esté "healthy"

# 3. Acceder a frontend
open http://localhost:3000
# o en Linux: xdg-open http://localhost:3000

# 4. Crear orden:
# - Escribe un número (ej: 3)
# - Click en "Crear Orden"
# - Verás confirmación

# 5. Monitorear en segunda terminal
docker-compose logs -f order-service

# 6. Ver que la orden progresa:
# - "OrdersInProgress" muestra la orden con estado COOKING
# - Después de ~15 segundos, se mueve a "OrderHistory" con COMPLETED
```

---

## 🚨 Troubleshooting

### "Connection refused: PostgreSQL"

**Causa**: PostgreSQL no está listo o no inició

**Solución**:
```bash
# Esperar más tiempo
docker-compose ps  # Ver health status (debe ser "healthy")

# O reiniciar PostgreSQL
docker-compose restart postgres

# Ver logs
docker-compose logs postgres
```

### "Error: Topic does not exist"

**Causa**: LocalStack no inicializó topics

**Solución**:
```bash
# Verificar init script execution
docker-compose logs localstack-init

# Reiniciar localstack-init
docker-compose restart localstack-init

# Verificar que topics existan
docker-compose exec localstack awslocal sns list-topics
```

### "Order creada pero no aparece en frontend"

**Causa**: Frontend no está refrescando datos

**Solución**:
```bash
# Revisar console del browser (F12 → Console)
# Buscar errores de red

# Verificar que API está respondiendo
curl http://localhost:3001/orders

# Refrescar frontend manual
# En navegador: F5 (refresh page)
```

### "E2E Test falla - "timeout waiting for event""

**Causa**: Servicios no completaron propagación en tiempo

**Solución**:
```bash
# Aumentar timeout en test
# Editar infraestructure/local/e2e-tests/test-e2e.ts
# Cambiar: const WAIT_TIME = 15000 → 20000

# Ejecutar manualmente
npm run test:e2e

# Ver logs de todos los servicios
docker-compose logs --tail=100
```

### "Docker daemon not running"

**Causa**: Docker no está disponible

**Solución**:
```bash
# En Mac/Windows
# Abrir Docker Desktop

# En Linux
sudo systemctl start docker

# Verificar instalación
docker --version
docker-compose --version
```

### "Port already in use"

**Causa**: Otro proceso ocupa los puertos (3000, 3001, etc.)

**Solución**:
```bash
# Encontrar proceso en puerto 3000
lsof -i :3000

# Matar proceso
kill -9 <PID>

# O cambiar puerto en docker-compose.yml
# Buscar "ports:" y cambiar "3000:3000" → "3001:3000"
```

---

## 📊 Flujo de Datos (Diagram)

```
┌────────────────────────────────────────────────┐
│      Browser (localhost:3000)                   │
│         Frontend (React)                        │
└──────────────┬─────────────────────────────────┘
               │ HTTP REST
               ↓
┌────────────────────────────────────────────────┐
│      Docker Network (restaurant-network)       │
│                                                 │
│  ┌───────────────────────────────────────┐    │
│  │  order-service (3001)                 │    │
│  │  - POST /orders (create)              │    │
│  │  - GET  /orders (list)                │    │
│  │  - Event Consumer/Producer            │    │
│  └─────────┬───────────────────────────┬─┘    │
│            │ SNS Publish       SQS Pull │      │
│            ↓                          │        │
│  ┌───────────────────────────────────────┐    │
│  │  LocalStack (SNS/SQS)                 │    │
│  │  - 9 Topics (Eventos)                 │    │
│  │  - 4 Queues + 4 DLQ                   │    │
│  └─────────┬───────────────────────────┬─┘    │
│            │ SNS Topic                  │      │
│            ↓ SQS Queue                  │      │
│  ┌───────────────────────────────────────┐    │
│  │  Microservicios (Event Consumers)     │    │
│  │                                       │    │
│  │  ├─ kitchen-service                  │    │
│  │  │  - Select recipes randomly        │    │
│  │  │  - Publish IngredientsRequired     │    │
│  │  │                                   │    │
│  │  ├─ inventory-service (3003)         │    │
│  │  │  - Manage stock + reservations     │    │
│  │  │  - Publish PurchaseRequested      │    │
│  │  │                                   │    │
│  │  └─ purchasing-service (3004)        │    │
│  │     - Call external provider         │    │
│  │     - Publish PurchaseCompleted      │    │
│  └─────────┬───────────────────────────┬─┘    │
│            │ Events                     │      │
│            ↓                            ↓      │
│  ┌───────────────────────────────────────┐    │
│  │  PostgreSQL (5432)                    │    │
│  │  - order_service (órdenes)            │    │
│  │  - kitchen_service (recetas)          │    │
│  │  - inventory_service (stock)          │    │
│  │  - purchasing_service (compras)       │    │
│  │  - events_processed (idempotencia)     │    │
│  └───────────────────────────────────────┘    │
│                                                 │
└────────────────────────────────────────────────┘
```

---

## 🆚 Local vs AWS (Tabla Comparativa)

| Aspecto | Local | AWS |
|---------|-------|-----|
| **Database** | PostgreSQL en Docker | RDS PostgreSQL |
| **Event Bus** | LocalStack (SNS/SQS) | Amazon SNS/SQS |
| **Compute** | Node.js en Docker | AWS Lambda |
| **Frontend** | React en Docker | S3 + CloudFront |
| **API** | Node.js HTTP | API Gateway |
| **Auth** | Deshabilitado | Cognito |
| **Cost** | Libre (solo recursos maquina) | ~$0/mes (Free Tier) |
| **Deployment** | `docker-compose up` | `cdk deploy` |
| **Setup time** | 30 segundos | 15-20 minutos |

Ambos comparten la misma arquitectura de código, solo la infraestructura cambia.
