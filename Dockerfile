FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY api/package.json api/package.json
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY tsconfig*.json ./
COPY api ./api

RUN npm ci
RUN npm run prisma:generate
RUN npm run build:api

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

COPY package*.json ./
COPY api/package.json api/package.json
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci --omit=dev

COPY --from=builder /app/api/dist ./api/dist

EXPOSE 5000

CMD ["node", "api/dist/main.js"]
