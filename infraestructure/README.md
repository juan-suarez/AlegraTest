# 🍽️ Restaurant Event-Driven System - Infrastructure

## 📁 Structure

This directory contains the complete infrastructure for the restaurant event-driven system, organized into **local development** and **AWS production** environments:

```
infraestructure/
├── local/              # Local development with Docker Compose
│   ├── e2e-tests/      # End-to-end automated tests
│   ├── localstack/     # AWS emulation (SNS/SQS)
│   ├── postgres/       # PostgreSQL initialization scripts
│   └── scripts/        # Helper scripts for local services
│
├── cdk/                # AWS Cloud Development Kit (Production)
│   └── (To be created)
│
└── README.md           # This file
```

---

## 🏠 Local Development

For **local development**, all infrastructure runs via Docker Compose using:
- **LocalStack**: AWS services emulation (SNS/SQS)
- **PostgreSQL**: Single instance with 4 databases
- **4 Microservices**: Running as Docker containers

See [local/README.md](local/README.md) for detailed local development documentation.

---

## 📋 Rápido Inicio

### **Opción 1: Ejecutar TODO con Docker Compose**

```bash
# Levantar infraestructura + servicios + E2E test
npm run dev:test

# Solo levantar infraestructura + servicios (sin test)
npm run dev:services
```

### **Opción 2: Levantar solo infraestructura y servicios manualmente**

```bash
# Levantar PostgreSQL y LocalStack
docker-compose up postgres localstack

# En otra terminal, levantar los servicios
npm run dev:services

# O uno por uno
cd services/order-service && npm start
cd services/kitchen-service && npm start
cd services/inventory-service && npm start
cd services/purchasing-service && npm start
```

### **Opción 3: Ejecutar E2E test después de levantar servicios**

```bash
# Asumiendo que ya tienes servicios corriendo
npm run test:e2e
```

---

## 🔍 Verificar Estado

```bash
# Ver estado de containers
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f order-service
docker-compose logs -f kitchen-service
docker-compose logs -f inventory-service
docker-compose logs -f purchasing-service
docker-compose logs -f e2e-tester

# Detener todo
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v
```

---

## 📊 Estructura del E2E Test

El test E2E (`e2e-tests/test-e2e.ts`) ejecuta el siguiente flujo:

```
1. Verificar conexiones a todas las BDs
2. Limpiar eventos previos
3. Crear una orden (OrderCreated event)
4. Esperar 15s para propagación de eventos
5. Verificar eventos en todas las BDs
6. Verificar estado final de la orden
7. Reportar resultados
```

**Flujo de eventos esperado:**
```
Order Service:    OrderCreated
                      ↓
Kitchen Service:  OrderCreated → OrderItemsSelected + IngredientsRequired
                                      ↓
Inventory Service: IngredientsRequired → PurchaseRequested + IngredientsReserved
                                           ↓
Purchasing Service: PurchaseRequested → PurchaseCompleted
                                           ↓
Inventory Service: PurchaseCompleted → Update Stock
```

---

## 🐳 Docker Compose Profiles

El `docker-compose.yml` usa profiles para ejecutar diferentes escenarios:

```bash
# Levanta: postgres, localstack, 4 servicios (sin E2E test)
docker-compose up

# Levanta: postgres, localstack, 4 servicios, E2E test
docker-compose up --profile e2e

# Solo levanta un servicio específico
docker-compose up order-service

# Levanta solo infraestructura
docker-compose up postgres localstack
```

---

## 🔐 Variables de Entorno

Se configuran automáticamente en `docker-compose.yml`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/{service}_db

# AWS/LocalStack
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localstack:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# SQS
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/000000000000/{service}-service-queue

# Polling
POLLING_INTERVAL_MS=1000
```

---

## 🛠️ Scripts Disponibles

### `scripts/start-services.sh`
Levanta todos los servicios en paralelo con npm install automático.

```bash
bash infraestructure/scripts/start-services.sh
```

### `scripts/wait-for-services.sh`
Espera a que los servicios estén listos (health checks).

```bash
bash infraestructure/scripts/wait-for-services.sh
```

---

## 📝 Logs y Debugging

### Ver logs de E2E test
```bash
docker-compose logs e2e-tester
```

### Ver eventos en base de datos
```bash
docker exec restaurant-postgres psql -U postgres

