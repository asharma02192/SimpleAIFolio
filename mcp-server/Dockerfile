FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY --from=builder /app/dist ./dist

ENV MCP_API_URL=http://backend:3001
ENV MCP_HTTP=true
ENV MCP_HTTP_PORT=3100
EXPOSE 3100

CMD ["node", "dist/index.js"]
