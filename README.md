# 🍽️ Event-Driven Restaurant System

Sistema distribuido basado en microservicios y arquitectura orientada a eventos para automatizar:

- Creación de órdenes  
- Selección aleatoria de recetas  
- Gestión de inventario  
- Compra de ingredientes  
- Preparación y finalización de pedidos  

Diseñado para soportar alta concurrencia y múltiples instancias por servicio.

---

# 🚀 Inicio Rápido

## Prerrequisitos

- Node.js 18+
- Docker y Docker Compose
- TypeScript (global o local)

## Configuración Inicial

```bash
# Clonar el repositorio
git clone <repository-url>
cd restaurant-system

# Levantar la base de datos global
docker-compose up -d

# Instalar dependencias de un servicio
cd services/order-service
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con la configuración de BD
```

## Desarrollo de un Servicio

```bash
# Crear base de datos del servicio
./create-db.sh order_service

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar tests
npm test

# Ejecutar tests en modo watch
npm run test:watch
```

## Arquitectura de Desarrollo

- **TDD**: Tests primero, luego implementación
- **Testcontainers**: DB aisladas para tests
- **Event-driven**: Comunicación asíncrona
- **Repository Pattern**: Acceso a datos limpio

---

# 🏗️ Arquitectura General

## Microservicios

1. **Order Service**
2. **Kitchen Service**
3. **Inventory Service**
4. **Purchasing Service**

---

## Infraestructura

- **Event Bus:** Amazon SNS  
- **Queues por servicio:** Amazon SQS  
- **Compute:** AWS Lambda (contenedores Docker)
- **AWS Api Gateway** Api Gateway para conectar el servicio de ordenes con el frontend
- **Base de datos:** PostgreSQL (una por servicio)  
- **Infraestructura como código:** AWS CDK  
- **Observabilidad:** CloudWatch  

No existe comunicación síncrona entre microservicios.  
Toda interacción es mediante eventos.

---

# 🏛️ Patrón de Diseño Arquitectónico

Todos los microservicios siguen un **patrón de arquitectura limpia** estandarizado para mantener consistencia, mantenibilidad y escalabilidad.

## 📋 Principios Arquitectónicos

### 🎯 Separación de Responsabilidades
- **Queries SQL** separadas de la lógica de negocio
- **Acceso a datos** aislado de las reglas del dominio
- **Tests** independientes del código de producción

### 🔄 Arquitectura por Capas

```
┌─────────────────┐
│   Events        │ ← Entrada/Salida de eventos
├─────────────────┤
│   Services      │ ← Lógica de negocio
├─────────────────┤
│ Repositories    │ ← Acceso a datos
├─────────────────┤
│   Database      │ ← PostgreSQL
└─────────────────┘
```

## 🏗️ Patrones Implementados

### 1. **Patrón Repository**
- **Responsabilidad**: Abstraer operaciones de base de datos
- **Beneficio**: Lógica de BD separada, fácil testing y mocking
- **Implementación**: Una clase Repository por entidad principal
- **Ejemplo**: `OrderRepository`, `InventoryRepository`

### 2. **Patrón Service**
- **Responsabilidad**: Contener lógica de negocio y workflows
- **Beneficio**: Reglas del dominio centralizadas y reutilizables
- **Implementación**: Servicios que coordinan repositories y events
- **Ejemplo**: `OrderService`, `InventoryService`

### 3. **Arquitectura Basada en Eventos**
- **Responsabilidad**: Comunicación asíncrona entre servicios
- **Beneficio**: Desacoplamiento, escalabilidad, resiliencia
- **Implementación**: Handlers para eventos entrantes, publishers para salientes
- **Ejemplo**: `OrderCreated`, `IngredientsReserved`

### 4. **TDD (Test-Driven Development)**
- **Responsabilidad**: Desarrollo guiado por tests
- **Beneficio**: Código confiable, diseño emergente, documentación viva
- **Implementación**: Tests primero, luego implementación mínima
- **Herramientas**: Jest + Testcontainers para DB real

### 5. **Testcontainers para Testing**
- **Responsabilidad**: Proporcionar bases de datos aisladas
- **Beneficio**: Tests realistas sin dependencias externas
- **Implementación**: PostgreSQL temporal por suite de tests
- **Aislamiento**: Cada test suite tiene su propia BD

## 📁 Estructura Estándar por Microservicio

