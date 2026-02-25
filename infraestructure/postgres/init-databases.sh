#!/bin/bash
set -e

# Script que se ejecuta automáticamente cuando Postgres inicia por primera vez
# Crea todas las databases necesarias para los microservicios

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Crear databases para cada microservicio
    CREATE DATABASE order_service;
    CREATE DATABASE kitchen_service;
    CREATE DATABASE inventory_service;
    CREATE DATABASE purchasing_service;

    -- Dar permisos (opcional, pero buena práctica)
    GRANT ALL PRIVILEGES ON DATABASE order_service TO postgres;
    GRANT ALL PRIVILEGES ON DATABASE kitchen_service TO postgres;
    GRANT ALL PRIVILEGES ON DATABASE inventory_service TO postgres;
    GRANT ALL PRIVILEGES ON DATABASE purchasing_service TO postgres;
EOSQL

echo "✅ Databases created successfully:"
echo "  - order_service"
echo "  - kitchen_service"
echo "  - inventory_service"
echo "  - purchasing_service"
