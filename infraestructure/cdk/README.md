# ☁️ AWS CDK Infrastructure - Restaurant System

Infraestructura completa como código para desplegar el sistema event-driven de restaurante en AWS.

---

## 📁 Estructura

```
cdk/
├── bin/
│   └── restaurant-app.ts           # CDK App entry point
├── lib/
│   ├── restaurant-stack.ts         # Main orchestration stack
│   └── constructs/
│       ├── database.ts             # RDS PostgreSQL construct
│       ├── event-bus.ts            # SNS Topics + SQS Queues
│       ├── lambda-services.ts      # Lambda functions for 4 services
│       ├── api-gateway.ts          # API Gateway + Cognito Authorizer
│       ├── auth.ts                 # Cognito User Pool + Client
│       └── frontend.ts             # S3 + CloudFront + Deploy
├── cdk.json                        # CDK configuration
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
└── README.md                       # This file
```

---

## 🛠️ Constructs Desplegados

### 1. **Database Construct** (`constructs/database.ts`)

**RDS PostgreSQL** instance optimizada para Free Tier:

- **Instancia**: db.t3.micro
- **VPC**: Creación automática con subnets públicas
- **Security Group**: Permite conexiones PostgreSQL (puerto 5432)
- **IAM Authentication**: Habilitado para Lambda
- **Secrets Manager**: Credenciales auto-generadas
- **Custom Resource**: Lambda que crea usuario IAM en DB

**Características**:
- Single AZ (no Multi-AZ)
- 20GB storage (Free Tier limit)
- Backup retention mínimo (1 día)
- `removalPolicy: DESTROY` (para testing)

**Outputs**: Host, port, username, Secrets Manager ARN, Instance Resource ID

---

### 2. **Event Bus Construct** (`constructs/event-bus.ts`)

Sistema completo de mensajería asíncrona:

**9 SNS Topics**:
- `OrderCreated`
- `OrderItemsSelected`
- `IngredientsRequired`
- `IngredientsReserved`
- `PurchaseRequested`
- `PurchaseCompleted`
- `PurchaseFailed`
- `IngredientsPurchaseFailed`
- `OrderCompleted`

**4 SQS Queues + 4 DLQ**:
- `order-service-queue` (+ DLQ)
- `kitchen-service-queue` (+ DLQ)
- `inventory-service-queue` (+ DLQ)
- `purchasing-service-queue` (+ DLQ)

**Subscriptions**: Configuradas según el patron de routing de eventos

---

### 3. **Lambda Services Construct** (`constructs/lambda-services.ts`)

**4 Lambda Functions** (una por microservicio):

- `restaurant-order-service`
- `restaurant-kitchen-service`
- `restaurant-inventory-service`
- `restaurant-purchasing-service`

**Configuración**:
- Runtime: Node.js 18.x
- Timeout: 300 segundos
- Memory: 256 MB
- Auto-bundling con `esbuild` (NodejsFunction)
- SQS Event Source con `maxConcurrency` (control de concurrencia)
- Batch size: 5 mensajes
- `reportBatchItemFailures`: true

**IAM Permissions**:
- SNS Publish (todos los topics)
- SQS ReceiveMessage/DeleteMessage
- Secrets Manager Read (DB password)
- RDS IAM Connect (autenticación IAM)

---

### 4. **Auth Construct** (`constructs/auth.ts`)

Sistema de autenticación con **AWS Cognito**:

**User Pool**:
- Sign-up deshabilitado (usuarios creados por admin)
- Sign-in con email
- Auto-verificación de email
- MFA deshabilitado
- Password policy (mínimo 8 chars, upper, lower, digits)

**User Pool Client**:
- Frontend SPA client
- OAuth2 Implicit Grant Flow
- Callback URLs configurables via env vars
- Refresh token: 30 días
- Access/ID tokens: 1 hora

**Hosted UI Domain**:
- Dominio Cognito: `{stack-name}-restaurant-auth.auth.{region}.amazoncognito.com`
- Customizable via `COGNITO_DOMAIN_PREFIX` env var

**Outputs**: User Pool ID, Client ID, Domain URL

---

### 5. **API Gateway Construct** (`constructs/api-gateway.ts`)

REST API con autenticación y rate limiting:

