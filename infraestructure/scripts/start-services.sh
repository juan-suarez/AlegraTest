#!/bin/bash

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║      🍽️  Levantando Servicios - Restaurant System      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Obtener el directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo -e "${YELLOW}Base directory: ${BASE_DIR}${NC}\n"

# Array de servicios
SERVICES=("order-service" "kitchen-service" "inventory-service" "purchasing-service")
PIDS=()

# Function to cleanup on exit
cleanup() {
  echo -e "\n${YELLOW}🛑 Deteniendo servicios...${NC}"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo -e "${YELLOW}  Stopped PID: $pid${NC}"
    fi
  done
  wait
}

trap cleanup EXIT

# Iniciar cada servicio
echo -e "${BLUE}Starting services...${NC}\n"

for service in "${SERVICES[@]}"; do
  SERVICE_PATH="${BASE_DIR}/services/${service}"
  
  if [ ! -d "$SERVICE_PATH" ]; then
    echo -e "${RED}❌ Service path not found: $SERVICE_PATH${NC}"
    exit 1
  fi

  echo -e "${YELLOW}📦 Installing dependencies for $service...${NC}"
  cd "$SERVICE_PATH"
  npm install --silent > /dev/null 2>&1 &
  INSTALL_PID=$!
  
  wait $INSTALL_PID
  
  echo -e "${GREEN}✅ $service ready${NC}"
  
  # Iniciar el servicio en background
  echo -e "${BLUE}🚀 Starting $service...${NC}"
  npm start > "${BASE_DIR}/logs/${service}.log" 2>&1 &
  SERVICE_PID=$!
  PIDS+=($SERVICE_PID)
  echo -e "${GREEN}   PID: $SERVICE_PID${NC}\n"
done

echo -e "${GREEN}✅ Todos los servicios se están iniciando...${NC}"
echo -e "${YELLOW}Para ver logs en tiempo real:${NC}"
echo -e "  tail -f ${BASE_DIR}/logs/*.log"
echo -e "\n${YELLOW}Presiona Ctrl+C para detener todos los servicios${NC}\n"

# Esperar indefinidamente
wait
