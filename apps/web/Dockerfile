# Build do frontend Next.js (contexto: raiz do monorepo)
# docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... .
FROM node:20-alpine AS build
WORKDIR /app

# Variáveis NEXT_PUBLIC_* são embutidas no bundle em BUILD time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci -w @delivery/shared -w @delivery/web

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @delivery/shared && npm run build -w @delivery/web

# ---- Runtime (output standalone do Next) ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
