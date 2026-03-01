# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install a simple HTTP server
RUN npm install -g http-server

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD http-server dist -p 3000 --try-index.html --gzip false 2>&1 | grep -q "Hit" || exit 1

# Expose port
EXPOSE 3000

# Start server
CMD ["http-server", "dist", "-p", "3000", "--try-index.html", "--gzip=false"]
