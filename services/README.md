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