**Endpoints**:
```
POST /orders                           → order-service Lambda
GET  /orders                           → order-service Lambda

GET  /inventory/ingredients            → inventory-service Lambda
GET  /inventory/ingredients/{id}       → inventory-service Lambda
GET  /inventory/reservations           → inventory-service Lambda

GET  /purchases                        → purchasing-service Lambda
GET  /purchases/stats                  → purchasing-service Lambda
```

**Seguridad**:
- Cognito User Pools Authorizer
- API Key requerida
- CORS habilitado (todos los orígenes)

**Rate Limiting**:
- Rate limit: 1,000 req/s
- Burst: 2,000 req/s
- Quota: 30,000 req/día (safe para Free Tier)

**Outputs**: API endpoint URL, API Key

---

### 6. **Frontend Construct** (`constructs/frontend.ts`)

Despliegue automático del frontend en S3 + CloudFront:

**S3 Bucket**:
- Privado (BlockPublicAccess: ALL)
- Encryption: S3 Managed
- Website hosting configurado
- Auto-delete on stack destroy

**CloudFront Distribution**:
- Origin Access Control (OAC) para S3
- HTTPS obligatorio (redirect)
- Compression habilitada
- Price Class: 100 (USA, Canada, Europe)

**Behaviors**:
```
/                 → S3 (assets estáticos)
/orders/*         → API Gateway (proxy con x-api-key)
/inventory/*      → API Gateway (proxy con x-api-key)
/purchases/*      → API Gateway (proxy con x-api-key)
```

**Deploy Automático**:
1. Build del frontend (`npm run build`)
2. Upload de `dist/` a S3
3. Invalidación de caché de CloudFront
4. Custom Resource que inyecta `runtime-config.js` con valores de Cognito

**Outputs**: CloudFront URL, S3 Bucket name, Distribution ID

---

### 7. **Restaurant Stack** (`lib/restaurant-stack.ts`)

Stack principal que orquesta todos los constructs:

**Orden de creación**:
1. Database (RDS)
2. Event Bus (SNS + SQS)
3. Lambda Services (con conexiones a DB y queues)
4. Auth (Cognito)
5. API Gateway (con Cognito authorizer)
6. Frontend (con runtime config de Cognito)

**Stack Outputs**:
- API Endpoint URL
- Frontend URL (CloudFront)
- Frontend Bucket name
- Database Host/Port
- Cognito Pool ID/Client ID/Domain

---

## 🚀 Despliegue

### Prerrequisitos

```bash
# 1. AWS CLI configurado
aws configure
# Ingresar: Access Key ID, Secret Access Key, Region (ej: us-east-1)

# 2. Node.js 18+ instalado
node --version

# 3. Instalar dependencias
cd infraestructure/cdk
npm install
```

### Bootstrap CDK (solo primera vez)

```bash
npx cdk bootstrap aws://ACCOUNT_ID/REGION
# Ejemplo: npx cdk bootstrap aws://123456789012/us-east-1
```

### Deploy Completo

```bash
# 1. Compilar TypeScript
npm run build

# 2. (Opcional) Ver cambios antes de desplegar
npx cdk diff

# 3. Sintetizar CloudFormation
npx cdk synth

# 4. Desplegar a AWS
npx cdk deploy

# 5. Confirmar cambios cuando se solicite
# ¿Deploy stack RestaurantStack? (y/n) → y
```

**Tiempo estimado**: 15-20 minutos (RDS toma más tiempo)

### Variables de Entorno Opcionales

```bash
# Cognito domain prefix (default: {stack-name}-restaurant-auth)
export COGNITO_DOMAIN_PREFIX=my-custom-prefix

# Cognito callback URLs (comma-separated)
export COGNITO_CALLBACK_URLS=https://my-domain.com/,http://localhost:5173/

# Cognito logout URLs (comma-separated)
export COGNITO_LOGOUT_URLS=https://my-domain.com/,http://localhost:5173/

# Frontend proxy API key
export FRONTEND_PROXY_API_KEY=my-secure-key-change-me

# Luego deploy
npx cdk deploy
```

### Outputs del Deploy

Después del deploy exitoso verás:

