FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm ci && npm run build

COPY src/db ./dist/db

EXPOSE 3002

CMD ["npm", "start"]
