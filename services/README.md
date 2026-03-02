# Services Communication Guide

Arquitectura **event-driven** con Amazon SNS. Cada servicio es autónomo con su propia BD PostgreSQL.

---

## Servicios

Todos los servicios funcionan como **Node.js instances en local** y **AWS Lambda en producción**.

### Modelo de ejecución

**Desarrollo Local (Node.js HTTP Server)**
```
Cliente HTTP → orden-service (puerto 3001)
             ↓
           Node.js HTTP Server (nativo)
             ↓
         EventBusLocal (LocalStack SNS/SQS)
             ↓
         Otros servicios (Node.js HTTP Servers)
```

- Cada servicio corre como aplicación Node.js independiente
- Servidor HTTP nativo escuchando en puerto específico (3001-3003)
- LocalStack proporciona SNS/SQS simulados
- Sin gestión de instancias, fácil debugging
- Ideal para desarrollo iterativo

**Producción AWS (Lambda + API Gateway)**
```
Cliente HTTP → API Gateway
             ↓
          Lambda Handler (async)
             ↓
         Real AWS SNS/SQS
             ↓
         Lambda Functions (otros servicios)
```

- Cada servicio = Lambda function independiente
- API Gateway enruta solicitudes a Lambda handlers
- Escalado automático por demanda
- Sin servidores que mantener
- Integración nativa con AWS IAM, CloudWatch, X-Ray

### Detalles por servicio

| Servicio | Responsabilidad | Datos expuestos |
|----------|-----------------|-----------------|
| **order-service** | Crear órdenes (punto de entrada) | Órdenes, estado |
| **kitchen-service** | Seleccionar recetas y cocinar | *(Solo event-driven, sin exposición HTTP)* |
| **inventory-service** | Reservar/comprar ingredientes | Ingredientes, reservaciones |
| **purchasing-service** | Comprar ingredientes | Historial de compras, estadísticas |

---

## Comunicación

- **Patrón**: Asincrónico por eventos (SNS)
- **Desacoplamiento**: Sin HTTP entre servicios, sin BD compartida
- **Responsabilidad**: Cada servicio publica eventos relevantes y escucha los que necesita

### Persistencia de eventos

Ambos entornos requieren **tabla `events_processed`** para idempotencia:
- `event_id` (PK): UUID del evento
- `processed_at`: timestamp

Antes de procesar evento, verificar si `event_id` existe. Evita duplicados si SNS/SQS reintentan.

### Handlers y Entry Points

**Local (Node.js)**
```typescript
// expressListener o HTTP Server nativo
http.createServer((req, res) => {
  if (req.url === '/orders' && req.method === 'POST') {
    // Controlador maneja REQUEST completo
    OrderController.handleCreateOrder(req, res);
  }
})
```

**Producción (Lambda)**
```typescript
// Lambda Handler (AWS_PROXY)
export const handler = async (event: APIGatewayProxyEvent) => {
  // event = {body, path, httpMethod, headers}
  // Retorna {statusCode, body, headers}
  return OrderController.handleCreateOrder(event);
}
```

Mismo controlador, diferente forma de invocar. NodeJS procesa request HTTP completo, Lambda recibe evento estructurado.

---

## Flujo General

```
order-service (crea orden)
    ↓ OrderCreated
kitchen-service (selecciona recetas)
    ↓ IngredientsRequired
inventory-service (reserva/compra)
    ↓ IngredientsReserved
kitchen-service (cocina)
    ↓ OrderCompleted
order-service (actualiza estado)
```

---

## Eventos

Todos siguen este formato:
```json
{
  "eventId": "uuid",
  "eventType": "string",
  "occurredAt": "ISO-8601",
  "source": "service-name",
  "data": {}
}
```

### Definición

| Evento | Publicado por | Escuchado por | Payload |
|--------|---------------|---------------|---------|
| **OrderCreated** | order-service | kitchen-service | `{orderId, totalDishes}` |
| **IngredientsRequired** | kitchen-service | inventory-service | `{orderId, ingredients[]}` |
| **IngredientsReserved** | inventory-service | kitchen-service, order-service | `{orderId}` |
| **IngredientPurchaseRequired** | inventory-service | purchasing-service | `{orderId, ingredient_required}` |
| **IngredientPurchaseCompleted** | purchasing-service | inventory-service | `{orderId, ingredient_purchased}` |
| **IngredientPurchaseFailed** | purchasing-service | order-service, inventory-service | `{orderId, reason}` |
| **OrderItemsSelected** | kitchen-service | order-service | `{orderId, items[]}` |
| **OrderCompleted** | kitchen-service | order-service | `{orderId}` |

