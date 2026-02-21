# 🍽️ Event-Driven Restaurant System

Sistema distribuido basado en microservicios y arquitectura orientada a eventos para automatizar:

- Creación de órdenes  
- Selección aleatoria de recetas  
- Gestión de inventario  
- Compra de ingredientes  
- Preparación y finalización de pedidos  

Diseñado para soportar alta concurrencia y múltiples instancias por servicio.

---

# 🏗️ Arquitectura General

## Microservicios

1. **Order Service**
2. **Kitchen Service**
3. **Inventory Service**
4. **Purchasing Service**

---

## Infraestructura

- **Event Bus:** Amazon SNS  
- **Queues por servicio:** Amazon SQS  
- **Compute:** AWS Lambda (contenedores Docker)  
- **Base de datos:** PostgreSQL (una por servicio)  
- **Infraestructura como código:** AWS CDK  
- **Observabilidad:** CloudWatch  

No existe comunicación síncrona entre microservicios.  
Toda interacción es mediante eventos.

---

# 📦 Responsabilidades por Servicio

---

## 1️⃣ Order Service

Responsable de:

- Crear órdenes  
- Persistir estado  
- Persistir composición final de la orden  
- Reaccionar a eventos de éxito o fallo  
- Exponer API REST al frontend  

### Estados de la Orden

```text
CREATED
RECIPES_SELECTED
INGREDIENTS_PENDING
COOKING
COMPLETED
FAILED
```

---

## 2️⃣ Kitchen Service

Responsable de:

- Seleccionar recetas aleatoriamente por cada plato  
- Calcular ingredientes agregados  
- Persistir selección internamente  
- Emitir:
  - `RecipesSelected`
  - `IngredientsRequired`
- Cocinar cuando recibe confirmación de ingredientes  
- Emitir `OrderCooked`  

No conoce inventario.  
No conoce compras.  
No escribe en la base de datos de Order.

---

## 3️⃣ Inventory Service

Responsable de:

- Gestionar stock  
- Realizar descuento atómico  
- Crear reservas  
- Determinar faltantes  
- Emitir:
  - `IngredientsReserved`
  - `IngredientsMissing`
- Liberar reservas si la compra falla  

Implementa control de concurrencia por fila.

---

## 4️⃣ Purchasing Service

Responsable de:

- Comprar ingredientes faltantes en la plaza  
- Emitir:
  - `IngredientsPurchased`
  - `IngredientsPurchaseFailed`

No gestiona stock.

---

# 🔁 Saga Coreografiada

No existe orquestador central.

Flujo principal:

1. `OrderCreated`  
2. `RecipesSelected`  
3. `IngredientsRequired`  
4. `IngredientsReserved` **o** `IngredientsMissing`  
5. `IngredientsPurchased` **o** `IngredientsPurchaseFailed`  
6. `OrderCooked`  
7. `OrderCompleted`  

---

# 📡 Eventos

## Envelope común

```json
{
  "eventId": "uuid",
  "eventType": "string",
  "timestamp": "ISO8601",
  "source": "service-name",
  "data": {}
}
```

Todos los servicios implementan idempotencia usando `eventId`.

---

## OrderCreated

```json
{
  "orderId": "uuid",
  "totalPlates": 5
}
```

---

## RecipesSelected

Kitchen comunica qué recetas fueron seleccionadas.

```json
{
  "orderId": "uuid",
  "recipes": [
    {
      "recipe_id": "uuid",
      "quantity": 2
    },
    {
      "recipe_id": "uuid",
      "quantity": 3
    }
  ]
}
```

Order escucha este evento y crea los `order_items`.

---

## IngredientsRequired

```json
{
  "orderId": "uuid",
  "ingredients": [
    {
      "ingredient_id": "uuid",
      "required_quantity": 10
    }
  ]
}
```

---

## IngredientsReserved

```json
{
  "orderId": "uuid",
  "ingredients": [
    {
      "ingredient_id": "uuid",
      "reserved_quantity": 10
    }
  ]
}
```

---

## IngredientsMissing

```json
{
  "orderId": "uuid",
  "ingredients": [
    {
      "ingredient_id": "uuid",
      "quantity": 2
    }
  ]
}
```

---

## IngredientsPurchased

```json
{
  "orderId": "uuid",
  "purchased_ingredients": [
    {
      "ingredient_id": "uuid",
      "quantity": 2
    }
  ]
}
```

---

## IngredientsPurchaseFailed

```json
{
  "orderId": "uuid",
  "reason": "supplier_unavailable"
}
```

---

## OrderCooked

```json
{
  "orderId": "uuid"
}
```

---

## OrderCompleted

```json
{
  "orderId": "uuid"
}
```

---

# 🗄️ Modelo de Datos

Cada microservicio tiene su propia base de datos PostgreSQL.

---

## Order Service

### orders

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  status VARCHAR NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### order_items

Se crean cuando Order consume `RecipesSelected`.

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  recipe_id UUID NOT NULL,
  quantity INT NOT NULL
);
```

---

## Inventory Service

### ingredients

```sql
CREATE TABLE ingredients (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  available INT NOT NULL
);
```

### reservations

```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  quantity INT NOT NULL,
  status VARCHAR NOT NULL
);
```

---

## Idempotencia (Todos los servicios)

```sql
CREATE TABLE events_processed (
  event_id UUID PRIMARY KEY,
  processed_at TIMESTAMP
);
```

Cada servicio mantiene su propia tabla.

---

# 🔐 Control de Concurrencia

Se utiliza:

```sql
SELECT available
FROM ingredients
WHERE id = :ingredient_id
FOR UPDATE;
```

## Objetivo

Evitar race conditions cuando múltiples órdenes intentan descontar el mismo ingrediente simultáneamente.

## Problema que previene

- Dos órdenes leen el mismo stock  
- Ambas descuentan  
- El inventario queda inconsistente  

La fila se bloquea solo durante una transacción corta para:

1. Leer stock  
2. Decidir  
3. Descontar  
4. Crear reserva  

El lock es granular por ingrediente.

---

# 📦 Lógica de Reserva

## Caso 1 — Stock suficiente

- Se descuenta la cantidad requerida  
- Se crea reserva  
- Se emite `IngredientsReserved`  

---

## Caso 2 — Stock parcial

Ejemplo: necesita 5, hay 3

- Se bloquea fila  
- Se descuenta 3  
- Se crea reserva por 3  
- Se emite `IngredientsMissing` por 2  

Si compra falla:

- Inventory libera la reserva  
- Se restaura el stock  

---

## Caso 3 — Sin stock

- No se descuenta  
- Se emite `IngredientsMissing`  

---

# 🔁 Reintentos y DLQ

- SQS con reintentos automáticos  
- Backoff exponencial  
- Dead Letter Queue por servicio  
- Eventos fallidos no bloquean el sistema  

---

# 🌐 Comunicación con Frontend

El frontend se comunica únicamente con:

- Order Service (REST)

El estado de la orden se consulta vía API.

La actualización ocurre cuando Order procesa:

- `OrderCompleted`  
- `IngredientsPurchaseFailed`  

---

# 🎯 Decisiones Arquitectónicas Finales

- Arquitectura 100% orientada a eventos  
- Saga coreografiada  
- Idempotencia por servicio  
- Control de concurrencia por fila para evitar race conditions en recursos compartidos  
- Bases de datos aisladas por dominio  
- Consistencia eventual  
- Infraestructura en AWS con Lambda + SNS + SQS + PostgreSQL  
- Microservicios desplegados como contenedores Docker  