# En psql:
SELECT * FROM order_db.events ORDER BY created_at DESC;
SELECT * FROM kitchen_db.events ORDER BY created_at DESC;
SELECT * FROM inventory_db.events ORDER BY created_at DESC;
SELECT * FROM purchasing_db.events ORDER BY created_at DESC;
```

### Ver tópicos SNS y colas SQS
```bash
# SNS Topics
docker exec restaurant-localstack awslocal sns list-topics

# SQS Queues
docker exec restaurant-localstack awslocal sqs list-queues

# Subscriptions
docker exec restaurant-localstack awslocal sns list-subscriptions
```

---

## 🐛 Troubleshooting

### **Problema: "port 5432 already in use"**
```bash
# Matar proceso en puerto 5432
lsof -ti:5432 | xargs kill -9

# O usar puerto diferente
docker-compose up -p "5433:5432"
```

### **Problema: "LocalStack no inicializa topics"**
```bash
# Revisar logs
docker logs restaurant-localstack

# Reiniciar
docker-compose restart localstack
```

### **Problema: "Bases de datos no se crean"**
```bash
# Revisar script de inicialización
cat infraestructure/postgres/init-databases.sh

# Ejecutar manualmente si es necesario
docker exec restaurant-postgres bash /docker-entrypoint-initdb.d/init-databases.sh
```

### **Problema: "Servicios no se comunican"**
```bash
# Verificar red
docker network ls
docker network inspect restaurant-network

# Test conectividad entre containers
docker exec restaurant-order-service ping -c 1 restaurant-kitchen-service
```

---

## 📦 Estructura de Archivos

```
infraestructure/
├── postgres/
│   ├── init-databases.sh      # Script de inicialización de BDs
│   ├── verify-databases.sh    # Script de verificación
│   └── README.md
├── localstack/
│   ├── init-aws.sh            # Script para crear topics/queues
│   ├── verify.sh              # Script de verificación
│   └── README.md
├── e2e-tests/
│   ├── test-e2e.ts            # Test E2E principal
│   ├── Dockerfile             # Imagen Docker para E2E
│   └── README.md
├── scripts/
│   ├── start-services.sh      # Levanta todos los servicios
│   ├── wait-for-services.sh   # Espera a que servicios estén listos
│   └── README.md
└── README.md                  # Este archivo
```

---

## 🚀 Próximos Pasos

1. **Crear API Controller** en order-service para recibir órdenes HTTP
2. **Implementar API Gateway** (API Gateway o Kong)
3. **Agregar autenticación** (JWT, OAuth2)
4. **Implementar circuit breakers** y retry logic mejorados
5. **Agregar observabilidad** (Prometheus, Grafana, ELK)
6. **Tests unitarios** en cada servicio
7. **Tests de integración** entre servicios

---

## 📚 Documentación Relacionada

- [README.md]('../README.md') - Descripción general del proyecto
- [PASO1_LOCALSTACK.md]('../PASO1_LOCALSTACK.md') - Setup LocalStack
- [PASO2_EVENTBUS.md]('../PASO2_EVENTBUS.md') - Setup EventBus

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs: `docker-compose logs`
2. Verifica health checks: `docker-compose ps`
3. Ejecuta scripts de verificación en cada carpeta
4. Limpia y reinicia: `docker-compose down -v && docker-compose up`
- Incluido en Free Tier con alto margen

---

## 2.3 Amazon SQS

Cada microservicio tiene su propia cola.

Características:
- Suscripción a tópicos SNS
- Event Source Mapping con Lambda
- Retries automáticos
- Soporte para DLQ (Dead Letter Queue)

Free Tier incluye:
- 1 millón de requests mensuales

---

## 2.4 Amazon RDS (PostgreSQL)

Se utiliza PostgreSQL para:

- orders-service
- inventory-service

Características:
- Base relacional por servicio
- Esquemas independientes
- Conexión privada

Free Tier:
- 750 horas mensuales de db.t3.micro
- 20 GB almacenamiento

Se utiliza una instancia única con múltiples bases separadas por servicio para mantenerse dentro del Free Tier.

---

## 2.5 IAM

Cada servicio tiene:

- Rol dedicado
- Permisos mínimos necesarios
- Acceso únicamente a:
  - Su cola SQS
  - Publicación en SNS
  - Su base de datos

Principio aplicado: Least Privilege.

---

# 3. Arquitectura de Alto Nivel

```
                SNS (Event Bus)
                       |
        ---------------------------------
        |               |               |
     SQS Orders     SQS Inventory   SQS Kitchen
        |               |               |
     Lambda          Lambda          Lambda
        |               |
    RDS Orders     RDS Inventory