```
Outputs:
RestaurantStack.ApiEndpoint = https://abc123.execute-api.us-east-1.amazonaws.com/prod
RestaurantStack.FrontendUrl = https://d111111abcdef8.cloudfront.net
RestaurantStack.CognitoUserPoolId = us-east-1_ABC123
RestaurantStack.CognitoUserPoolClientId = 1a2b3c4d5e6f7g8h9i0j
RestaurantStack.CognitoDomainUrl = https://my-stack-restaurant-auth.auth.us-east-1.amazoncognito.com
RestaurantStack.DatabaseHost = restaurant-db.abc123.us-east-1.rds.amazonaws.com
```

---

## 👤 Crear Usuario en Cognito

```bash
# El sistema NO tiene auto-registro, debes crear usuarios manualmente

# Obtener User Pool ID del output o ejecutar:
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name RestaurantStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoUserPoolId`].OutputValue' \
  --output text)

# Crear usuario
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username usuario@example.com \
  --user-attributes Name=email,Value=usuario@example.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

# Usuario recibirá email para cambiar password en primer login
```

---

## 🗄️ Inicializar Base de Datos

Después del deploy, debes ejecutar los schemas SQL:

```bash
# 1. Obtener credenciales de Secrets Manager
DB_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name RestaurantStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabasePasswordSecretArn`].OutputValue' \
  --output text)

DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id $DB_SECRET_ARN \
  --query SecretString \
  --output text | jq -r .password)

DB_HOST=$(aws cloudformation describe-stacks \
  --stack-name RestaurantStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseHost`].OutputValue' \
  --output text)

# 2. Conectar a RDS
psql -h $DB_HOST -U postgres -d postgres

# 3. Crear schemas (ejecutar manualmente en psql)
# - services/order-service/src/db/schema.sql
# - services/kitchen-service/src/db/schema.sql
# - services/inventory-service/src/db/schema.sql
# - services/purchasing-service/src/db/schema.sql
```

**Nota**: En el futuro esto se puede automatizar con CloudFormation Custom Resources o AWS Database Migration Service.

---

## 🧪 Verificar Deployment

```bash
# 1. Verificar API Gateway
curl https://YOUR-API-ENDPOINT/orders

# 2. Verificar Frontend
open https://YOUR-CLOUDFRONT-URL

# 3. Hacer login con usuario creado
# 4. Crear orden desde la UI
# 5. Verificar logs en CloudWatch
```

---

## 🗑️ Eliminar Recursos

```bash
# Eliminar stack completo
npx cdk destroy

# Confirmar eliminación
# Are you sure you want to delete: RestaurantStack (y/n)? → y

# Esto eliminará:
# - Todos los Lambdas
# - API Gateway
# - Base de datos RDS
# - S3 Bucket (frontend)
# - CloudFront Distribution
# - Cognito User Pool
# - SNS Topics y SQS Queues
```

**Importante**: S3 y RDS se eliminan automáticamente porque tienen `removalPolicy: DESTROY`.

---

## 💰 Costos Estimados (Free Tier)

### Incluido en Free Tier:

- **Lambda**: 1M requests/mes + 400,000 GB-s compute
- **API Gateway**: 1M requests/mes (primer año)
- **RDS t3.micro**: 750 horas/mes (db.t3.micro Single-AZ)
- **RDS Storage**: 20GB (included)
- **SNS**: 1M publishes/mes
- **SQS**: 1M requests/mes
- **CloudFront**: 50GB transfer/mes
- **S3**: 5GB storage + 20,000 GET + 2,000 PUT
- **Cognito**: 50,000 MAU (Monthly Active Users)

### Costos Reales Estimados:

Con tráfico bajo-medio (dentro de Free Tier):
- **Primer Año**: $0/mes
- **Después del Primer Año**: ~$0-5/mes (solo API Gateway si excedes)

**Si excedes Free Tier**:
- RDS t3.micro: ~$15/mes (si ejecutas 24/7 fuera de Free Tier)
- Lambda: ~$0.20 por millón de requests adicionales
- API Gateway: ~$3.50 por millón de requests adicionales

**Recomendación**: Monitorear costos en AWS Cost Explorer.

---

## 📊 Arquitectura Desplegada

```
Internet
   ↓
CloudFront (CDN)
   ├─→ S3 (Frontend SPA)
   └─→ API Gateway
         ├─→ Cognito Authorizer
         └─→ Lambda Functions (4x)
               ├─→ RDS PostgreSQL
               └─→ SNS → SQS → Lambda (event processing)
```
