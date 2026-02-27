# 🏠 Local Development Infrastructure

This directory contains all the infrastructure needed for **local development** using Docker Compose.

## 📁 Structure

```
local/
├── e2e-tests/          # End-to-end tests
├── localstack/         # AWS services emulation (SNS/SQS)
├── postgres/           # PostgreSQL initialization scripts
└── scripts/            # Helper scripts for local development
```

## 🚀 Usage

All local development is orchestrated through the root `docker-compose.yml` and `package.json` scripts:

```bash
# Start all services
npm run dev

# Start only microservices (no tests)
npm run dev:services

# Run E2E tests
npm run test:e2e

# Build all containers
npm run build

# Stop everything
npm run down

# Stop and remove volumes
npm run down:v
```

## 🔧 Components

### LocalStack
Emulates AWS SNS and SQS for event-driven communication between services.
- **Init script**: `localstack/init-aws.sh`
- Creates 9 SNS topics and 4 SQS queues with proper subscriptions

### PostgreSQL
Single PostgreSQL instance with 4 separate databases (one per service).
- **Init script**: `postgres/init-databases.sh`
- Databases: `order_service`, `kitchen_service`, `inventory_service`, `purchasing_service`

### E2E Tests
Automated tests that verify the complete event flow across all services.
- **Test file**: `e2e-tests/test-e2e.ts`
- Validates database state and event propagation

### Scripts
Helper scripts for managing local services:
- `start-services.sh`: Start all services in parallel
- `wait-for-services.sh`: Wait for services to be healthy

## 🆚 Local vs Production

- **Local**: Uses LocalStack (free AWS emulation)
- **Production**: Uses real AWS services (see `infraestructure/cdk/`)

This separation keeps local development simple while production uses AWS CDK for infrastructure as code.
