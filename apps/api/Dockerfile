# Build da API (contexto: raiz do monorepo)
# docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependências só dos workspaces necessários (cache de camada)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci -w @delivery/shared -w @delivery/api

# Código e build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @delivery/shared \
  && npx -w @delivery/api prisma generate \
  && npm run build -w @delivery/api

# ---- Runtime enxuto ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
EXPOSE 3001
# Aplica migrations pendentes e sobe (idempotente a cada deploy)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
