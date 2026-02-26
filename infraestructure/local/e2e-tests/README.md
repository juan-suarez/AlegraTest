# E2E Test - Restaurant Event-Driven System

## Descripción

Este test automatizado verifica que toda la arquitectura event-driven del sistema de restaurante funciona correctamente end-to-end.

## Requisitos

- Docker y Docker Compose ejecutándose
- PostgreSQL (en container `restaurant-postgres`)
- LocalStack con SNS/SQS (en container `restaurant-localstack`)
- Los 4 servicios corriendo:
  - order-service
  - kitchen-service
  - inventory-service
  - purchasing-service

## Ejecutar el Test

### Opción 1: Con Docker Compose (Recomendado)

```bash
# Desde la raíz del proyecto
docker-compose up --profile e2e
```

El test se ejecutará automáticamente después de que todos los servicios estén healthy.

### Opción 2: Directamente con ts-node

```bash
# Desde la raíz del proyecto
npm run test:e2e
```

O manualmente:

```bash
npx ts-node ./infraestructure/e2e-tests/test-e2e.ts
```

## Flujo del Test

### Step 1️⃣: Verificar Conexiones a BDs

El test intenta conectar a las 4 bases de datos:
- order_db
- kitchen_db
- inventory_db
- purchasing_db

Si alguna no está lista, falla.

### Step 2️⃣: Limpiar Eventos Previos

Ejecuta `DELETE FROM events` en todas las BDs para empezar con estado limpio.

Esto asegura que el test es idempotente.

### Step 3️⃣: Crear una Orden

Inserta una orden en `order_db` con:
- `order_id`: `order-{timestamp}`
- `total_dishes`: 3
- `status`: SELECTING_RECIPES

Luego inserta manualmente el evento `OrderCreated` en la tabla de eventos (simulando lo que haría CreateOrderUseCase).

Este evento dispara todo el flujo.

### Step 4️⃣: Esperar Propagación

Espera 15 segundos para que los eventos se propaguen a través de toda la arquitectura:

```
OrderCreated (Order DB)
    ↓
OrderCreated (Kitchen Service consume)
    ↓
OrderItemsSelected + IngredientsRequired (publicados por Kitchen)
    ↓
IngredientsRequired (Inventory consume)
    ↓
PurchaseRequested + IngredientsReserved (publicados por Inventory)
    ↓
PurchaseRequested (Purchasing consume)
    ↓
PurchaseCompleted (publicado por Purchasing)
    ↓
PurchaseCompleted (Inventory consume)
    ↓
Eventos insertados en cada BD
```

### Step 5️⃣: Verificar Eventos

Cuenta eventos en cada BD:

```
SELECT COUNT(*) FROM events
SELECT event_type, COUNT(*) FROM events GROUP BY event_type
```

Reporta cuántos eventos hay en cada servicio y de qué tipo.

**Expectedexpectativa:**
- order_db: al menos 1 evento (OrderCreated)
- kitchen_db: eventos variados
- inventory_db: eventos de compra/reserva
- purchasing_db: eventos de compra solicitada

### Step 6️⃣: Verificar Estado Final

Verifica que la orden existe en order_db.

## Resultados

### Test Exitoso ✅

```
╔════════════════════════════════════════════════════════╗
║                    ✅ TEST EXITOSO                      ║
╚════════════════════════════════════════════════════════╝

📊 Resultados:

  ID Orden: order-1708865400123
  Duración: 17234ms
  Eventos totales: 12

  Eventos por servicio:
    • Order: 1
    • Kitchen: 2
    • Inventory: 5
    • Purchasing: 4

✨ Arquitectura event-driven funcionando correctamente
```

### Test Fallido ❌

```
╔════════════════════════════════════════════════════════╗
║                   ❌ TEST FALLIDO                       ║
╚════════════════════════════════════════════════════════╝

❌ Errores:

  • Error conectando a Order DB: ECONNREFUSED 127.0.0.1:5432
  • DatabaseError: connection timeout
```

## Variables de Entorno

El test usa estas variables (con defaults):

```env
ORDER_DB_URL=postgresql://postgres:postgres@localhost:5432/order_db
KITCHEN_DB_URL=postgresql://postgres:postgres@localhost:5432/kitchen_db
INVENTORY_DB_URL=postgresql://postgres:postgres@localhost:5432/inventory_db
PURCHASING_DB_URL=postgresql://postgres:postgres@localhost:5432/purchasing_db
EVENT_BUS_ENDPOINT=http://localhost:4566
```

Si usas Docker Network, cambia a:

```env
ORDER_DB_URL=postgresql://postgres:postgres@postgres:5432/order_db
KITCHEN_DB_URL=postgresql://postgres:postgres@postgres:5432/kitchen_db
INVENTORY_DB_URL=postgresql://postgres:postgres@postgres:5432/inventory_db
PURCHASING_DB_URL=postgresql://postgres:postgres@postgres:5432/purchasing_db
EVENT_BUS_ENDPOINT=http://localstack:4566
```

## Troubleshooting

### Problema: "Connection refused"

**Causa:** PostgreSQL no está corriendo o servicios no son accesibles

**Solución:**
```bash
docker-compose up postgres localstack
docker-compose ps  # Verificar health

# Or si ejecutas manualmente:
docker-compose up  # Levanta todo
npm run test:e2e   # Ejecuta test en otra terminal
```

### Problema: "Table events not found"

**Causa:** El script de inicialización de BDs no se ejecutó

**Solución:**
```bash
docker-compose down -v  # Eliminar volúmenes
docker-compose up postgres  # Reiniciar con init completo
docker-compose ps  # Esperar a que sea healthy
```

### Problema: "No events found in database"

**Causa:** Los servicios no están procesando eventos

**Solución:**
1. Verifica que los 4 servicios están corriendo: `docker-compose ps`
2. Revisa logs: `docker-compose logs kitchen-service`
3. Verifica SNS/SQS: `docker exec restaurant-localstack awslocal sqs list-queues`
4. Prueba conectividad: `docker exec restaurant-order-service curl http://restaurant-kitchen-service:3002/health`

### Problema: "Test timeout"

**Causa:** Los servicios son lentos para procesar eventos

**Solución:**
- Aumenta el tiempo de espera en `test-e2e.ts` (línea ~200):
  ```typescript
  await this.waitForEventPropagation(); // Aumentar de 15s a 30s
  ```

## Extensiones Futuras

1. **Verificaciones más detalladas:** Validar contenido de eventos, no solo cantidad
2. **Performance metrics:** Medir latencia de propagación
3. **Chaos testing:** Simular fallos de servicios
4. **Load testing:** Crear múltiples órdenes simultáneamente
5. **Integración con CI/CD:** Automatizar en GitHub Actions

## Ver Eventos en Base de Datos

Mientras el test corre (en otra terminal):

```bash
docker exec restaurant-postgres psql -U postgres

# En psql:
\c order_db
SELECT * FROM events;

\c kitchen_db
SELECT * FROM events;

\c inventory_db
SELECT * FROM events;

\c purchasing_db
SELECT * FROM events;
```

## Monitorear Servicios

```bash
# Ver logs de todos
docker-compose logs -f

# Ver logs de un servicio
docker-compose logs -f kitchen-service

# Ver logs del E2E test
docker-compose logs -f e2e-tester
```

---

**Created at:** February 25, 2026
**Status:** Ready for testing
