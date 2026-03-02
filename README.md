# 🍽️ Event-Driven Restaurant System

Sistema distribuido basado en microservicios y arquitectura orientada a eventos para automatizar:

- Creación de órdenes  
- Selección aleatoria de recetas  
- Gestión de inventario  
- Compra de ingredientes  
- Preparación y finalización de pedidos  

Diseñado para soportar alta concurrencia y múltiples instancias por servicio.

---

---

# 📁 Estructura del Proyecto

## Frontend

**Cliente web: Donde los usuarios crean órdenes**

Aplicación React + Vite tipo SPA que permite:
- Crear nuevas órdenes con cantidad de platos
- Visualizar estado en tiempo real
- Ver órdenes completadas o fallidas
- Explorar inventario de ingredientes disponibles
- Monitoreo de recetas seleccionadas

Tech: React TSX, Vite, HTTP client para APIs REST  
Puerto: 5173 (dev)

👉 [Ver documentación de Frontend](frontend/README.md)

---

## Infrastructure

**La base: Cómo se levanta el sistema**

### 🏠 Desarrollo Local (Docker Compose)
Entorno completo con orquestación de servicios.

Setup y configuración:
- Docker Compose orquesta 4 servicios + 1 base de datos
- LocalStack simula **SNS/SQS** (el bus de eventos)
- PostgreSQL con 4 bases de datos (una por servicio)
- E2E tests contra stack local completamente funcional
- Scripts automatizados para inicialización y verificación

👉 [infraestructure/local/README.md](infraestructure/local/README.md)

### ☁️ Producción AWS (CDK)
Infrastructure as Code: Todo definido, versionado, reproducible.

Despliegue en AWS:
- AWS CDK (TypeScript) define toda la infraestructura
- CloudFormation provisiona recursos
- Lambda functions para cada microservicio
- RDS managed PostgreSQL (alta disponibilidad)
- SNS/SQS productos reales (no simulados)
- API Gateway expone los endpoints
- IAM roles y políticas de seguridad

👉 [infraestructure/cdk/README.md](infraestructure/cdk/README.md)

---

## Services

**El corazón: 4 microservicios independientes que se comunican por eventos**

Documentación arquitectónica completa:
- **Patrón Event-Driven** basado en SNS/SQS con 8 eventos definidos
- **Arquitectura por capas** Controllers → Use Cases → Repositories
- **Metodología TDD** desde planificación de escenarios hasta cobertura 100%
- **Comunicación desacoplada** entre servicios (sin HTTP directo)
- **Dos modelos de ejecución**:
  - Local: Node.js HTTP Server nativo
  - Producción: AWS Lambda + API Gateway
- **Garantías ACID** con reservas fuertes y table-level locking
- **Idempotencia** implementada con tabla `events_processed`
- **Reutilización de código** Controllers funcionan en ambos entornos

👉 [Ver documentación completa de Servicios](services/README.md)

### order-service (Puerto 3001)
**Punto de entrada del sistema**

API REST que:
- Recibe nuevas órdenes (POST /orders)
- Persiste estado completo en BD
- Publica evento `OrderCreated` al bus
- Escucha eventos de cocina, inventario y compras
- Expone catálogo de órdenes (GET /orders)

Estados: CREATED → SELECTING_RECIPES → WAITING_INGREDIENTS → COOKING → COMPLETED|FAILED

👉 [services/order-service/README.md](services/order-service/README.md)

### kitchen-service
**La cocina: Selecciona recetas y prepara**

Servicio event-driven que:
- Escucha evento `OrderCreated`
- Selecciona recetas aleatoriamente según cantidad de platos
- Calcula ingredientes agregados necesarios
- Publica `IngredientsRequired` al inventario
- Espera confirmación de ingredientes
- Publica `OrderCompleted` cuando está lista

No persiste órdenes, no es la fuente de verdad, **solo ejecuta**.

👉 [services/kitchen-service/README.md](services/kitchen-service/README.md)

### inventory-service (Puerto 3002)
**Guardián del stock: Reservas fuertes y coordinación de compras**

Servicio crítico que:
- **Es la única fuente de verdad** del stock de ingredientes
- Implementa **reservas fuertes** con locking a nivel de fila (FOR UPDATE)
- Detecta faltantes e **inicia compras en batches de 5 unidades**
- Publica eventos `IngredientsReserved` o `IngredientPurchaseRequired`
- Recibe resultados de compra y actualiza stock
- Garantiza **consistencia bajo concurrencia** (múltiples órdenes simultáneas)

Responsable de que dos órdenes no compitan por el mismo ingrediente.

👉 [services/inventory-service/README.md](services/inventory-service/README.md)

### purchasing-service (Puerto 3003)
**El comprador: Interactúa con proveedor externo**

Servicio que:
- Recibe solicitudes de compra por ingrediente
- Llama a **proveedor externo** (cantidad variable, impredecible)
- **Reintenta compras** si la cantidad es insuficiente
- Emite un único evento final: `PurchaseCompleted` o `PurchaseFailed`
- Tolerancia a fallos externos con reintentos exponenciales
- **Idempotente** ante reentregas de eventos

Maneja la variabilidad del proveedor (a veces vende 3 unidades, a veces 7).

👉 [services/purchasing-service/README.md](services/purchasing-service/README.md)

---

# 🚀 Inicio Rápido

```bash
# Levantar todo (BD, LocalStack, todos los servicios)
docker-compose up -d

# Ejecutar un servicio individual
cd services/order-service
npm install && npm start

# Ver logs
docker-compose logs -f order-service

# Detener todo
docker-compose down
```

Más detalles en cada servicio: [services/order-service/README.md](services/order-service/README.md)

