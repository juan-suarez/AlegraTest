# Order Service

El `order-service` es responsable de:

- Crear órdenes
- Persistir su estado
- Persistir los platos seleccionados (order_items)
- Reaccionar a eventos del sistema
- Exponer el estado final para el frontend

No decide recetas.  
No gestiona inventario.  
No cocina.  

Su única responsabilidad es el ciclo de vida de la orden.

---

# 1. Estados de una Orden

Una orden puede estar en los siguientes estados:

| Estado | Descripción |
|--------|------------|
| `CREATED` | La orden fue creada y publicada al sistema |
| `SELECTING_RECIPES` | Kitchen está seleccionando recetas |
| `WAITING_INGREDIENTS` | Se están gestionando los ingredientes |
| `COOKING` | Los ingredientes están listos y se está cocinando |
| `COMPLETED` | La orden fue cocinada exitosamente |
| `FAILED` | No se pudieron obtener ingredientes |

---

# 2. Modelo de Datos

---

## 2.1 Tabla: orders

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    total_dishes INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Campos

- `id`: identificador único de la orden
- `total_dishes`: cantidad de platos solicitados
- `status`: estado actual de la orden
- `created_at`: fecha de creación
- `updated_at`: fecha de última actualización

---

## 2.2 Tabla: order_items

Esta tabla se llena cuando `kitchen-service` publica `OrderItemsSelected`.

```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    recipe_id UUID NOT NULL,
    quantity INTEGER NOT NULL
);
```

### Campos

- `id`: identificador del item
- `order_id`: referencia a la orden
- `recipe_id`: receta seleccionada por kitchen
- `quantity`: cantidad de platos de esa receta

---

# 3. Máquina de Estados

El `order-service` implementa una máquina de estados explícita para garantizar consistencia.

---

## Transiciones Permitidas

```
CREATED
  ↓
SELECTING_RECIPES
  ↓
WAITING_INGREDIENTS
  ↓
COOKING
  ↓
COMPLETED
```

Flujo alterno:

```
WAITING_INGREDIENTS
  ↓
FAILED
```

---

# 4. Eventos que Cambian el Estado

---

## 4.1 OrderCreated (interno)

Cuando el frontend crea una orden:

- Se crea el registro en DB
- Estado inicial: `CREATED`
- Se publica el evento `OrderCreated`

Luego el servicio cambia inmediatamente a:

```
SELECTING_RECIPES
```

---

## 4.2 OrderItemsSelected

**Emitido por:** kitchen-service  

Acciones:

- Se crean los registros en `order_items`
- Estado → `WAITING_INGREDIENTS`

---

## 4.3 IngredientsReserved

**Emitido por:** inventory-service  

Acciones:

- Estado → `COOKING`

---

## 4.4 OrderCompleted

**Emitido por:** kitchen-service  

Acciones:

- Estado → `COMPLETED`
- Se actualiza `updated_at`

---

## 4.5 IngredientsPurchaseFailed

**Emitido por:** inventory-service  

Acciones:

- Estado → `FAILED`
- Se registra motivo si se desea extender el modelo

---

# 5. Reglas de Consistencia

- No se permiten transiciones inválidas.
- Cada cambio de estado valida el estado actual antes de modificarlo.
- Todas las transiciones ocurren dentro de una transacción.
- Se aplica idempotencia antes de procesar cualquier evento.

---

# 6. Responsabilidades Claras

El order-service:

✔ Mantiene el estado oficial de la orden  
✔ Persiste qué recetas fueron seleccionadas  
✔ Expone datos al frontend  
✔ Implementa la máquina de estados  

No:

✘ Selecciona recetas  
✘ Calcula ingredientes  
✘ Gestiona stock  
✘ Cocina  

---
