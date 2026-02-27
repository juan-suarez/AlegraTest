# LocalStack Configuration

Este directorio contiene los archivos necesarios para ejecutar un entorno local que simula AWS SNS y SQS.

## 📝 Estructura

- **init-aws.sh**: Script que se ejecuta automáticamente al iniciar LocalStack y configura:
  - 8 Topics SNS (un topic por tipo de evento)
  - 4 Colas SQS (una por microservicio)
  - Suscripciones entre Topics y Colas

## 🏗️ Topics SNS Creados

| Topic | Descripción | Publicador |
|-------|-------------|-----------|
| OrderCreated | Nueva orden creada | order-service |
| IngredientsRequired | Ingredientes requeridos | kitchen-service |
| IngredientsReserved | Ingredientes reservados | inventory-service |
| PurchaseRequested | Compra solicitada | inventory-service |
| PurchaseCompleted | Compra completada | purchasing-service |
| PurchaseFailed | Compra falló | purchasing-service |
| IngredientsPurchaseFailed | Fallo al conseguir ingredientes | inventory-service |
| OrderCompleted | Orden completada | kitchen-service |

## 📬 Colas SQS Creadas

| Cola | Servicio | Eventos que recibe |
|------|----------|-------------------|
| order-service-queue | Order Service | OrderCreated, IngredientsReserved, PurchaseFailed, IngredientsPurchaseFailed, OrderCompleted |
| kitchen-service-queue | Kitchen Service | OrderCreated, IngredientsReserved |
| inventory-service-queue | Inventory Service | IngredientsRequired, PurchaseCompleted, PurchaseFailed |
| purchasing-service-queue | Purchasing Service | PurchaseRequested |

## 🔌 Suscripciones (SNS → SQS)

El script configura automáticamente las suscripciones para que los eventos se ruteen correctamente:

```
OrderCreated → [order-service-queue, kitchen-service-queue]
IngredientsRequired → [inventory-service-queue]
IngredientsReserved → [order-service-queue, kitchen-service-queue]
PurchaseRequested → [purchasing-service-queue]
PurchaseCompleted → [inventory-service-queue]
PurchaseFailed → [inventory-service-queue, order-service-queue]
IngredientsPurchaseFailed → [order-service-queue]
OrderCompleted → [order-service-queue]
```

## 🚀 Cómo Funciona

1. **Al hacer `docker-compose up`:**
   - Se inicia el contenedor de LocalStack
   - Se ejecuta automáticamente `init-aws.sh`
   - Se crean todos los topics y colas
   - Se configuran todas las suscripciones

2. **Los servicios se conectan a LocalStack:**
   - Vía variables de entorno: `AWS_ENDPOINT=http://localhost:4566`
   - Usan AWS SDK para publicar/consumir eventos

## 🧪 Pruebas Manuales

### Listar Topics
```bash
awslocal sns list-topics --endpoint-url http://localhost:4566
```

### Listar Colas
```bash
awslocal sqs list-queues --endpoint-url http://localhost:4566
```

### Publicar evento de prueba
```bash
awslocal sns publish \
  --topic-arn arn:aws:sns:us-east-1:000000000000:OrderCreated \
  --message '{"orderId":"123","totalDishes":3}' \
  --endpoint-url http://localhost:4566
```

### Recibir mensajes de una cola
```bash
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/order-service-queue \
  --endpoint-url http://localhost:4566
```

## 📊 Variables de Entorno Necesarias

En `.env` o variables del sistema:

```env
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
POLLING_INTERVAL_MS=10000
```

## ⚠️ Notas Importantes

- LocalStack usa endpoint `http://localhost:4566` (dentro de Docker es `http://localstack:4566`)
- Los credenciales son ficticios (`test/test`)
- Los datos se pierden al detener el contenedor (a menos que uses volúmenes persistentes)
- para mac usuarios, quizás necesiten cambiar `/var/run/docker.sock` a la ruta correcta

## 🔧 Troubleshooting

### ¿LocalStack no inicia?
```bash
docker-compose logs localstack
```

### ¿Init script no se ejecuta?
- Verifica que el archivo tenga permisos de ejecución
- Revisa que el PATH sea correcto en docker-compose.yml

### ¿No se crea la suscripción?
- Verifica que el topic y cola existan primero
- Revisa los logs: `docker-compose logs localstack`