---

## Exposición de Datos

### Arquitectura por entorno

| Entorno | Cómo acceden los clientes |
|---------|--------------------------|
| **Local** | HTTP directo al puerto del servicio |
| **Producción** | API Gateway + Lambda |

### Endpoints por servicio

**order-service** (Puerto 3001)
```
GET  /health               - Estado del servicio
POST /orders               - Crear nueva orden
GET  /orders               - Listar todas las órdenes
```

**inventory-service** (Puerto 3002)
```
GET  /health                           - Estado del servicio
GET  /inventory/ingredients            - Listar todos los ingredientes
GET  /inventory/ingredients/:id        - Obtener ingrediente específico
GET  /inventory/reservations           - Listar reservaciones (filterable por orderId)
```

**purchasing-service** (Puerto 3003)
```
GET  /health                           - Estado del servicio
GET  /purchases                        - Listar compras (filterable por orderId, ingredientId, limit)
GET  /purchases/stats                  - Estadísticas de compras
```

**kitchen-service**
```
No expone HTTP. Only event-driven communication.
```

---

## Comunicación Local

- **Docker Compose** + **LocalStack** simula SNS/SQS
- Topics y colas se crean automáticamente
- Servicios se conectan por variables de entorno

---

## Patrón de Diseño: Event Handler + Controllers

### Arquitectura por capas

```
┌─────────────────────────────────────┐
│   HTTP Request / Event Message      │
├─────────────────────────────────────┤
│ Controller / EventHandler           │  ← Orquestación, validación
│ (parseBody, validate, error-handle) │
├─────────────────────────────────────┤
│ Use Case / Business Logic           │  ← Lógica de negocio pura
│ (CreateOrder, ProcessPayment, etc)  │
├─────────────────────────────────────┤
│ Repository (Data Access)            │  ← Persistencia, queries
│ (OrderRepository, etc)              │
├─────────────────────────────────────┤
│ Database / Event Bus (SNS/SQS)      │  ← Infraestructura
└─────────────────────────────────────┘
```

### Controllers (HTTP Entry Point)

```typescript
// Local: HTTP Request Handler
class OrderController {
  async handleCreateOrder(req: IncomingMessage, res: ServerResponse) {
    const body = await parseBody(req);
    const validation = validateInput(body);
    if (!validation.valid) {
      res.writeHead(400);
      res.end(JSON.stringify({error: validation.errors}));
      return;
    }
    const result = await this.createOrderUseCase.execute(body);
    res.writeHead(201);
    res.end(JSON.stringify({success: true, data: result}));
  }
}

// Producción: Lambda Handler (reutiliza la misma lógica)
export const handler = async (event: APIGatewayProxyEvent) => {
  const body = JSON.parse(event.body || '{}');
  const validation = validateInput(body);
  if (!validation.valid) {
    return {
      statusCode: 400,
      body: JSON.stringify({error: validation.errors})
    };
  }
  const result = await this.createOrderUseCase.execute(body);
  return {
    statusCode: 201,
    body: JSON.stringify({success: true, data: result})
  };
}
```

Responsabilidades (mismo controlador, dos adapters):
- **Parsear** request (body, params, headers) → diferente en Node vs Lambda
- **Validar** estructura y tipos → **mismo código en ambos**
- **Invocar** use-case con datos limpios → **mismo código en ambos**
- **Formatear** respuesta HTTP → diferente en Node vs Lambda

**Reutilización:**
- Validación centralizada (método privado compartido)
- Use-case invocado idénticamente
- Diferencia solo en cómo se lee el request y genera la respuesta

### Event Handlers (SNS/SQS Entry Point)

```typescript
// Event Handler: Queue Message Processor
class OrderEventHandler {
  async handle(event: DomainEvent) {
    if (event.eventType === 'IngredientPurchaseFailed') {
      await this.handleIngredientFailed.execute(event.data);
    }
  }
}
```

Responsabilidades:
- **Consumir** eventos de SNS/SQS
- **Enrutar** según `eventType`
- **Invocar** use-case correspondiente
- **Garantizar** idempotencia (tabla `events_processed`)

