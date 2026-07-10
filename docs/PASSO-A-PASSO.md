# Passo a Passo do Desenvolvimento

Guia detalhado para construir a plataforma de delivery, etapa por etapa, usando **Claude** (Claude Code) e **qwen3-coder** (via Ollama) como assistentes de desenvolvimento.

> Contexto de produto e arquitetura: ver `../../estruturacao-sistema-delivery.md`.
> Convenções do código: ver `../CLAUDE.md`.

---

## Sumário

- [Fluxo de trabalho com IA (Claude + qwen3-coder)](#fluxo-de-trabalho-com-ia)
- [Etapa 0 — Ambiente de desenvolvimento](#etapa-0)
- [Etapa 1 — Fundação do backend](#etapa-1)
- [Etapa 2 — Autenticação e usuários](#etapa-2)
- [Etapa 3 — Lojas e catálogo](#etapa-3)
- [Etapa 4 — Pedidos e tempo real](#etapa-4)
- [Etapa 5 — Painel do lojista](#etapa-5)
- [Etapa 6 — PWA do cliente](#etapa-6)
- [Etapa 7 — Pagamentos online](#etapa-7)
- [Etapa 8 — Painel administrativo](#etapa-8)
- [Etapa 9 — Deploy e lançamento piloto](#etapa-9)
- [Fase 2 — Etapas 10 a 12](#fase-2)

---

<a id="fluxo-de-trabalho-com-ia"></a>
## Fluxo de trabalho com IA (Claude + qwen3-coder)

### Papel de cada ferramenta

| Tarefa | Ferramenta | Por quê |
|---|---|---|
| Arquitetura, decisões de design, modelagem | **Claude** | Raciocínio sobre trade-offs e visão do projeto inteiro |
| Módulos sensíveis: `auth`, `payments`, `orders` (máquina de estados, dinheiro) | **Claude** | Erro aqui custa caro; exige raciocínio sobre casos de borda |
| Debugging de problemas difíceis (race conditions, WebSocket, transações) | **Claude** | Precisa correlacionar várias partes do sistema |
| Revisão de todo código antes do commit | **Claude** (`/code-review`) | Pega bugs que o gerador não vê |
| CRUD repetitivo (controllers/services/DTOs a partir de um exemplo pronto) | **qwen3-coder** | Padrão já definido, tarefa mecânica, roda local e sem custo |
| Componentes React a partir de spec detalhada (layout descrito, props definidas) | **qwen3-coder** | Geração de volume |
| Testes unitários de código existente, refatorações mecânicas, JSDoc | **qwen3-coder** | Tarefa delimitada com gabarito claro |

### Regras do fluxo

1. **Claude define o padrão, qwen replica o padrão.** Ex.: Claude implementa o CRUD completo de `MenuCategory` (controller + service + DTOs + testes); depois o qwen3-coder gera os CRUDs de `Product`, `OptionGroup` e `Option` seguindo aquele arquivo como modelo. Sempre inclua o arquivo-modelo no contexto do qwen.
2. **Nunca deixe o qwen3-coder tocar em `payments/`, `auth/` ou na máquina de estados de `orders/`** sem revisão linha a linha.
3. **Todo código do qwen passa por revisão antes do commit** — rode `/code-review` no Claude Code ou revise manualmente. Modelos locais menores erram em: imports inexistentes, métodos de API inventados, validação esquecida.
4. **Commits pequenos**: uma feature por commit. Se a IA gerou 5 arquivos, teste antes de commitar.
5. **Mantenha o `CLAUDE.md` atualizado** a cada decisão nova (ex.: "escolhemos Asaas") — os dois assistentes leem dele o contexto.
6. **Teste manual a cada etapa**: o "Critério de pronto" de cada etapa abaixo é um roteiro de teste manual. Não avance com o critério anterior quebrado.

### Setup do qwen3-coder no Ollama

```bash
# Instalar Ollama: https://ollama.com/download (Windows)
ollama pull qwen3-coder        # ~19 GB (30B MoE, quantizado); precisa de ~24 GB de RAM
ollama run qwen3-coder         # teste rápido no terminal
```

Para usar dentro do VS Code, instale **Cline** ou **Continue** e aponte para o Ollama:
- Provider: `Ollama` / OpenAI-compatible
- Base URL: `http://localhost:11434`
- Model: `qwen3-coder`

Dica: aumente a janela de contexto para o qwen enxergar arquivos-modelo inteiros —
crie um Modelfile com `PARAMETER num_ctx 32768` ou configure `num_ctx` na ferramenta.
Se a máquina não aguentar o 30B, alternativas: `qwen2.5-coder:14b` ou `qwen2.5-coder:7b` (qualidade menor — reduza o escopo das tarefas delegadas).

### Anatomia de um bom prompt para o qwen3-coder

Modelos locais rendem muito mais com prompts fechados. Template:

```text
Contexto: monorepo NestJS + Prisma. Arquivo-modelo anexado: menu-category.controller.ts,
menu-category.service.ts, dto/create-menu-category.dto.ts.

Tarefa: crie o CRUD de Product seguindo EXATAMENTE o mesmo padrão do arquivo-modelo.

Modelo Prisma (colar o model Product do schema.prisma aqui).

Requisitos:
- Endpoints: POST /stores/:storeId/products, GET, PATCH /:id, DELETE /:id
- Validar que a store pertence ao usuário autenticado (como no modelo)
- DTOs com class-validator; price como número decimal positivo
- Não invente campos que não existem no schema

Saída: apenas os arquivos completos, sem explicação.
```

---

<a id="etapa-0"></a>
## Etapa 0 — Ambiente de desenvolvimento (1 dia)

### Objetivo
Máquina pronta: repositório rodando com API, web, banco e IA locais.

### Tarefas

1. **Instalar ferramentas**
   - [ ] Node.js 20 LTS (via [nvm-windows](https://github.com/coreybutler/nvm-windows) ou instalador)
   - [ ] Docker Desktop (com WSL2 habilitado)
   - [ ] Git + conta no GitHub (repositório privado)
   - [ ] VS Code + extensões: Prisma, ESLint, Tailwind CSS IntelliSense, Cline (para o qwen)
   - [ ] Ollama + `ollama pull qwen3-coder`
   - [ ] Claude Code (já em uso)

2. **Subir o projeto**
   ```bash
   cd delivery-app
   cp .env.example .env          # gerar um JWT_SECRET aleatório
   cp .env apps/api/.env         # o Prisma CLI lê o .env da pasta do app, não da raiz
   npm install
   docker compose up -d          # Postgres (PostGIS) + Redis
   npm run prisma:migrate        # nome da migration: "init"
   npm run db:seed
   npm run dev:api               # terminal 1 → http://localhost:3001/api
   npm run dev:web               # terminal 2 → http://localhost:3000
   ```

3. **Publicar no GitHub** — `git init`, primeiro commit, `git remote add origin ...`, push.

### Critério de pronto (DoD)
- [ ] `http://localhost:3000` mostra a home do cliente; `/lojista` e `/admin` abrem
- [ ] API responde (mesmo que só 404 em `/api` — ainda não há endpoints)
- [ ] `npm run prisma:studio` mostra as tabelas com os dados do seed
- [ ] `ollama run qwen3-coder "escreva um hello world em typescript"` responde

---

<a id="etapa-1"></a>
## Etapa 1 — Fundação do backend (2–3 dias)

### Objetivo
Infra transversal da API pronta para as features: validação, erros padronizados, health check e primeira rota real.

### Tarefas

1. **Health check** — `GET /api/health` retornando `{ status, db, redis }` (testa conexão com Postgres e Redis). *(qwen3-coder — tarefa simples e fechada)*
2. **Filtro global de exceções** — resposta de erro padronizada `{ statusCode, message, error }`, mensagens ao usuário em pt-BR. *(Claude)*
3. **Interceptor de logging** — loga método, rota, status e duração de cada request. *(qwen3-coder)*
4. **Conexão Redis compartilhada** — provider `REDIS` usando `ioredis` + registro do BullMQ (fila `orders` vazia por enquanto). *(Claude — configuração que o resto do projeto herda)*
5. **Primeira rota de domínio** — `GET /api/cities` (lista cidades ativas). Serve de modelo mínimo de controller/service. *(Claude define o padrão)*

### Critério de pronto
- [ ] `GET /api/health` → `{ status: "ok", db: true, redis: true }`
- [ ] `GET /api/cities` retorna a cidade do seed
- [ ] Erro de validação retorna 400 com mensagem em pt-BR

---

<a id="etapa-2"></a>
## Etapa 2 — Autenticação e usuários (4–6 dias)

### Objetivo
Login funcionando para os 4 papéis, com JWT + refresh token e guards de autorização.

### Decisões de design
- **Cliente**: login por telefone + código OTP (em dev, o provider `mock` loga o código no console; em produção, WhatsApp/SMS).
- **Lojista/Admin**: e-mail + senha (bcrypt).
- **Tokens**: access token JWT (15 min) + refresh token (30 dias) persistido/rotacionado.
- **Autorização**: decorator `@Roles(UserRole.ADMIN)` + `RolesGuard`.

### Tarefas

1. **Módulo auth — núcleo** *(Claude — módulo sensível)*
   - `POST /api/auth/otp/request` — body `{ phone }`; gera código de 6 dígitos, salva no Redis com TTL 5 min, envia via provider (mock em dev). Rate limit: 3 códigos/15 min por telefone.
   - `POST /api/auth/otp/verify` — body `{ phone, code }`; cria o usuário se não existir (role CUSTOMER) e retorna `{ accessToken, refreshToken, user }`.
   - `POST /api/auth/login` — e-mail + senha para lojista/admin.
   - `POST /api/auth/refresh` — rotaciona o refresh token (invalida o antigo).
   - `JwtAuthGuard` global + decorator `@Public()` para rotas abertas.
2. **Módulo users** *(qwen3-coder, seguindo o padrão de cities)*
   - `GET /api/users/me` e `PATCH /api/users/me` (nome, e-mail).
   - CRUD de endereços: `GET/POST/PATCH/DELETE /api/users/me/addresses` (marcar `isDefault` desmarca o anterior).
3. **Testes** *(qwen3-coder gera, Claude revisa)* — unit tests do fluxo OTP (código errado, expirado, rate limit) e do refresh (token reusado = rejeitado).
4. **Frontend — telas de login** *(qwen3-coder com spec)* — `/entrar` (telefone → OTP) para cliente; `/lojista/entrar` e `/admin/entrar` (e-mail/senha). Guardar tokens; interceptor de fetch que renova o access token ao receber 401.

### Critério de pronto
- [ ] Fluxo completo no navegador: pedir código → ver código no log da API → entrar
- [ ] Rota protegida sem token → 401; com role errada → 403
- [ ] Refresh automático funciona (forçar expiração com `JWT_EXPIRES_IN=10s`)

---

<a id="etapa-3"></a>
## Etapa 3 — Lojas e catálogo (5–8 dias)

### Objetivo
Lojista monta a loja e o cardápio completo; a vitrine pública expõe tudo para o cliente.

### Tarefas

1. **Módulo stores** *(Claude define endpoints de store; qwen replica os satélites)*
   - `POST /api/stores` — lojista cria a loja (nasce `PENDING` até o admin aprovar).
   - `GET /api/stores/mine`, `PATCH /api/stores/:id` (dados, horários, `deliveryMode`).
   - `POST /api/stores/:id/pause` / `resume` — "fechar temporariamente".
   - CRUD de `delivery-zones` (taxa por bairro ou raio).
   - Lógica de "loja aberta agora" a partir de `openingHours` (função pura + testes — atenção a horário que cruza a meia-noite, ex. 18:00–01:00).
2. **Módulo catalog** *(Claude faz `MenuCategory` como modelo; qwen replica para Product/OptionGroup/Option)*
   - CRUDs aninhados: categorias → produtos → grupos de opções → opções.
   - `PATCH /api/products/:id/availability` — esgotar/voltar item (toggle rápido).
   - Reordenação (`sortOrder`) por drag-and-drop no painel.
3. **Upload de imagens** *(Claude)* — endpoint que gera URL pré-assinada (R2/S3); em dev, fallback para disco local (`/uploads`). Redimensionar no cliente antes de subir (max 1200px).
4. **Vitrine pública (sem auth)** *(qwen3-coder)*
   - `GET /api/catalog/stores?cityId=&category=&search=` — lojas ativas com flag `isOpenNow`.
   - `GET /api/catalog/stores/:slug` — loja + cardápio completo (categorias → produtos → opções) em uma chamada.

### Critério de pronto
- [ ] Via API (Insomnia/Bruno): criar loja → admin aprova (update manual no Studio por enquanto) → montar cardápio com complementos → vitrine pública retorna tudo
- [ ] `isOpenNow` correto para horário que cruza meia-noite
- [ ] Upload de foto funciona e a URL abre no navegador

---

<a id="etapa-4"></a>
## Etapa 4 — Pedidos e tempo real (6–10 dias)

**A etapa mais importante do projeto.** Feita quase toda com o Claude; o qwen entra só nos DTOs e testes.

### Objetivo
Ciclo de vida completo do pedido: checkout → aceite → preparo → entrega, com eventos em tempo real e timeouts automáticos.

### Design

**Máquina de estados** — transições válidas já estão em `packages/shared/src/index.ts` (`ORDER_TRANSITIONS`). Regras:
- Toda transição passa por `OrdersService.transition(orderId, to, actor)` — valida a transição, valida quem pode (lojista aceita, cliente cancela só antes do aceite, admin sempre), grava o timestamp da coluna correspondente e emite o evento WebSocket **após o commit**.
- Cancelamento grava `cancelReason` e `canceledBy`.

**Cálculo do pedido (server-side, nunca confiar no front):**
1. Recalcular subtotal dos itens pelos preços atuais do banco (produto indisponível → 422).
2. Taxa de entrega pela `DeliveryZone` do endereço (bairro ou distância haversine ao ponto da loja). Endereço fora da área → 422.
3. Validar `minSelect`/`maxSelect` dos grupos de opções e `minOrderValue` da loja.
4. Snapshot de nome/preço em `OrderItem`/`OrderItemOption`.

**WebSocket (Socket.io)** — namespace `/ws`, auth por JWT no handshake. Salas: `store:{id}`, `customer:{id}` (depois `courier:{id}`). Eventos em `WS_EVENTS` do shared.

**Timeouts (BullMQ)** — ao criar pedido, agendar job `order-accept-timeout` (+5 min): se ainda `CREATED`, notifica admin; +10 min, cancela com estorno. Job cancelado quando o lojista aceita.

### Tarefas

1. `POST /api/orders` — checkout com validação/cálculo acima, transacional. *(Claude)*
2. `OrdersService.transition()` + endpoints: `POST /api/orders/:id/accept | ready | dispatch | deliver | cancel`. *(Claude)*
3. `GET /api/orders/mine` (cliente), `GET /api/orders/store/:storeId?status=` (lojista). *(qwen3-coder)*
4. Gateway WebSocket + salas + emissão pós-commit. *(Claude)*
5. Jobs de timeout no BullMQ. *(Claude)*
6. **Liquidação financeira ao entregar** *(Claude — dinheiro)*: transação `SALE` (crédito lojista = subtotal), `COMMISSION` (débito = subtotal × `commissionPct`), atualização do saldo da wallet — tudo na mesma transação de banco da entrega.
7. Testes da máquina de estados: transição inválida, ator errado, cancelamento tardio, timeout. *(qwen gera a partir da tabela de transições, Claude revisa)*

### Critério de pronto
- [ ] Pedido criado via API aparece **em tempo real** num cliente Socket.io de teste conectado à sala da loja
- [ ] Transição inválida (ex. CREATED → DELIVERED) → 409
- [ ] Pedido não aceito em 5 min dispara a notificação de timeout
- [ ] Ao marcar entregue, a wallet do lojista reflete venda − comissão

---

<a id="etapa-5"></a>
## Etapa 5 — Painel do lojista (5–8 dias)

### Objetivo
O lojista opera o dia a dia sem tocar na API: recebe pedidos com som, gerencia cardápio e horários.

### Telas (`/lojista/*`)

1. **Gestor de pedidos** (`/lojista/pedidos`) — a tela principal. *(Claude na integração realtime; qwen nos componentes visuais)*
   - Colunas por status: Novos / Em preparo / Prontos / Em entrega.
   - Pedido novo: **som em loop até interação** + destaque visual. (Áudio no navegador exige interação prévia do usuário — tocar o som após o primeiro clique/login.)
   - Card do pedido: número, itens + complementos, observação, forma de pagamento (destacar "troco para R$ X"), telefone do cliente (link WhatsApp).
   - Ações por status: aceitar (com tempo de preparo), recusar (motivo), pronto, saiu para entrega, entregue.
   - **Reconexão resiliente**: ao reconectar o socket, refazer fetch da lista (não confiar só nos eventos). Banner vermelho "SEM CONEXÃO" quando cair.
2. **Cardápio** (`/lojista/cardapio`) — árvore categorias → produtos → complementos; toggle de disponibilidade em 1 clique; modal de edição; upload de foto. *(qwen3-coder com spec detalhada)*
3. **Configurações** (`/lojista/configuracoes`) — dados da loja, horários por dia da semana, zonas/taxas de entrega, pausar loja. *(qwen3-coder)*
4. **Financeiro** (`/lojista/financeiro`) — vendas do dia/semana/mês, extrato da wallet, comissões. *(qwen3-coder)*

### Critério de pronto
- [ ] Teste de fogo: criar pedido pelo fluxo do cliente (ou API) e operá-lo até "entregue" só pelo painel, com som tocando na chegada
- [ ] Derrubar o wi-fi: banner de offline aparece; ao voltar, a lista se atualiza sozinha
- [ ] Esgotar um produto reflete na vitrine pública imediatamente

---

<a id="etapa-6"></a>
## Etapa 6 — PWA do cliente (8–12 dias)

### Objetivo
Experiência completa de pedido no celular: descobrir → montar carrinho → pagar → acompanhar.

### Telas e fluxo (`/(cliente)/*`)

1. **Home / vitrine** — seletor de cidade (persistido), busca, chips de categoria, cards de loja (logo, nota, taxa, tempo, aberta/fechada). *(qwen3-coder)*
2. **Página da loja** (`/loja/[slug]`) — capa, info, cardápio agrupado com âncoras por categoria. *(qwen3-coder)*
3. **Modal de produto** — foto, complementos com validação `min/max` em tempo real, observação, quantidade, preço dinâmico. *(Claude — a lógica de validação de opções é o coração da conversão)*
4. **Carrinho** — estado global (zustand + localStorage); regra: 1 loja por carrinho (trocar de loja → confirmar esvaziar). *(Claude no estado, qwen na UI)*
5. **Checkout** — endereço (usar geolocalização para pré-preencher; validar contra a área de entrega **antes** de o cliente montar o pedido inteiro), forma de pagamento (Pix / na entrega + troco), cupom, resumo, confirmar. *(Claude)*
6. **Acompanhamento** (`/pedido/[id]`) — timeline de status ao vivo (WebSocket), botão WhatsApp da loja, "pedir de novo". *(qwen na UI, Claude no realtime)*
7. **PWA** *(Claude)* — service worker (cache de shell + vitrine stale-while-revalidate; **nunca** cachear pedido/checkout), prompt de instalação, Web Push (VAPID) para status do pedido, ícones e splash.
8. **Avaliação** — nota loja/entrega após entregue. *(qwen3-coder)*

### Critério de pronto
- [ ] Jornada completa **no celular real** (rede 4G): escolher loja → montar pizza com complementos → checkout "na entrega" → acompanhar até entregue com timeline atualizando sozinha
- [ ] Lighthouse: PWA instalável, performance > 80 no mobile
- [ ] Push de mudança de status chega com o navegador fechado (Android/Chrome)

---

<a id="etapa-7"></a>
## Etapa 7 — Pagamentos online (5–8 dias)

**Módulo 100% Claude + revisão humana. Não delegar ao qwen3-coder.**

### Objetivo
Pix no checkout com confirmação automática e estorno em cancelamento.

### Decisões
- Gateway com **split**: Asaas ou Pagar.me (validar taxas atuais antes; abrir conta sandbox já no início da etapa — o cadastro/aprovação pode levar dias).
- MVP: **Pix + pagamento na entrega**. Cartão online fica para a Fase 2 (pré-autorização + captura no aceite).
- Regra de ouro: **pagamento confirmado ≠ pedido aceito.** Pix pago e lojista recusou → estorno automático.

### Tarefas

1. **Camada de abstração** — interface `PaymentGateway` (`createPixCharge`, `refund`, `parseWebhook`) com implementação `AsaasGateway` + `MockGateway` para dev/testes.
2. **Fluxo Pix**: checkout Pix → cria cobrança → salva `gatewayChargeId` → front mostra QR code + copia-e-cola com countdown → webhook confirma → `paymentStatus: PAID` → só então o pedido aparece para o lojista.
3. **Webhook** (`POST /api/payments/webhook`): validar assinatura/token, **idempotente** (evento duplicado não processa 2×), responder 200 rápido e processar via fila.
4. **Expiração**: Pix não pago em 15 min → cancelar pedido (job BullMQ).
5. **Estornos**: matriz de cancelamento — antes do aceite: estorno total automático; depois do aceite: decisão do admin (botão no painel).
6. **Split/repasse**: configurar split no gateway (repasse automático) **ou** receber tudo na conta da plataforma e pagar lojistas via Pix semanal (mais simples no MVP — a wallet da Etapa 4 já dá o saldo). Recomendação: começar com repasse semanal manual e migrar para split quando o volume justificar.
7. **Testes**: webhook duplicado, pagamento de pedido já cancelado, estorno falhou (fila de retry + alerta admin).

### Critério de pronto
- [ ] Sandbox: pagar Pix de teste → pedido aparece para o lojista sozinho
- [ ] Recusar pedido pago → estorno aparece no painel do gateway
- [ ] Reenviar o mesmo webhook 3× → nenhum efeito duplicado

---

<a id="etapa-8"></a>
## Etapa 8 — Painel administrativo (4–6 dias)

### Objetivo
Você opera a plataforma: aprova lojas, monitora pedidos, controla o dinheiro.

### Telas (`/admin/*`)

1. **Dashboard** — pedidos hoje, GMV, ticket médio, lojas ativas, pedidos "presos" (CREATED > 5 min) em destaque vermelho. *(qwen na UI, Claude nas queries agregadas)*
2. **Lojas** — fila de aprovação (dados + documento), aprovar/rejeitar/suspender, editar comissão por loja. *(qwen3-coder)*
3. **Monitor de pedidos** — todos os pedidos ao vivo, filtros, ações de intervenção: cancelar com estorno, forçar transição, contatar as partes (links WhatsApp). *(Claude nas ações, qwen na tela)*
4. **Financeiro** — saldo por lojista, gerar repasse semanal (marca `Payout` + baixa na wallet), extrato geral, receita de comissões. *(Claude — dinheiro)*
5. **Configurações** — cidades, categorias de loja, banners da home, cupons da plataforma. *(qwen3-coder)*

### Critério de pronto
- [ ] Ciclo de onboarding real: loja se cadastra → aparece na fila → aprovada → vai à vitrine
- [ ] Repasse semanal: gerar payout zera o saldo e registra a transação
- [ ] Pedido preso aparece destacado no dashboard

---

<a id="etapa-9"></a>
## Etapa 9 — Deploy e lançamento piloto (4–6 dias + operação)

### Infra de produção (custo ~US$ 25–40/mês)

1. **VPS** (Hetzner CPX21 / DigitalOcean 4GB): Docker Compose com `api`, `web`, `postgres`, `redis` + **Caddy** como reverse proxy (SSL automático).
   - Domínios: `app.seudominio.com.br` (web) e `api.seudominio.com.br` (API).
2. **CI/CD** — GitHub Actions: push na `main` → build → testes → deploy por SSH (`docker compose up -d --build`). Migrations rodam no deploy (`prisma migrate deploy`).
3. **Backups** — `pg_dump` diário via cron + upload para R2/B2. **Testar o restore.**
4. **Observabilidade** — Sentry (API + web), UptimeRobot no `/api/health`, logs com rotação.
5. **Segurança** — rate limiting global (`@nestjs/throttler`), headers (helmet), firewall só 80/443/SSH, SSH por chave.

### Checklist de lançamento (produto)

- [ ] 15–30 lojistas âncora cadastrados e treinados (visita presencial: instalar o painel como PWA no celular/PC do caixa, testar um pedido junto)
- [ ] Política de privacidade e termos de uso publicados (LGPD)
- [ ] Grupo de WhatsApp de suporte aos lojistas (canal direto com você)
- [ ] Cupom de primeira compra configurado
- [ ] Teste de carga básico: 50 pedidos simultâneos sem erro (k6 ou artillery)
- [ ] Soft launch: 1 semana só com amigos/família pedindo de verdade antes da divulgação

---

<a id="fase-2"></a>
## Fase 2 — Etapas 10 a 12 (após validar a operação)

### Etapa 10 — PWA do entregador + matching (6–10 dias)
- Cadastro com upload de documentos → aprovação no admin.
- Online/offline; enquanto o PWA está aberto, envia posição a cada 15 s (`watchPosition`).
- **Matching em cascata** *(Claude)*: pedido `READY` com `deliveryMode: PLATFORM` → oferta ao entregador online mais próximo (WebSocket + push) → 20 s sem aceite → próximo da fila → ninguém aceitou → alerta no admin.
- Fluxo da corrida: aceitar → navegar (deep link Google Maps) → coletar → entregar (código de confirmação do cliente opcional).
- Carteira do entregador: crédito por corrida (transação `DELIVERY_FEE`), extrato, solicitar saque.

### Etapa 11 — Crescimento (contínuo)
- Cupons por loja + cupons da plataforma no checkout (a tabela já existe).
- Avaliações públicas na vitrine (média + contagem).
- Notificações de marketing segmentadas (push para quem não pede há 30 dias).
- Relatórios do lojista: itens mais vendidos, horários de pico, ticket médio.
- Agendamento de pedidos.

### Etapa 12 — Escala
- Multi-cidade de verdade (onboarding de nova cidade em < 1 dia: cadastrar cidade, aprovar lojas, definir frota).
- Cartão online (pré-autorização + captura no aceite).
- App na Play Store via Capacitor (mesmo código web) — resolve push iOS e localização em segundo plano do entregador.
- Corridas agrupadas (2 pedidos por rota) e incentivos de frota.

---

## Estimativa consolidada

| Etapa | Duração | Acumulado |
|---|---|---|
| 0 — Ambiente | 1 dia | semana 1 |
| 1 — Fundação backend | 2–3 dias | semana 1 |
| 2 — Auth | 4–6 dias | semana 2–3 |
| 3 — Lojas e catálogo | 5–8 dias | semana 3–4 |
| 4 — Pedidos + realtime | 6–10 dias | semana 5–6 |
| 5 — Painel lojista | 5–8 dias | semana 7–8 |
| 6 — PWA cliente | 8–12 dias | semana 9–10 |
| 7 — Pagamentos | 5–8 dias | semana 11 |
| 8 — Admin | 4–6 dias | semana 12 |
| 9 — Deploy + piloto | 4–6 dias | semana 13 |

**~3 meses para o MVP em produção** com 1 dev em tempo integral assistido por IA (Etapas 2+3 e 5+6 têm partes paralelizáveis se houver 2 devs). As estimativas assumem dedicação integral; em meio período, dobre.
