# purchasing-service

Servicio responsable de interactuar con el proveedor externo de ingredientes.

No mantiene estado de negocio propio ni stock.
Su responsabilidad es intentar comprar la cantidad requerida y emitir un único resultado final por ingrediente.

---

# 🚀 Cómo ejecutar

```bash
# Instalar dependencias
npm install

# Desde raíz: levantar Docker Compose (BD + LocalStack)
docker-compose up -d

# Ejecutar el servicio
npm start

# Desarrollo (con reload automático)
npm run dev

# Tests
npm test
```

**Puerto:** 3003

---

# 1. Responsabilidades

- Recibir solicitudes de compra por ingrediente.
- Llamar al proveedor externo.
- Reintentar compras si la cantidad adquirida es insuficiente.
- Emitir un único evento final:
  - `PurchaseCompleted`
  - `PurchaseFailed`
- Manejar tolerancia a fallos externos.
- Ser idempotente ante reentregas de eventos.

---

# 2. Contexto del Problema

El proveedor externo NO permite solicitar una cantidad específica.

Cada llamada retorna:

```json
{
  "ingredientId": "tomato",
  "quantitySold": 3
}
```

Esto introduce dos posibles escenarios:

- Puede vender MÁS de lo que necesitamos.
- Puede vender MENOS de lo que necesitamos.

El servicio debe encargarse de manejar esta variabilidad.

---

# 3. Evento de Entrada

## PurchaseRequested

Emitido por inventory-service.

```json
{
  "orderId": "123",
  "ingredientId": "tomato",
  "quantityRequired": 5
}
```

Este evento se emite por ingrediente.

---

# 4. Estrategia de Compra

El flujo interno es:

```
acumulado = 0
reintentos = 0

mientras acumulado < quantityRequired y reintentos < MAX_RETRIES:
    llamar proveedor
    acumulado += quantitySold
    reintentos++
```

Configuración sugerida:

- `MAX_RETRIES = 8`
- Backoff exponencial entre intentos

---

# 5. Backoff Exponencial

Para evitar saturar al proveedor:

Intento 1 → inmediato  
Intento 2 → espera 200ms  
Intento 3 → espera 400ms  

Fórmula típica:

```
delay = base * 2^intento
```

Esto mejora resiliencia y evita tormentas de llamadas.

---

# 6. Evento de Salida

Solo se emite un evento final por ingrediente.

---

## 6.1 PurchaseCompleted

Se emite cuando:

```
acumulado >= quantityRequired
```

Payload:

```json
{
  "orderId": "123",
  "ingredientId": "tomato",
  "quantityPurchased": 7
}
```

Notas:

- Puede ser mayor que lo requerido.
- inventory se encarga del excedente.
- No existe estado parcial intermedio.

---

## 6.2 PurchaseFailed

Se emite cuando:

```
acumulado < quantityRequired
y se agotaron los reintentos
```

Payload:

```json
{
  "orderId": "123",
  "ingredientId": "tomato",
  "quantityPurchased": 2
}
```

Notas:

- Puede traer cantidad mayor que 0.
- inventory debe:
  - Sumar esta cantidad al stock.
  - Liberar la reserva.
  - Notificar fallo de ingredientes.

---

# 7. Modelo de Datos

purchasing-service NO necesita tablas de negocio.

Opcionalmente puede tener:

## Tabla: processed_events

Para idempotencia.

| Campo      | Tipo  |
|------------|-------|
| event_id   | UUID  |
| created_at | datetime |

Esto evita reprocesar `PurchaseRequested` duplicados.

---

# 8. Idempotencia

Si llega el mismo `PurchaseRequested` dos veces:

- Se verifica `event_id`.
- Si ya fue procesado, no se vuelve a comprar.
- No se vuelve a emitir evento final.

---

# 9. No Existe Estado Intermedio Público

Nunca se publica:

- Compra parcial
- Intento fallido
- Compra en progreso

Solo existe:

- Éxito final
- Fallo final

Esto mantiene el sistema limpio y determinista.

---