### Use Cases (Lógica de negocio)

```typescript
// Business-focused, infraestructure-agnostic
class CreateOrderUseCase {
  async execute(input: CreateOrderInput): Promise<OrderCreatedEvent> {
    const order = Order.create(input.orderId, input.totalDishes);
    await this.orderRepository.save(order);
    const event = order.toDomainEvent();
    await this.eventBus.publish(event);
    return event;
  }
}
```

Responsabilidades:
- Implementar reglas de negocio
- Orquestar repositorios y servicios
- Retornar resultados predecibles

### Por qué este patrón

| Aspecto | Beneficio |
|---------|-----------|
| **Separación de concerns** | Controller ≠ Lógica ≠ Datos |
| **Testeable** | Use-cases sin HTTP/eventos |
| **Reutilizable** | Same use-case para HTTP, Lambda, cron |
| **Mantenible** | Cambiar HTTP a gRPC sin afectar lógica |
| **Escalable** | Fácil agregar handlers nuevos |

---

## Metodología: Test-Driven Development (TDD)

### Enfoque

```
1. PLAN: Definir todos los escenarios posibles
   ├ Happy path (orden válida → éxito)
   ├ Validations (campos faltantes, UUIDs inválidos)
   ├ Errores (BD no disponible, timeout)
   └ Edge cases (órdenes duplicadas, límites)

2. TEST: Escribir tests para cada escenario
   ├ Test fails (red)
   └ Implementar código mínimo (green)

3. IMPLEMENT: Lógica de negocio limpia
   └ Refactor manteniendo tests verdes
```

### Ejemplo: Order Creation Flow

**Escenarios identificados en planeación:**

```
✓ Crear orden con datos válidos
  → Guardar en BD
  → Generar eventId
  → Publicar OrderCreated
  → Retornar success

✓ Datos incompletos (falta orderId)
  → Error 400 "Field orderId is required"

✓ Invalid UUID format
  → Error 400 "Field orderId must be a valid UUID"

✓ totalDishes <= 0
  → Error 400 "Field totalDishes must be greater than 0"

✓ Database connection fails
  → Error 500 "Internal server error"

✓ SNS publish fails
  → Rollback orden en BD
  → Error 500
```

**Luego: Tests primero**

```typescript
describe('CreateOrderUseCase', () => {
  it('should create order and publish event', async () => {
    const input = {orderId: 'uuid...', totalDishes: 3};
    const result = await useCase.execute(input);
    expect(result.orderId).toBe('uuid...');
    expect(eventBus.published).toContain('OrderCreated');
  });

  it('should fail if BD unavailable', async () => {
    repository.save.mockRejectedValue(new Error('Connection failed'));
    expect(() => useCase.execute(input)).rejects.toThrow();
  });
  // ... más tests
});
```

**Finalmente: Implementación**

```typescript
class CreateOrderUseCase {
  async execute(input: CreateOrderInput): Promise<OrderCreatedEvent> {
    // El código ahora es guiado por los tests
    // Cada rama (happy, error, edge) ya tiene coverage
    const order = Order.create(input.orderId, input.totalDishes);
    await this.orderRepository.save(order);
    const event = order.toDomainEvent();
    await this.eventBus.publish(event);
    return event;
  }
}
```

### Ventajas en este proyecto

| Aspecto | Impacto |
|---------|---------|
| **Coverage 100%** | Escenarios planificados = todos los casos cubiertos |
| **Bugs prevenidos** | Edge cases descubiertos en planeación, no en producción |
| **Documentación** | Tests son especificación ejecutable |
| **Refactoring seguro** | Cambiar código sin miedo a romper |
| **Confianza** | Deploy con certeza |
| **Menos debugging** | Issues claros desde tests, no en manual testing |

### Estructura de carpetas (TDD-ready)

```
services/order-service/src/
├── __tests__/
│   ├── use-cases/
│   │   └── CreateOrderUseCase.test.ts    # Lógica pura
│   ├── controllers/
│   │   └── OrderController.test.ts       # Request handling
│   └── repositories/
│       └── OrderRepository.test.ts       # Data access
├── use-cases/
│   └── CreateOrderUseCase.ts             # ← Implementación guiada por tests
├── controllers/
│   └── OrderController.ts
└── repositories/
    └── OrderRepository.ts
```

---