# Como Rodar o Projeto (guia autossuficiente)

Passo a passo para subir e operar o ambiente de desenvolvimento **sem ajuda externa**.
Projeto em `Desktop\Felipe\Claude\delivery-app`.

---

## 1. Subir o ambiente (toda vez que ligar o PC)

### 1.1 Docker (banco de dados e Redis)

1. Abra o **Docker Desktop** e espere o ícone da baleia ficar estável.
2. Abra um terminal na pasta do projeto e rode:
   ```bash
   cd delivery-app
   docker compose up -d
   ```
   > Os dados ficam salvos em volumes — parar/reiniciar o Docker **não apaga nada**.

### 1.2 API (terminal 1)

```bash
cd delivery-app
npm run dev:api
```
Espere aparecer: `API rodando em http://localhost:3001/api`.
**Deixe este terminal aberto** — é nele que aparecem os códigos OTP de login do cliente.

### 1.3 Site (terminal 2)

```bash
cd delivery-app
npm run dev:web
```
Espere: `Ready in ...s`. O site fica em http://localhost:3000.

### 1.4 Conferir que está tudo no ar

- http://localhost:3001/api/health → deve mostrar `{"status":"ok","db":true,"redis":true}`
- http://localhost:3000 → home do app do cliente

---

## 2. Acessos e logins de desenvolvimento

| Área | URL | Login |
|---|---|---|
| App do cliente | http://localhost:3000 | Celular + código OTP (ver 2.1) |
| Painel do lojista | http://localhost:3000/lojista | `ze@exemplo.dev` / `lojista123` |
| Painel do admin | http://localhost:3000/admin | `admin@exemplo.dev` / `admin123` |

### 2.1 Login do cliente (código OTP)

1. Em http://localhost:3000/entrar digite um celular com DDD e clique em "Receber código"
2. Olhe o **terminal da API** — vai aparecer uma linha assim:
   ```
   LOG [OtpService] [OTP mock] código para +5534999990000: 123456
   ```
3. Digite os 6 dígitos na tela. O código vale 5 minutos.

### 2.2 Pagamento Pix (simulado)

No checkout escolha **⚡ Pix** → na tela do pedido clique em **"🧪 Simular pagamento"**.
Só então o pedido aparece (com alarme) no painel do lojista.

---

## 3. Roteiro de teste completo (3 abas)

1. **Aba 1** — lojista: `/lojista` → tela **Pedidos** → clique uma vez na página (libera o som)
2. **Aba 2** — cliente: escolha a loja → monte o lanche → carrinho → checkout → confirme
3. O alarme toca na aba 1 → **Aceitar** → **Pronto** → **Saiu p/ entrega** → **Entregue**
4. Na aba 2 a timeline avança sozinha → avalie com estrelas
5. Veja o resultado em `/lojista/relatorios` (Hoje) e no dashboard do `/admin`

---

## 4. Comandos úteis

```bash
# ver/editar os dados do banco numa interface visual
npm run prisma:studio

# recriar os dados de exemplo (admin, Zé, Pizzaria, cardápio)
npm run db:seed

# aplicar mudanças de schema no banco (após editar schema.prisma)
npm run prisma:migrate

# testar a API sem interface: abra docs/requests.http no VS Code
# (extensão "REST Client") e clique em "Send Request" nos blocos
```

---

## 5. Problemas comuns e soluções

### "Porta 3000/3001 em uso" ou site respondendo errado após reiniciar

No Windows, às vezes um processo `node` antigo fica preso segurando a porta.
**Solução** (PowerShell):
```powershell
Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
Depois suba a API e o web de novo (passos 1.2 e 1.3).

### API com erro "connect ECONNREFUSED" ou health com db/redis false

O Docker não está rodando. Abra o Docker Desktop e rode `docker compose up -d`.

### Tela desatualizada / botão que deveria existir não aparece

Recarga forçada: **Ctrl + Shift + R** (às vezes 2×). Se persistir: F12 → aba
**Application** → **Service Workers** → **Unregister** → recarregue.

### Alarme de pedido não toca

O navegador exige uma interação antes de liberar áudio: clique em qualquer
lugar da tela de Pedidos uma vez. Verifique também o botão "🔔 Som ligado".

### "Cidade não atendida pela plataforma" ao cadastrar

A cidade foi desativada no admin. Vá em `/admin` → **Cidades** → ative-a.

### Código OTP não aparece no terminal

Confirme que está olhando o terminal da **API** (não o do site) e que a linha
contém `[OTP mock]`. Se pediu vários códigos, vale o **último**.

### Login caiu / "Sessão expirada"

Normal após muito tempo parado. Entre de novo. Cada área (cliente, lojista,
admin) tem sessão separada — deslogar de uma não afeta as outras.

### Quero zerar TUDO e começar do zero

```bash
docker compose down -v      # apaga o banco (CUIDADO: perde todos os dados)
docker compose up -d
npm run prisma:migrate
npm run db:seed
```

---

## 6. Salvando seu trabalho no GitHub

```bash
git add -A
git commit -m "descreva o que mudou"
git push
```
Repositório: https://github.com/roncalli/delivery-app
Todo push roda o build de verificação no GitHub Actions (aba Actions do repo).

---

## 7. Onde está cada documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/PASSO-A-PASSO.md` | Guia de desenvolvimento etapa por etapa (o que já foi feito e o que falta) |
| `docs/DEPLOY.md` | Como colocar em produção na VPS (com checklist de lançamento) |
| `docs/requests.http` | Coleção de requisições para testar a API no VS Code |
| `CLAUDE.md` | Convenções do código (para desenvolvimento assistido por IA) |
| `../estruturacao-sistema-delivery.md` | Planejamento de produto e negócio |
