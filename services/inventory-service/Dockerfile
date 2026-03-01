FROM node:18-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm ci && npm run build

COPY src/db ./dist/db

EXPOSE 3003

CMD ["npm", "start"]
