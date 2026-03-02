# Kitchen Service

El `kitchen-service` es responsable de:

- Escuchar nuevas órdenes
- Seleccionar recetas aleatoriamente
- Calcular ingredientes necesarios
- Solicitar ingredientes al inventario
- Publicar la finalización de la orden

No mantiene estado de órdenes.  
No gestiona inventario.  
No persiste recetas en base de datos.  

Las recetas están definidas en código.

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

**Nota:** Este servicio es event-driven. Se ejecuta en background escuchando eventos SNS/SQS.

---

# 1. Responsabilidades

✔ Seleccionar recetas aleatorias  
✔ Calcular ingredientes agregados  
✔ Publicar `OrderItemsSelected`  
✔ Publicar `IngredientsRequired`  
✔ Publicar `OrderCompleted`  

No:

✘ Cambia estados directamente en otros servicios  
✘ Maneja stock  
✘ Persiste órdenes  
✘ Tiene acceso a base de datos de otros servicios  

---

# 2. Modelo de Datos

Este servicio solo mantiene la tabla de idempotencia definida en el README.md de services:

# 3. Recetas (Definidas en Código)

Las recetas están definidas como estructuras internas del servicio.

## Ingredientes disponibles

- tomato
- lemon
- potato
- rice
- ketchup
- lettuce
- onion
- cheese
- meat
- chicken

---

## 3.1 Receta 1 — Classic Burger

Ingredientes por plato:

- meat: 1
- cheese: 1
- tomato: 1
- lettuce: 1
- onion: 1
- ketchup: 1

---

## 3.2 Receta 2 — Chicken Rice Bowl

Ingredientes por plato:

- chicken: 1
- rice: 2
- onion: 1
- tomato: 1
- lemon: 1

---

## 3.3 Receta 3 — Meat & Potato Plate

Ingredientes por plato:

- meat: 1
- potato: 2
- onion: 1
- ketchup: 1

---

## 3.4 Receta 4 — Veggie Rice

Ingredientes por plato:

- rice: 2
- tomato: 1
- lettuce: 1
- onion: 1
- lemon: 1

---

## 3.5 Receta 5 — Chicken Salad

Ingredientes por plato:

- chicken: 1
- lettuce: 2
- tomato: 1
- onion: 1
- lemon: 1

---

## 3.6 Receta 6 — Cheesy Potato Bowl

Ingredientes por plato:

- potato: 2
- cheese: 1
- onion: 1
- ketchup: 1

---

# 4. Flujo de Eventos

## 4.1 Cuando recibe `OrderCreated`

1. Lee `totalDishes`
2. Selecciona aleatoriamente una receta por cada plato
3. Agrupa recetas repetidas
4. Publica `OrderItemsSelected`
5. Calcula ingredientes agregados
6. Publica `IngredientsRequired`

---

## 4.2 Cuando recibe `IngredientsReserved`

1. Simula proceso de cocina
2. Publica `OrderCompleted`

---

## 4.3 Cuando recibe `IngredientsPurchaseFailed`

- No realiza ninguna acción adicional
- La orden será marcada como `FAILED` por `order-service`

---

# 5. Selección Aleatoria

La selección:

- Es uniforme entre las 6 recetas
- Puede repetir recetas dentro de la misma orden
- Ocurre completamente en memoria

---
