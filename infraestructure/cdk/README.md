# 🍽️ AWS CDK Infrastructure - Restaurant System

## ✅ Completed: CDK Setup & Constructs

This directory contains the AWS Cloud Development Kit (CDK) infrastructure code for deploying the restaurant event-driven system to AWS.

### 📁 Structure

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
│       └── api-gateway.ts          # API Gateway for Order Service
├── cdk.json                        # CDK configuration
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
└── README.md                       # This file
```

## 🛠️ Constructs Built

### 1. **Database Construct** (`constructs/database.ts`)
- **RDS PostgreSQL** instance (db.t3.micro - Free Tier)
- **Automatic VPC** creation with public subnets
- **Security Group** allowing PostgreSQL (port 5432)
- **Auto-generated Secrets Manager** for credentials
- **Features**:
  - Single AZ (no Multi-AZ - Free Tier)
  - 20GB storage (Free Tier limit)
  - Minimal backup retention (1 day - Free Tier)
  - Automatic destruction on stack deletion (for testing)

**Outputs**: Database host, port, username, password in Secrets Manager

### 2. **Event Bus Construct** (`constructs/event-bus.ts`)
- **9 SNS Topics** for event publishing
- **4 SQS Queues** (one per service)
- **Proper subscriptions** (queue ← topic routing)
- All queues following the event router pattern

### 3. **Lambda Services Construct** (`constructs/lambda-services.ts`)
- **4 Lambda Functions** (one per microservice)
- Configured with DB credentials and SQS URLs
- IAM permissions for SNS/SQS/RDS access
- CloudWatch logs enabled

### 4. **API Gateway Construct** (`constructs/api-gateway.ts`)
- **REST API** proxy to Order Service Lambda
- CORS enabled for frontend
- CloudWatch logging enabled

### 5. **Restaurant Stack** (`lib/restaurant-stack.ts`)
- Orchestrates all constructs
- Exports critical endpoints and configuration

---

## ✅ Compilation Status

✅ **TypeScript Compilation**: SUCCESSFUL
✅ **Project Structure**: COMPLETE  
✅ **Build System**: FUNCTIONAL

---

## 🚀 Deployment Commands

```bash
# Build TypeScript
npm run build

# Synthesize CloudFormation
npx cdk synth

# Deploy to AWS
npx cdk deploy

# Destroy resources
npx cdk destroy
```

---

## 📊 Next Steps

1. ✅ Infrastructure code complete
2. ⏳ Refactor microservices to export Lambda handlers
3. ⏳ Bootstrap CDK environment
4. ⏳ Deploy to AWS
5. ⏳ Create databases in RDS
6. ⏳ Deploy service code
7. ⏳ Test event flow

---

## 🆓 Free Tier Compatible

- Single t3.micro RDS instance
- 4 Lambda functions (1M requests/month included)
- SNS/SQS (1M requests/month included)
- API Gateway (1M calls/month - first year)

**Estimated Cost**: ~$0/month (Free Tier)
