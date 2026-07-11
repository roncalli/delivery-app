# Deploy em Produção — Passo a Passo

Guia para colocar a plataforma no ar numa VPS única com Docker + Caddy (SSL automático).
Custo estimado: **US$ 8–25/mês** (VPS) + **~R$ 40/ano** (domínio).

## Pré-requisitos (fazer uma vez)

1. **VPS**: Hetzner CPX21 (recomendado), DigitalOcean 4GB ou Contabo — Ubuntu 24.04, mínimo 4 GB RAM.
2. **Domínio**: registre (ex.: registro.br) e crie 2 registros DNS tipo A apontando para o IP da VPS:
   - `app.seudominio.com.br` → IP da VPS (site/PWA)
   - `api.seudominio.com.br` → IP da VPS (API)
3. **Conta Asaas** (asaas.com): pegue a API key do **sandbox** primeiro; produção só após validar.

## 1. Preparar a VPS

```bash
ssh root@IP_DA_VPS

# Docker
curl -fsSL https://get.docker.com | sh

# Firewall: só SSH, HTTP e HTTPS
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Usuário de deploy (evitar root no dia a dia)
adduser deploy && usermod -aG docker deploy
```

> Recomendado: desabilitar login por senha no SSH (`PasswordAuthentication no` em
> `/etc/ssh/sshd_config`) e usar só chave.

## 2. Clonar e configurar

```bash
mkdir -p /opt/delivery-app && chown deploy /opt/delivery-app
su - deploy
git clone https://github.com/roncalli/delivery-app.git /opt/delivery-app
cd /opt/delivery-app

cp .env.prod.example .env
nano .env   # preencher domínios, senhas fortes, chaves do Asaas
```

Gerar segredos fortes: `openssl rand -base64 48` (JWT_SECRET, POSTGRES_PASSWORD, ASAAS_WEBHOOK_TOKEN).

## 3. Subir

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api   # acompanhar o boot
```

O Caddy emite os certificados SSL sozinho no primeiro acesso (DNS precisa já estar propagado).

**Smoke test:**
- `https://api.SEU_DOMINIO/api/health` → `{"status":"ok","db":true,"redis":true}`
- `https://app.SEU_DOMINIO` → home do cliente
- `https://app.SEU_DOMINIO/lojista` e `/admin` → painéis

## 4. Dados iniciais

```bash
# criar o admin e a cidade-piloto direto no banco:
docker compose -f docker-compose.prod.yml exec api npx ts-node prisma/seed.ts  # NÃO use o seed de dev em produção real
```

> Em produção de verdade: crie o usuário ADMIN manualmente (Prisma Studio via túnel SSH
> ou SQL) e cadastre a cidade pelo painel admin. Troque as senhas do seed imediatamente.

## 5. Webhook do Asaas

No painel do Asaas → Integrações → Webhooks:
- URL: `https://api.SEU_DOMINIO/api/payments/webhook`
- Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN` do `.env`
- Eventos: cobranças (PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_REFUNDED)

Antes do lançamento, faça um pedido Pix real de R$ 1 no sandbox e confirme o ciclo completo.

## 6. Deploy automático (CI/CD)

No GitHub (repo → Settings → Secrets and variables → Actions):
- **Secrets**: `VPS_HOST` (IP), `VPS_USER` (deploy), `VPS_SSH_KEY` (chave privada)
- **Variables**: `DEPLOY_ENABLED` = `true`

A partir daí, todo push na `main` builda e faz deploy sozinho (workflow `ci.yml`).

## 7. Backup e monitoramento

```bash
# backup diário às 3h (como usuário deploy):
chmod +x /opt/delivery-app/deploy/backup.sh
crontab -e
# adicionar:
0 3 * * * /opt/delivery-app/deploy/backup.sh >> /var/log/delivery-backup.log 2>&1
```

- **Teste o restore** uma vez: `pg_restore -U delivery -d delivery_teste backups/delivery-XXX.dump`
- **UptimeRobot** (grátis): monitor HTTP em `https://api.SEU_DOMINIO/api/health` com keyword `"ok"`
- **Sentry**: criar projeto e preencher `SENTRY_DSN` (integração pendente no código — TODO)

## Checklist de lançamento

- [ ] Pedido Pix real (sandbox) confirmado ponta a ponta
- [ ] Pedido "na entrega" operado pelo painel do lojista no celular do lojista
- [ ] 15–30 lojistas âncora cadastrados, aprovados e treinados (visita presencial)
- [ ] Painel do lojista instalado como PWA no dispositivo de cada loja
- [ ] Política de privacidade e termos de uso publicados (LGPD)
- [ ] Grupo de WhatsApp de suporte aos lojistas criado
- [ ] Backup testado (restore funciona)
- [ ] UptimeRobot ativo com alerta no seu e-mail/celular
- [ ] Soft launch: 1 semana com amigos/família pedindo de verdade
- [ ] Trocar OTP mock por WhatsApp/SMS (obrigatório para clientes reais!)

## Pendências conhecidas para produção plena

| Item | Onde | Prioridade |
|---|---|---|
| Provider real de OTP (WhatsApp/SMS) | `OtpService` | **Bloqueante** — sem isso cliente não loga |
| Validar AsaasGateway em sandbox + coleta de CPF no checkout | `AsaasGateway`, checkout | **Bloqueante** para Pix real |
| Sentry (erros) | API + web | Alta |
| Imagens em R2/S3 (hoje: volume local) | `UploadsService` | Média |
| Web Push (VAPID) | notifications | Média |
| Testes unitários (delegar ao qwen3-coder) | módulos críticos | Média |
