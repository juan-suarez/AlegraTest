# Services Communication Guide

Este documento describe cómo se comunican los microservicios del sistema, qué eventos existen, qué servicio publica cada uno y quién los consume.

La arquitectura sigue un modelo **event-driven puro** usando Amazon SNS como bus de eventos.  
Cada servicio es autónomo, posee su propia base de datos PostgreSQL y no comparte código ni modelos internos.

---

## 1. Principios de Comunicación

- Comunicación asíncrona basada en eventos
- Desacoplamiento total entre servicios
- Cada servicio:
  - Publica eventos cuando algo relevante ocurre en su dominio
  - Escucha únicamente los eventos que necesita
- No existe comunicación directa HTTP entre microservicios
- No se comparte base de datos
- No existe librería `common` compartida

---

## 2. Servicios

- `order-service`
- `kitchen-service`
- `inventory-service`
- `purchasing-service`

---

## 3. Flujo General del Sistema

1. `order-service` crea una orden.
2. `kitchen-service` escucha `OrderCreated` y selecciona recetas aleatorias.
3. `kitchen-service` publica `IngredientsRequired`.
4. `inventory-service` intenta reservar o comprar ingredientes.
5. `inventory-service` publica:
   - `IngredientsReserved` (si todo está disponible o comprado)
   - `IngredientsPurchaseFailed` (si no se puede completar)
6. `kitchen-service` cocina cuando recibe `IngredientsReserved`.
7. `kitchen-service` publica `OrderCompleted`.
8. `order-service` actualiza el estado final de la orden.

---

## 4. Envelope de Eventos

Todos los eventos siguen la misma estructura:

```json
{
  "eventId": "uuid",
  "eventType": "string",
  "occurredAt": "ISO-8601",
  "source": "service-name",
  "data": {}
}
```

### Campos

- `eventId`: UUID global único (usado para idempotencia)
- `eventType`: nombre del evento
- `occurredAt`: timestamp ISO
- `source`: servicio que lo emitió
- `data`: payload específico del evento

---

## 5. Definición de Eventos

### 5.1 OrderCreated

**Publicado por:** `order-service`  
**Escuchado por:** `kitchen-service`

```json
{
  "orderId": "uuid",
  "totalDishes": 3
}
```

Notas:

- No incluye recetas.
- Solo indica cuántos platos se deben cocinar.
- `kitchen-service` decide qué recetas usar.

---

### 5.2 IngredientsRequired

**Publicado por:** `kitchen-service`  
**Escuchado por:** `inventory-service`

```json
{
  "orderId": "uuid",
  "ingredients": [
    {
      "ingredientId": "uuid",
      "quantity": 5
    },
    {
      "ingredientId": "uuid",
      "quantity": 2
    }
  ]
}
```

Notas:

- Representa el total agregado de ingredientes requeridos para todos los platos.
- No incluye `recipeIds`.

---

### 5.3 IngredientsReserved

**Publicado por:** `inventory-service`  
**Escuchado por:**
- `kitchen-service`
- `order-service`

```json
{
  "orderId": "uuid"
}
```

Notas:

- Indica que todos los ingredientes fueron asegurados.
- No incluye información interna de reservas.

---

### 5.4 IngredientPurchaseRequired

**Publicado por:** `inventory-service`  
**Escuchado por:**
- `kitchen-service`
- `purchase-service`

```json
{
  "orderId": "uuid",
  "ingredient_required": {
    "id": "uuid",
    "quantity": 2
  }
}
```

Notas:

- Indica que se requiere comprar ingredientes.
- No incluye información interna de stock.

---

### 5.5 IngredientPurchaseCompleted

**Publicado por:** `purchase-service`  
**Escuchado por:** `inventory-service`

```json
{
  "orderId": "uuid",
  "ingredient_purchased": {
    "id": "uuid",
    "quantity": 2
  }
}
```

---

### 5.6 IngredientPurchaseFailed

**Publicado por:** `purchase-service`  
**Escuchado por:**
- `order-service`
- `inventory-service`

```json
{
  "orderId": "uuid",
  "reason": "string"
}
```

---

### 5.7 OrderItemsSelected

**Publicado por:** `kitchen-service`  
**Escuchado por:** `order-service`

```json
{
  "orderId": "uuid",
  "items": [
    {
      "recipeId": "uuid",
      "quantity": 1
    },
    {
      "recipeId": "uuid",
      "quantity": 2
    }
  ]
}
```

Notas:

- `kitchen-service` selecciona recetas aleatoriamente.
- `order-service` crea los `order_items` en su propia base de datos.

---

### 5.8 OrderCompleted

**Publicado por:** `kitchen-service`  
**Escuchado por:** `order-service`

```json
{
  "orderId": "uuid"
}
```

Notas:

- No incluye `recipeId`.
- Solo indica que la orden fue completada.

---

## 6. Idempotencia

Cada servicio mantiene su propia tabla:

```
events_processed
```

Columnas:

- `event_id` (PK)
- `processed_at`

Antes de procesar un evento:

1. Verifica si `event_id` ya existe.
2. Si existe → ignora.
3. Si no → procesa y registra.

Esto evita procesamiento duplicado si SNS o SQS reintentan la entrega.

---

## 7. Comunicación Local

Para pruebas locales:

- Se usa Docker Compose.
- Se levanta LocalStack para simular:
  - SNS (topics)
  - SQS (colas y suscripciones)
