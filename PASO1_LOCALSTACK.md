# PASO 1: LocalStack + Docker Compose - Verificación

## ✅ Lo que hicimos

1. **docker-compose.yml** - Agregado servicio LocalStack
   - Puerto: 4566
   - Servicios: SNS + SQS
   - Healthcheck incluido
   - Monta script init automático

2. **infraestructure/localstack/init-aws.sh** - Script de inicialización
   - Crea 8 Topics SNS
   - Crea 4 Colas SQS
   - Configura suscripciones automáticas

3. **infraestructure/localstack/README.md** - Documentación
   - Mapeos de topics/colas
   - Ejemplos de uso
   - Troubleshooting

4. **.env.example** - Variables de entorno
   - AWS_ENDPOINT=http://localhost:4566
   - POLLING_INTERVAL_MS=10000
   - Credenciales ficticias

## 🚀 Cómo Probar

### 1. Copiar .env.example a .env (en raíz)
```bash
cp .env.example .env
```

### 2. Levantar servicios
```bash
docker-compose up -d
```

### 3. Verificar que LocalStack está listo
```bash
docker-compose logs localstack
```

Deberías ver:
```
ready to handle aws requests
Initialization script executed
```

### 4. Verificar topics y colas (opcionalmente)
```bash
# Topics
awslocal sns list-topics --endpoint-url http://localhost:4566

# Colas
awslocal sqs list-queues --endpoint-url http://localhost:4566
```

### 5. Prueba manual: Publicar un evento
```bash
awslocal sns publish \
  --topic-arn arn:aws:sns:us-east-1:000000000000:OrderCreated \
  --message '{"orderId":"test-123","totalDishes":3}' \
  --endpoint-url http://localhost:4566
```

### 6. Verificar que llegó a la cola
```bash
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/order-service-queue \
  --endpoint-url http://localhost:4566
```

## 📊 Estructura Completada

```
AlegraTest/
├── docker-compose.yml                    ← Actualizado con LocalStack
├── .env.example                          ← Nuevo
├── infraestructure/
│   └── localstack/
│       ├── init-aws.sh                   ← Script de inicialización
│       ├── README.md                     ← Documentación
│       └── verify.sh                     ← Script de verificación
└── services/
    ├── order-service/
    ├── kitchen-service/
    ├── inventory-service/
    └── purchasing-service/
```

## 🎯 Próximo Paso

**PASO 2: Crear `EventBusLocal.ts` en cada servicio**

Esto creará la clase que:
- Publica eventos a SNS (cuando el servicio quiere comunicar algo)
- Consume eventos de SQS (para recibir mensajes de otros servicios)

¿Continuamos con PASO 2?

## ⚠️ Troubleshooting

### LocalStack no inicia
```bash
docker-compose logs localstack
# Revisa los errores
```

### Puerto 4566 ya está en uso
```bash
# Cambia el puerto en docker-compose.yml o detén otro contenedor
docker ps
docker stop <container_id>
```

### Init script no se ejecuta
- Verifica que el path sea correcto en docker-compose.yml
- Los permisos del archivo podrían ser un problema (aunque Docker lo maneja)

### ¿Necesitas limpiar todo?
```bash
docker-compose down -v
```
