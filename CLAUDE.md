# CLAUDE.md — Convenções do projeto

Plataforma de delivery web-first para pequenas e médias cidades. Monorepo npm workspaces.

## Comandos

```bash
npm run dev:api          # NestJS em watch mode (porta 3001)
npm run dev:web          # Next.js dev (porta 3000)
npm run prisma:migrate   # prisma migrate dev
npm run prisma:studio    # GUI do banco
npm run db:seed          # popula dados de exemplo
docker compose up -d     # Postgres + Redis
```

## Arquitetura

- `apps/api` — NestJS 11, monolito modular. Módulos de domínio em `src/modules/`:
  `auth`, `users`, `stores`, `catalog`, `orders`, `logistics`, `payments`, `notifications`, `admin`,
  além de `health` (health check) e `cities` (módulo-modelo do padrão controller → service → Prisma).
- Infra transversal: `src/common/` (filtro global de exceções `{ statusCode, message, error }` e
  interceptor de logging) e `src/redis/` (tokens `REDIS` — client ioredis compartilhado — e
  `ORDERS_QUEUE` — fila BullMQ; o BullMQ cria as próprias conexões a partir da REDIS_URL,
  não compartilhe o client ioredis com ele: as cópias do ioredis têm tipos incompatíveis).
- `apps/api/prisma/schema.prisma` — fonte da verdade do modelo de dados. Toda mudança de banco passa por migration (`npm run prisma:migrate`), nunca por SQL manual.
- `apps/web` — Next.js App Router. Route groups por frente: `(cliente)` na raiz, `/lojista`, `/entregador`, `/admin`.
- `packages/shared` — enums e tipos compartilhados (status de pedido, papéis, formas de pagamento). Importar de `@delivery/shared`, nunca duplicar enums.

## Regras de domínio importantes

- Transições de status de pedido SÓ acontecem via máquina de estados no módulo `orders` (nunca `update` direto no status).
- Valores monetários: `Decimal` no Prisma, centavos inteiros nunca; exibição formatada só no frontend.
- Pagamento online só é capturado após o lojista aceitar o pedido.
- Eventos em tempo real (novo pedido, mudança de status) são emitidos pelo gateway WebSocket após o commit da transação.

## Convenções de código

- TypeScript estrito nos dois apps. DTOs com `class-validator` na API.
- Nomes de arquivos NestJS: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.gateway.ts`, `dto/*.dto.ts`.
- Idioma: código e identificadores em inglês; textos de UI e mensagens de erro ao usuário em pt-BR.
- Commits pequenos e frequentes, mensagem em pt-BR no imperativo ("adiciona checkout Pix").

## Fluxo com IA (Claude + qwen3-coder/Ollama)

- Claude: arquitetura, módulos sensíveis (auth, payments, orders/máquina de estados), debugging, revisão de código.
- qwen3-coder: CRUD repetitivo, componentes React a partir de spec pronta, testes, refatorações mecânicas.
- Todo código gerado pelo qwen3-coder passa por revisão (Claude ou humana) antes do commit.
- Ver detalhes e prompts em `docs/PASSO-A-PASSO.md`, seção "Fluxo de trabalho com IA".