```
service-name/
├── src/
│   ├── db/
│   │   ├── connection.ts      # Conexión PostgreSQL
│   │   ├── schema.sql         # Schema inicial
│   │   └── queries/           # SQL organizado
│   ├── repositories/          # Patrón Repository
│   ├── services/              # Lógica de negocio
│   ├── events/                # Handlers & Publishers
│   └── __tests__/             # Tests TDD
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 🎯 Beneficios del Patrón

### Para Desarrolladores
- ✅ **Consistencia**: Todos los servicios siguen el mismo patrón
- ✅ **Productividad**: Estructura familiar acelera desarrollo
- ✅ **Mantenibilidad**: Código organizado y fácil de entender
- ✅ **Testing**: Alta cobertura con tests automatizados

### Para el Sistema
- ✅ **Escalabilidad**: Servicios independientes y desacoplados
- ✅ **Resiliencia**: Fallos aislados, recuperación automática
- ✅ **Observabilidad**: Logs y métricas consistentes
- ✅ **Evolución**: Fácil agregar nuevas funcionalidades

### Para el Negocio
- ✅ **Confiabilidad**: Tests exhaustivos reducen bugs
- ✅ **Velocidad**: Desarrollo TDD acelera delivery
- ✅ **Calidad**: Arquitectura probada y madura

---

# 📦 Responsabilidades por Servicio

---

## 1️⃣ Order Service

Responsable de:

- Crear órdenes  
- Persistir estado  
- Persistir composición final de la orden  
- Reaccionar a eventos de éxito o fallo  
- Exponer API REST al frontend  

### Estados de la Orden

```text
CREATED
RECIPES_SELECTED
INGREDIENTS_PENDING
COOKING
COMPLETED
FAILED
```

---

## 2️⃣ Kitchen Service

Responsable de:

- Seleccionar recetas aleatoriamente por cada plato  
- Calcular ingredientes agregados  
- Persistir selección internamente  
- Emitir:
  - `RecipesSelected`
  - `IngredientsRequired`
- Cocinar cuando recibe confirmación de ingredientes  
- Emitir `OrderCooked`  

No conoce inventario.  
No conoce compras.  
No escribe en la base de datos de Order.

---

## 3️⃣ Inventory Service

Responsable de:

- Gestionar stock  
- Realizar descuento atómico  
- Crear reservas  
- Determinar faltantes  
- Emitir:
  - `IngredientsReserved`
  - `IngredientsMissing`
- Liberar reservas si la compra falla  

Implementa control de concurrencia por fila.

---

## 4️⃣ Purchasing Service

Responsable de:

- Comprar ingredientes faltantes en la plaza  
- Emitir:
  - `IngredientsPurchased`
  - `IngredientsPurchaseFailed`

No gestiona stock.

---

# 🔁 Saga Coreografiada

No existe orquestador central.

Flujo principal:

1. `OrderCreated`  
2. `RecipesSelected`  
3. `IngredientsRequired`  
4. `IngredientsReserved` **o** `IngredientsMissing`  
5. `IngredientsPurchased` **o** `IngredientsPurchaseFailed`  
6. `OrderCooked`  
7. `OrderCompleted`  

---

# 🔐 Control de Concurrencia

Se utiliza un sistema de reservas fuertes en el servicio de inventory, agregando una nueva tabla llamada `reservations`

## Objetivo

Evitar race conditions cuando múltiples órdenes intentan descontar el mismo ingrediente simultáneamente.

## Problema que previene

- Dos órdenes leen el mismo stock  
- Ambas descuentan  
- El inventario queda inconsistente  

La fila se bloquea solo durante una transacción corta para:

1. Leer stock  
2. Decidir  
3. Descontar  
4. Crear reserva  

El lock es granular por ingrediente.

---

# 📦 Lógica de Reserva

## Caso 1 — Stock suficiente

- Se descuenta la cantidad requerida  
- Se crea reserva  
- Se emite `IngredientsReserved`  

---

## Caso 2 — Stock parcial

Ejemplo: necesita 5, hay 3

- Se bloquea fila  
- Se descuenta 3 -> (esto desbloqueando el ingrediente en db)
- Se crea reserva por 3  
- Se emite `IngredientsMissing` por 2  

Si compra falla:

- Inventory libera la reserva  
- Se restaura el stock  

---

## Caso 3 — Sin stock

- No se descuenta  
- Se emite `IngredientsMissing`  

---

# 🔁 Reintentos y DLQ

- SQS con reintentos automáticos  
- Backoff exponencial  
- Dead Letter Queue por servicio  
- Eventos fallidos no bloquean el sistema  

---

# 🌐 Comunicación con Frontend

El frontend se comunica únicamente con:

- Order Service (REST)

El estado de la orden se consulta vía API.

La actualización ocurre cuando Order procesa:

- `OrderCompleted`  
- `IngredientsPurchaseFailed`  

---

# 🎯 Decisiones Arquitectónicas Finales

- Arquitectura 100% orientada a eventos  
- Saga coreografiada  
- Idempotencia por servicio  
- Control de concurrencia por fila para evitar race conditions en recursos compartidos  
- Bases de datos aisladas por dominio  
- Consistencia eventual  
- Infraestructura en AWS con Lambda + SNS + SQS + PostgreSQL  
- Microservicios desplegados como contenedores Docker  

---

# 🤖 Bonus Challenge: AI Chatbot

## ⭐ Asistente Virtual Inteligente

Este proyecto incluye un **chatbot con IA** integrado en el frontend que permite gestionar órdenes mediante lenguaje natural.

### 🎯 Características

- 🗣️ **Conversación Natural**: "Quiero 10 platos", "Dame 5 órdenes"
- 📊 **Consultas Inteligentes**: "¿Cuántas órdenes hay?", "Ver inventario"
- ⚡ **Respuestas Instantáneas**: Powered by Groq API (LLM ultra-rápido)
- 🎨 **UI Moderna**: Floating chat button con animaciones
- 🧠 **Parse de Intenciones**: Usa Llama 3.3 70B para entender comandos

### 🚀 Stack Técnico

```
Frontend → Groq API (Llama 3.3 70B) → Parse Intent → Execute Action
```

- **LLM**: Groq con Llama 3.3 70B Versatile
- **SDK**: groq-sdk (NPM)
- **Free Tier**: 14,400 requests/día (sin tarjeta)
- **Velocidad**: ~10x más rápido que OpenAI

### 📋 Configuración Rápida

1. Obtener API key gratis de [Groq Console](https://console.groq.com)
2. Agregar a `.env`:
   ```bash
   VITE_GROQ_API_KEY=gsk_your_api_key_here
   ```
3. `npm install` en `/frontend`
4. `npm run dev`

### 💬 Ejemplos de Uso

```
👤 Usuario: "Quiero pedir 10 platos"
🤖 Bot: ✅ ¡Perfecto! He creado tu orden de 10 platos.
        ID: abc-123, Estado: Pendiente

