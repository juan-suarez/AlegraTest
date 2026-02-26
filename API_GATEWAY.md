# API Gateway Setup

## Overview

El **API Gateway** expone el `order-service` HTTP mediante AWS API Gateway en LocalStack.

### Flujo

```
Cliente
  ↓
API Gateway (http://localhost:4566/restapis/{api-id}/prod/orders)
  ↓ (HTTP proxy)
Order-Service (http://order-service:3001/orders)
  ↓
OrderController → CreateOrderUseCase
```

## Configuración Automática

Cuando levantas el stack con `docker-compose up`, el script `infraestructure/localstack/init-aws.sh` automáticamente:

1. ✅ Crea una **REST API** llamada `restaurant-api`
2. ✅ Crea el recurso `/orders`
3. ✅ Crea un método `POST`
4. ✅ Configura integración HTTP hacia `http://order-service:3001/orders`
5. ✅ Despliega la API en stage `prod`

## Uso

### Opción 1: Llamar directamente al Order-Service (desarrollo)

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "totalDishes": 2
  }'
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "totalDishes": 2,
    "timestamp": "2026-02-25T20:03:59.266Z"
  }
}
```

---

### Opción 2: Llamar a través de API Gateway

Primero, obtén el **API ID**:

```bash
# Listar APIs
aws apigateway get-rest-apis \
  --endpoint-url http://localhost:4566 \
  --output table

# O extraer directo (si solo existe una)
API_ID=$(aws apigateway get-rest-apis \
  --endpoint-url http://localhost:4566 \
  --query 'items[0].id' \
  --output text)

echo "API ID: $API_ID"
```

Luego, hacer el request al API Gateway:

```bash
API_ID="restaurant-api"  # O el ID real obtenido arriba

curl -X POST http://localhost:4566/restapis/$API_ID/prod/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "totalDishes": 2
  }'
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "totalDishes": 2,
    "timestamp": "2026-02-25T20:03:59.266Z"
  }
}
```

---

## Validación de Errores

### Campo orderId no es UUID válido

```bash
curl -X POST http://localhost:4566/restapis/$API_ID/prod/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "not-a-uuid",
    "totalDishes": 2
  }'
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "details": [
    "Field \"orderId\" must be a valid UUID"
  ]
}
```

### Falta totalDishes

```bash
curl -X POST http://localhost:4566/restapis/$API_ID/prod/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "details": [
    "Field \"totalDishes\" is required"
  ]
}
```

---

## Debugging

### Verificar que API Gateway está corriendo

```bash
aws apigateway get-rest-apis \
  --endpoint-url http://localhost:4566
```

### Ver detalles de la API

```bash
API_ID="restaurant-api"
aws apigateway get-rest-api \
  --rest-api-id $API_ID \
  --endpoint-url http://localhost:4566
```

### Ver recursos

```bash
API_ID="restaurant-api"
aws apigateway get-resources \
  --rest-api-id $API_ID \
  --endpoint-url http://localhost:4566
```

---

## Arquitectura en Producción

En AWS real, el stack sería:

```
CloudFront (CDN)
  ↓
API Gateway (con autenticación, rate limiting, etc.)
  ↓
ALB (Application Load Balancer)
  ↓
ECS Cluster con Order-Service
```

Para esta prueba técnica, LocalStack simula API Gateway localmente.
