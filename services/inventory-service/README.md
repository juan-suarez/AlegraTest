# Inventory Service

Este servicio es crítico para garantizar consistencia bajo alta concurrencia.

---

# 1. Responsabilidades

✔ Mantener stock consistente  
✔ Evitar race conditions  
✔ Garantizar que una orden no use recursos de otra  
✔ Crear reservas fuertes  
✔ Liberar reservas si la compra falla  
✔ Publicar `IngredientsReserved` o `IngredientsPurchaseFailed`  

No:

✘ Cocina  
✘ Cambia estados de órdenes directamente  
✘ Selecciona recetas  

---

# 2. Modelo de Datos

---

## 2.1 Tabla: ingredients

```sql
CREATE TABLE ingredients (
    id UUID PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    stock INTEGER NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Inicialización

Cada ingrediente inicia con:

```
stock = 5
```

---

## 2.2 Tabla: reservations

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Estados de Reserva

| Estado | Significado |
|--------|------------|
| `RESERVED` | Stock descontado y asegurado |
| `PURCHASE_PENDING` | En espera de compra externa |
| `PURCHASED_RESERVED` | Compra exitosa y ya reservado |
| `RELEASED` | Liberado por fallo |
| `COMMITTED` | Consumido definitivamente |

---

# 3. Reserva Fuerte 

Reserva fuerte significa:

- El stock se descuenta inmediatamente.
- Ninguna otra orden puede usar esas unidades.
- Todo ocurre dentro de una transacción.
- Se evita race condition en recursos compartidos.

---

# 4. Control de Concurrencia

Se usa:

```sql
SELECT stock
FROM ingredients
WHERE id = $1
FOR UPDATE;
```

Esto:

- Bloquea temporalmente la fila del ingrediente.
- Evita que múltiples órdenes lean el mismo stock simultáneamente.
- Garantiza consistencia en alta concurrencia.

El bloqueo dura únicamente durante la transacción, mientras se decide si se tiene que enviar a comprar o no, pero no necesariamente espera a que la compra se efectua. si requiere comprar ingredientes genera la reserva, se desbloquea la fila en la db, se publica el evento para generar la compra y la instancia se libera.

---

# 5. Casos de Procesamiento

El servicio recibe:

```
IngredientsRequired
```

con múltiples ingredientes.

Cada ingrediente se procesa dentro de una transacción independiente para evitar bloqueos prolongados.

---

# 5.1 Caso 1 — Stock Suficiente

Ejemplo:

Se requieren 3 tomates.  
Stock actual: 5.

Flujo:

1. Se ejecuta `SELECT ... FOR UPDATE`
2. Se verifica que `stock >= required`
3. Se actualiza:

```sql
UPDATE ingredients
SET stock = stock - 3
WHERE id = $1;
```

4. Se crea reserva:

```sql
INSERT INTO reservations (...)
VALUES (..., status = 'RESERVED');
```

5. Se confirma la transacción.

Resultado:

- Stock nuevo: 2
- Unidades aseguradas exclusivamente para esa orden

---

# 5.2 Caso 2 — Stock Parcial (requiere compra)

Ejemplo:

Se requieren 5 tomates.  
Stock actual: 3.

Flujo:

1. `SELECT ... FOR UPDATE`
2. Se detecta que falta inventario.
3. Se descuentan inmediatamente los 3 disponibles:

```sql
UPDATE ingredients
SET stock = 0
WHERE id = $1;
```

4. Se crea reserva por las 3 unidades existentes:

```sql
status = 'RESERVED'
quantity = 3
```

5. Se calcula faltante: 2 unidades.
6. Se crea registro adicional en `reservations`:

```sql
status = 'PURCHASE_PENDING'
quantity = 2
```

7. Se confirma transacción.
8. Se solicita compra externa por 2 unidades.

---

## Si la compra es exitosa

1. Se actualiza reserva:

```
status = 'PURCHASED_RESERVED'
```

2. Se publica `IngredientsReserved` (cuando todos los ingredientes estén asegurados).

---

## Si la compra falla

1. Se liberan reservas:

```sql
UPDATE reservations
SET status = 'RELEASED'
WHERE order_id = $1;
```

2. Se restauran cantidades al stock:

```sql
UPDATE ingredients
SET stock = stock + released_quantity;
```

3. Se publica:

```
IngredientsPurchaseFailed
```

---

# 5.3 Caso 3 — Stock Cero

Ejemplo:

Se requieren 4 tomates.  
Stock actual: 0.

Flujo:

1. No se descuenta nada.
2. Se crea reserva:

```
status = 'PURCHASE_PENDING'
quantity = 4
```

3. Se solicita compra externa por 4 unidades.

Si compra exitosa:

- Reserva → `PURCHASED_RESERVED`

Si falla:

- Reserva → `RELEASED`

---

# 6. Publicación de Eventos

Cuando todos los ingredientes de la orden estén asegurados:

```
IngredientsReserved
```

Si alguno falla:

```
IngredientsPurchaseFailed
```

---

# 7. Garantía de Aislamiento entre Órdenes

Gracias a:

- `SELECT FOR UPDATE`
- Descuento inmediato de stock
- Creación de reservas fuertes
- Procesamiento transaccional por ingrediente

Se garantiza que:

- Ninguna orden usa ingredientes ya reservados
- No hay doble consumo
- No hay race condition en recursos compartidos

---