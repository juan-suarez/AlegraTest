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

# 🔐 Control de Concurrencia

Se utiliza un sistema de reservas fuertes en el servicio de inventory, agregando una nueva tabla llamada `reservations`

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
- Se descuenta 3 -> (esto desbloqueando el ingrediente en db)
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