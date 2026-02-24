# PASO 2: EventBusLocal - Implementación Completada

## ✅ Archivos Creados

### 1. Infrastructure de Mensajería
```
order-service/src/infrastructure/messaging/
├── types.ts           ← Interfaces (EventEnvelope, EventBusConfig)
├── EventBusLocal.ts   ← Cliente SNS/SQS unificado
├── EventRouter.ts     ← Router de eventos a handlers
└── index.ts           ← Exports limpios
```

### 2. Configuración
- ✅ `.env.example` actualizado con variables LocalStack
- ✅ `index.ts` actualizado para iniciar consumer

## 🔧 Instalación de Dependencias

```bash
cd services/order-service

# Instalar AWS SDK v3
npm install @aws-sdk/client-sns @aws-sdk/client-sqs

# Instalar dotenv si no está
npm install dotenv

# Verificar dependencias
npm list @aws-sdk/client-sns @aws-sdk/client-sqs
```

## 📝 Configurar .env

```bash
cd services/order-service
cp .env.example .env

# Editar .env si es necesario (las configuraciones por defecto deberían funcionar)
```

## 🚀 Cómo Probar

### 1. Levantar LocalStack
```bash
# Desde la raíz del proyecto
docker-compose up -d

# Verificar que funciona
docker-compose logs localstack | grep "Ready"
```

### 2. Iniciar order-service
```bash
cd services/order-service

# Compilar TypeScript
npm run build

# Iniciar servicio
npm run dev
```

Deberías ver:
```
🚀 Inicializando order-service...
✅ Conexión a BD establecida
📊 Ejecutando migraciones...
✅ Base de datos inicializada correctamente
📋 Tablas creadas:
   - orders
   - order_items
   - events_processed

🔌 Inicializando Event Bus...
✅ Event Bus inicializado
📬 Escuchando cola: http://localhost:4566/000000000000/order-service-queue
🚀 Starting SQS consumer for queue: http://localhost:4566/...
⏱️  Polling interval: 10000ms
✨ order-service está listo para recibir eventos
```

### 3. Publicar un evento de prueba desde otro terminal

```bash
# Publicar un evento OrderCompleted
awslocal sns publish \
  --topic-arn arn:aws:sns:us-east-1:000000000000:OrderCompleted \
  --message '{
    "eventId": "test-123",
    "eventType": "OrderCompleted",
    "occurredAt": "2026-02-24T10:00:00Z",
    "source": "kitchen-service",
    "data": {
      "orderId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }' \
  --endpoint-url http://localhost:4566
```

### 4. Verificar en logs de order-service

Deberías ver:
```
📬 Received 1 message(s)
📨 Processing event: OrderCompleted (test-123)
🔀 Routing event: OrderCompleted
✅ Successfully processed: OrderCompleted
```

## 🎯 Características Implementadas

✅ **EventBusLocal**
- Publicación a SNS topics
- Consumo desde SQS con long polling
- Polling interval configurable (default 10 segundos)
- Manejo automático de mensajes SNS wrapped
- Delete automático después de procesar
- Graceful shutdown

✅ **EventRouter**
- Ruteo automático por eventType
- Integración con OrderService
- Manejo de errores con logging

✅ **Configuración Flexible**
- Variables de entorno
- Endpoint configurable (LocalStack vs. AWS)
- Credenciales separadas

## 📊 Arquitectura Lograda

```
LocalStack (Docker)
    ├── SNS Topics
    │   ├── OrderCreated
    │   ├── OrderCompleted
    │   └── ...
    └── SQS Queue
        └── order-service-queue
             ↓
        EventBusLocal (polling cada 10s)
             ↓
        EventRouter
             ↓
        OrderService handlers
             ↓
        Database (Postgres)
```

## ⚠️ Notas Importantes

1. **Long Polling**: WaitTimeSeconds=20 reduce llamadas innecesarias
2. **Batch Processing**: Recibe hasta 10 mensajes por poll
3. **Error Handling**: Si falla, mensaje vuelve a cola (visibility timeout)
4. **Graceful Shutdown**: SIGINT/SIGTERM detienen el consumer limpiamente

## 🐛 Troubleshooting

### order-service no inicia
```bash
# Verificar que .env existe
cat services/order-service/.env

# Verificar Postgres está corriendo
docker ps | grep postgres
```

### No recibe mensajes
```bash
# Verificar la cola tiene mensajes
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/order-service-queue \
  --endpoint-url http://localhost:4566

# Verificar logs del servicio
# Debería mostrar "Received 0 message(s)" cada 10 segundos
```

### Error de conexión AWS
```bash
# Verificar LocalStack está corriendo
docker-compose logs localstack | tail -20

# Verificar endpoint en .env
grep AWS_ENDPOINT services/order-service/.env
```

## 🎯 Próximo Paso

**PASO 3: Implementar publicación de eventos desde order-service**

Cuando order-service crea una orden, debe publicar `OrderCreated` a SNS.

¿Continuamos con PASO 3?
