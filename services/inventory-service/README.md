# inventory-service

Servicio responsable de la gestión de inventario, reservas fuertes y coordinación de compras cuando no hay stock suficiente.

Es la única fuente de verdad del stock.

---

# 1. Responsabilidades

- Mantener stock consistente de ingredientes.
- Crear reservas fuertes por orden.
- Detectar faltantes.
- Solicitar compras.
- Aplicar resultados de compra.
- Liberar reservas cuando una orden es cancelada.
- Garantizar consistencia bajo concurrencia.

---

# 2. Modelo de Datos

## 2.1 Tabla: ingredients

| Campo      | Tipo     | Descripción |
|------------|----------|-------------|
| id         | UUID     | Identificador del ingrediente |
| name       | string   | Nombre |
| stock      | integer  | Unidades disponibles |
| created_at | datetime | Fecha creación |
| updated_at | datetime | Última actualización |

---

## 2.2 Tabla: reservations

| Campo             | Tipo     | Descripción |
|------------------|----------|-------------|
| id               | UUID     | Identificador |
| order_id         | UUID     | Orden asociada |
| ingredient_id    | UUID     | Ingrediente |
| quantity_needed  | integer  | Total requerido |
| quantity_reserved| integer  | Garantizado |
| status           | enum     | Estado |
| created_at       | datetime | Fecha creación |
| updated_at       | datetime | Última actualización |

---

## 2.3 Estados

- `RESERVED`
- `PURCHASE_PENDING`
- `RELEASED`

---

# 3. Garantía de Recursos (Reservas Fuertes)

La consistencia se garantiza usando reservas y bloqueo por fila.

## 3.1 Paso 1 — Bloqueo del ingrediente

```sql
SELECT stock
FROM ingredients
WHERE id = :ingredient_id
FOR UPDATE;
```

Esto:

- Bloquea la fila del ingrediente.
- Evita race conditions.
- Garantiza que dos órdenes no descuenten el mismo stock.

---

## 3.2 Paso 2 — Validación y descuento seguro

Se calcula el maximo entre la cantidad requerida y el stock

```sql
UPDATE ingredients
SET stock = max_required
WHERE id = :ingredient_id
```

y se crea la reserva del ingrediente, en caso de que no hagan falta unidades se crea en estado `RESERVED`. En el caso de que hagan falta unidades se crea en estado `PURCHASE_PENDING` y se publica el evento para generar la compra

Este patrón:

- Evita que el stock quede negativo.
- Protege contra condiciones de carrera.
- lleva una trazabilidad de los ingredientes que ya estan reservados para la orden. esto en caso de que no se pueda comprar alguno y asi liberarlos todos.

---

## 3.3 Resultado

- Si se descuenta completamente → `RESERVED`
- Si no hay stock → `PURCHASE_PENDING`

La reserva representa garantía real porque el stock ya fue descontado.

---

# 4. Flujo de Compra por Ingrediente

inventory publica:

```
PurchaseRequested
```

Evento por ingrediente:

```json
{
  "orderId": "123",
  "ingredientId": "tomato",
  "quantityRequired": 4
}
```

Esto debido a que no se pueden comprar varios ingredientes al mismo tiempo ni tampoco especificar la cantidad de ingredientes solicitada lo que implica un proceso de reintento de compras por parte de `purcharse-service` hasta garantizar la cantidad necesaria para completar la orden.

---

# 5. Recepción de PurchaseCompleted

Evento:

```json
{
  "orderId": "123",
  "ingredientId": "tomato",
  "quantityPurchased": 6
}
```

Proceso:

1. Verificar si la orden ya fue liberada.
2. Si está liberada:
   - Sumar `quantityPurchased` al stock.
   - Marcar la reserva como liberada.
   - Fin del proceso.

3. Si la orden sigue activa:
   - Obtener reserva.
   - calcular la cantidad que sobra:
     ```
     remaining = quantity_purchased - quantity_needed
     ```
   - cambiar el estado de la reserva a `RESERVED`
   - actualizar stock si quedo remaining

4. Completar orden:
   - si todas las reservas de la orden estan en estado `RESERVED` se da por completada la orden.
   - se publica el evento `IngredientsReserved`

---

# 6. Recepción de PurchaseFailed

Evento:

```json
{
  "orderId": "123",
  "ingredientId": "tomato",
  "quantityPurchased": 2
}
```

Importante:

En este modelo, `PurchaseFailed` puede traer cantidad parcial comprada.

purchasing-service:

- Intenta comprar múltiples veces.
- Si no logra cubrir lo requerido, emite `PurchaseFailed`.
- Puede traer cantidad > 0.

---

## 6.1 Proceso en inventory

Liberar cualquier cantidad previamente reservada con:

```sql
    WITH updated_reservations AS (
        UPDATE ingredient_reservations
        SET status = 'RELEASED'
        WHERE order_id = :order_id
        AND status <> 'RELEASED'
        RETURNING ingredient_id, quantity_reserved
    )
    UPDATE ingredients i
    SET stock = i.stock + ur.quantity_reserved
    FROM updated_reservations ur
    WHERE i.id = ur.ingredient_id;
```

esto libera toda la orden y marca todas las reservas como `RELEASED`.

ya por ultimo se manda a stock la cantidad que se haya logrado comprar en el purchaseFailed.

---
