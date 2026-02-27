#!/bin/bash
# Script para verificar que LocalStack está funcionando correctamente

echo "🔍 Verificando LocalStack..."
echo ""

# Esperar a que LocalStack esté listo
echo "⏳ Esperando a que LocalStack esté listo..."
sleep 5

echo "📋 Topics SNS creados:"
awslocal sns list-topics --endpoint-url http://localhost:4566 --query 'Topics[].TopicArn' --output text | tr '\t' '\n'

echo ""
echo "📬 Colas SQS creadas:"
awslocal sqs list-queues --endpoint-url http://localhost:4566 --query 'QueueUrls' --output text | tr '\t' '\n'

echo "" 
echo "✅ LocalStack está funcionando correctamente!"
echo ""
echo "Endpoints:"
echo "  SNS: http://localhost:4566"
echo "  SQS: http://localhost:4566"
echo ""
echo "Próximos pasos:"
echo "  1. Crear EventBusLocal en cada servicio"
echo "  2. Integrar SQSConsumer en orden-service"
echo "  3. Probar comunicación entre servicios"
