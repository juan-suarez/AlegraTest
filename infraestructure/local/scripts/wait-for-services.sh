#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}⏳ Esperando a que los servicios estén listos...${NC}\n"

# Services a verificar
declare -a SERVICES=(
  "order-db:5432"
  "kitchen-db:5432"
  "inventory-db:5432"
  "purchasing-db:5432"
)

# Esperar a PostgreSQL
for service in "${SERVICES[@]}"; do
  HOST=$(echo $service | cut -d':' -f1)
  PORT=$(echo $service | cut -d':' -f2)
  
  echo -e "${YELLOW}Esperando ${HOST}:${PORT}...${NC}"
  
  MAX_ATTEMPTS=30
  ATTEMPTS=0
  
  while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    if nc -z -w1 $HOST $PORT 2>/dev/null; then
      echo -e "${GREEN}✅ ${HOST}:${PORT} está listo${NC}"
      break
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    echo -n "."
    sleep 1
  done
  
  if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Timeout esperando ${HOST}:${PORT}${NC}"
    exit 1
  fi
done

echo -e "\n${GREEN}✅ Todos los servicios están listos${NC}\n"