- Cada servicio se conecta vía variables de entorno.
- Los topics y colas se crean automáticamente al iniciar el entorno local.
- Se pueden ejecutar pruebas end-to-end publicando eventos en el bus simulado.

---

## 8. Exposición HTTP: order-service

### 8.1 Arquitectura actual

`order-service` es el único punto de entrada HTTP del sistema. Expone un servidor HTTP nativo (Node.js) que recibe solicitudes para crear órdenes.

**Endpoint disponible:**
```
POST http://localhost:3001/orders
GET  http://localhost:3001/health
```

**Request body:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "totalDishes": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eventId": "7a6e8b27-8e03-4aad-955d-0f2c4e3c4d2b",
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "totalDishes": 3,
    "timestamp": "2026-02-26T13:23:04.627Z"
  }
}
```

### 8.2 Validaciones implementadas

- `orderId`: Requerido, string, formato UUID válido
- `totalDishes`: Requerido, número entero positivo
- Sin campos adicionales permitidos

**Ejemplo de error de validación:**
```json
{
  "error": "Validation failed",
  "details": [
    "Field \"orderId\" must be a valid UUID",
    "Field \"totalDishes\" must be greater than 0"
  ]
}
```

### 8.3 Flujo de procesamiento

1. Cliente HTTP → `POST /orders`
2. `OrderController` valida el request
3. `CreateOrderUseCase` ejecuta:
   - Guarda orden en PostgreSQL
   - Genera `eventId` único
   - Publica evento `OrderCreated` a SNS
4. Retorna respuesta HTTP 201
5. Sistema event-driven continúa asíncronamente

### 8.4 Opción alternativa: API Gateway + Lambda (AWS)

En un entorno de producción AWS real, la arquitectura podría usar:

```
Cliente → API Gateway → Lambda → SNS → Microservicios
```

**Ventajas:**
- Serverless (sin gestión de servidores)
- Auto-scaling automático
- Integración nativa con AWS

**Configuración de API Gateway con Lambda:**

```bash
# 1. Crear REST API
api_id=$(aws apigateway create-rest-api \
  --name "restaurant-api" \
  --output text --query 'id')

# 2. Crear recurso /orders
orders_id=$(aws apigateway create-resource \
  --rest-api-id "$api_id" \
  --parent-id "$root_id" \
  --path-part "orders" \
  --output text --query 'id')

# 3. Crear método POST
aws apigateway put-method \
  --rest-api-id "$api_id" \
  --resource-id "$orders_id" \
  --http-method POST \
  --authorization-type NONE

# 4. Integrar con Lambda (AWS_PROXY)
aws apigateway put-integration \
  --rest-api-id "$api_id" \
  --resource-id "$orders_id" \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:ACCOUNT_ID:function:order-handler/invocations"

# 5. Desplegar
aws apigateway create-deployment \
  --rest-api-id "$api_id" \
  --stage-name "prod"
```

### 8.5 Opción alternativa: API Gateway + HTTP Backend

Si se prefiere mantener el servidor HTTP pero exponer a través de API Gateway:

```bash
# Integración HTTP_PROXY
aws apigateway put-integration \
  --rest-api-id "$api_id" \
  --resource-id "$orders_id" \
  --http-method POST \
  --type HTTP_PROXY \
  --integration-http-method POST \
  --uri "http://order-service:3001/orders"
```

**Parámetros clave:**
- `--type HTTP_PROXY`: Forwarding directo sin transformaciones
- `--integration-http-method POST`: Método HTTP real al backend
- `--uri`: URL completa del servicio (debe ser accesible desde API Gateway)

### 8.6 Por qué usamos HTTP directo en desarrollo local

**Razones técnicas:**

1. **LocalStack Community Edition** tiene limitaciones con Lambda:
   - Lambda no se ejecuta correctamente en LocalStack CE
   - HTTP_PROXY tiene bugs conocidos en versión gratuita
   - Difícil debugging sin logs detallados

2. **Simplicidad para desarrollo local:**
   - HTTP directo es más fácil de debuggear
   - Curl directo a `localhost:3001`
   - Sin intermediarios que puedan fallar

3. **Pragmatismo:**
   - El código está listo para Lambda (se mantiene como referencia)
   - Para producción AWS real, se migraría a Lambda
   - Para desarrollo local, HTTP nativo es más confiable

**Arquitectura recomendada por entorno:**

| Entorno | Arquitectura |
|---------|--------------|
| **Desarrollo local** | HTTP directo (puerto 3001) |
| **Staging/QA** | API Gateway + Lambda |
| **Producción** | API Gateway + Lambda + WAF |

### 8.7 Componentes clave del código

**OrderController** (`services/order-service/src/controllers/OrderController.ts`)
- Maneja requests HTTP nativos
- Valida estructura y tipos
- Invoca `CreateOrderUseCase`
- Retorna respuestas HTTP estándar

**HTTP Server** (`services/order-service/src/index.ts`)
- Servidor HTTP nativo Node.js
- Routing simple (POST /orders, GET /health)
- Puerto configurable via `SERVICE_PORT` (default: 3001)

**CreateOrderUseCase** (`services/order-service/src/use-cases/CreateOrderUseCase.ts`)
- Lógica de negocio independiente del transporte
- Persiste en PostgreSQL
- Publica evento a SNS
- Reutilizable tanto para HTTP como Lambda

---