👤 Usuario: "¿Cuántas órdenes hay?"
🤖 Bot: 📊 En progreso: 3, Completadas: 15, Total: 18

👤 Usuario: "Ver inventario"
🤖 Bot: 📦 Total: 25 ingredientes, Stock suficiente ✅
```

### 📚 Documentación Completa

Ver [frontend/src/components/chatbot/README.md](frontend/src/components/chatbot/README.md) para:
- Guía detallada de configuración
- Arquitectura técnica
- Personalización
- Troubleshooting

### 🎯 Decisiones de Diseño

**¿Por qué frontend directo y no microservicio?**

1. ✅ **Pragmático**: Es un bonus, no el core del proyecto
2. ✅ **Rápido**: Implementación en 1 hora vs 3-4 horas
3. ✅ **Free Tier Friendly**: Sin infraestructura adicional
4. ✅ **Seguro**: Groq es gratis, rate limit por IP
5. ✅ **Ya demostramos**: Arquitectura de microservicios completa

**Alternativa para producción**: Backend proxy con API key en Lambda/Secrets Manager

---

# 🎓 Conclusión del Proyecto

Este sistema demuestra:

✅ **Arquitectura Event-Driven**: Comunicación 100% asíncrona  
✅ **Microservicios**: 4 servicios independientes y escalables  
✅ **AWS Cloud Native**: Lambda, SNS, SQS, RDS, API Gateway, Cognito  
✅ **IaC**: Infraestructura como código con AWS CDK  
✅ **Testing**: TDD con Jest + Testcontainers  
✅ **CI/CD Ready**: Docker, automatización de despliegues  
✅ **IA Integration**: Chatbot inteligente con Groq/Llama 3.3  

**Bonus Challenge**: Chatbot con IA que potencia la experiencia del usuario 🤖💛
