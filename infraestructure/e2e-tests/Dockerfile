FROM node:18-alpine

WORKDIR /app

# Copiar archivos necesarios
COPY package*.json ./
COPY tsconfig.json ./
COPY infraestructure ./infraestructure

# Instalar dependencias
RUN npm ci

# Ejecutar test
CMD ["npx", "ts-node", "./infraestructure/e2e-tests/test-e2e.ts"]
