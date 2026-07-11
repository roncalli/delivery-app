# Delivery App — Plataforma de delivery para pequenas e médias cidades

Sistema web-first (PWA) semelhante ao iFood, com 4 frentes: cliente, lojista, entregador e admin.

## Documentação

- **[docs/COMO-RODAR.md](docs/COMO-RODAR.md)** — como subir e operar o ambiente no dia a dia (leia primeiro)
- **[docs/PASSO-A-PASSO.md](docs/PASSO-A-PASSO.md)** — guia completo de desenvolvimento, etapa por etapa
- **[CLAUDE.md](CLAUDE.md)** — convenções do projeto para desenvolvimento assistido por IA
- `../estruturacao-sistema-delivery.md` — documento de planejamento (produto, arquitetura, modelo de negócio)

## Estrutura

```
delivery-app/
├── apps/
│   ├── api/        # Backend NestJS (REST + WebSocket) + Prisma
│   └── web/        # Frontend Next.js (PWA cliente, painel lojista, entregador, admin)
├── packages/
│   └── shared/     # Tipos e enums compartilhados entre api e web
├── docs/           # Documentação de desenvolvimento
└── docker-compose.yml  # Postgres (PostGIS) + Redis para desenvolvimento
```

## Início rápido

Pré-requisitos: Node.js 20+, Docker Desktop.

```bash
cp .env.example .env        # ajuste os valores se necessário
cp .env apps/api/.env       # o Prisma CLI lê o .env da pasta do app
npm install                 # instala todos os workspaces
docker compose up -d        # sobe Postgres + Redis
npm run prisma:migrate      # cria as tabelas
npm run db:seed             # dados de exemplo (cidade, loja, produtos)

# Em dois terminais:
npm run dev:api             # API em http://localhost:3001/api
npm run dev:web             # Web em http://localhost:3000
```

## Rotas do frontend

| Rota | Frente |
|---|---|
| `/` | PWA do cliente (vitrine, carrinho, pedidos) |
| `/lojista` | Painel do lojista (gestor de pedidos, cardápio) |
| `/entregador` | PWA do entregador (Fase 2) |
| `/admin` | Painel administrativo da plataforma |
