#!/bin/bash
# Script para verificar que las databases fueron creadas correctamente

echo "🔍 Verificando databases en Postgres..."
echo ""

docker exec restaurant-postgres psql -U postgres -c "\l" | grep "_service"

echo ""
echo "✅ Databases verificadas!"
