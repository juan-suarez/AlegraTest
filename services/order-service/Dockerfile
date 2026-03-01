FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm ci && npm run build

COPY src/db ./dist/db

EXPOSE 3001

CMD ["npm", "start"]