```

purchasing-service también:

- Escucha su cola SQS
- Publica eventos finales
- No mantiene base de datos propia

---

# 4. Event Source Mapping

Cada Lambda está conectada a su cola mediante:

Event Source Mapping

Esto permite que:

- SQS entregue mensajes automáticamente a la Lambda
- Lambda procese mensajes en batches
- Se manejen retries automáticos
- Se envíen fallos a DLQ

No es necesario polling manual.

---

# 5. Manejo de Fallos

Cada cola SQS tendrá configurado:

- MaxReceiveCount
- Dead Letter Queue (DLQ)

Si un mensaje falla múltiples veces:

→ Se mueve automáticamente a la DLQ  
→ No bloquea la cola principal  
→ Permite inspección manual  

Esto es clave para resiliencia en producción.

---

# 6. Docker en Lambda

Cada servicio:

- Se construye como imagen Docker
- Se publica en ECR
- Se despliega como Lambda containerizada

Ventajas:

- Entorno consistente
- Misma imagen para local y cloud
- Control total de dependencias
- Demuestra dominio real de arquitectura moderna

---

# 7. Infraestructura como Código (AWS CDK)

Se utilizará:

- AWS CDK en TypeScript

CDK permite:

- Definir Lambdas
- Crear tópicos SNS
- Crear colas SQS
- Configurar suscripciones
- Crear RDS
- Configurar roles IAM
- Definir variables de entorno
- Configurar DLQs

Todo mediante código versionado en Git.

---

# 8. Variables de Entorno

Cada Lambda recibirá:

- DATABASE_URL
- SNS_TOPIC_ARN
- SERVICE_NAME
- MAX_RETRIES (para purchasing)

Nunca se almacenarán secretos en código.

---

# 9. Seguridad

- No hay acceso público directo a bases de datos
- Lambdas acceden mediante security groups
- IAM restringido por recurso
- Sin credenciales hardcodeadas

---

# 10. Free Tier Considerations

Para mantenerse dentro de la capa gratuita:

- Una sola instancia RDS compartida
- Lambdas con memoria controlada (ej: 512MB)
- Timeout razonable (ej: 10s)
- Bajo volumen de logs en CloudWatch
- Uso controlado de almacenamiento

Este diseño está optimizado para no generar costos inesperados.

---

# 11. Despliegue

Comandos típicos:

```
cd infrastructure
npm install
cdk bootstrap
cdk deploy
```

CDK:

- Construye imágenes Docker
- Publica en ECR
- Crea toda la infraestructura
- Configura conexiones entre servicios

---

# 12. Infrastructure Organization

## Local Development (`local/`)
For local development and testing:
- **LocalStack**: Simulates SNS/SQS
- **Docker Compose**: Runs all services
- **PostgreSQL**: Single local instance

See [local/README.md](local/README.md) for complete local setup.

## AWS Production (`cdk/`)
For production deployment:
- **AWS CDK**: Infrastructure as Code
- **Lambda**: Serverless compute for all services
- **RDS PostgreSQL**: Managed database
- **SNS/SQS**: Real AWS event bus
- **API Gateway**: HTTP endpoint for Order Service
- **100% Free Tier**: Optimized for AWS Free Tier

The `cdk/` directory will contain all production infrastructure code.

---

# 13. Filosofía del Diseño

- Event-driven puro
- Serverless-first
- Microservicios reales
- Separación estricta de responsabilidades
- Idempotencia en cada consumidor
- Resiliencia con DLQ
- Pensado para escalar horizontalmente

---

Este directorio representa la capa de infraestructura productiva del sistema.

Todo lo que existe en AWS está definido aquí.
Nada se crea manualmente.
Nada depende de configuración externa.

Infraestructura reproducible, versionada y auditable.