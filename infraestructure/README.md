# infrastructure

Este directorio contiene toda la definición de infraestructura como código (IaC) usando **AWS CDK**.

La arquitectura está diseñada para funcionar completamente en la **capa gratuita de AWS (Free Tier)**.

---

# 1. Principios de Infraestructura

- Infraestructura 100% declarativa con AWS CDK
- Arquitectura serverless
- Comunicación asíncrona basada en eventos
- Desacoplamiento total entre servicios
- Uso responsable de recursos para mantenerse dentro del Free Tier
- Seguridad basada en IAM Roles por servicio

---

# 2. Servicios Cloud Utilizados

## 2.1 AWS Lambda

Cada microservicio se despliega como:

- Una Lambda containerizada (imagen Docker)
- Independiente
- Con su propio rol IAM
- Conectada a su respectiva base de datos

Free Tier incluye:
- 1 millón de invocaciones por mes
- 400.000 GB-segundos

Esto es más que suficiente para una prueba técnica o proyecto de portafolio.

---

## 2.2 Amazon SNS

Se utiliza como **Event Bus** central.

Responsabilidades:
- Recibir eventos publicados por los servicios
- Distribuirlos a múltiples suscriptores (SQS)

Ventajas:
- Pub/Sub nativo
- Totalmente desacoplado
- Integración directa con SQS y Lambda
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

# 12. Entorno Local

Para pruebas locales se usará:

- LocalStack para simular:
  - SNS
  - SQS
- Docker para ejecutar servicios
- PostgreSQL local

La infraestructura cloud se define únicamente en este directorio.

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