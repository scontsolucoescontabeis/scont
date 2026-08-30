# Evolution API — canal WhatsApp via QR Code

Stack Docker que mantém a sessão do WhatsApp Web (Baileys) para o canal
`QR_CODE` do CRM. As Edge Functions `evolution-connect` / `evolution-webhook`
falam com ela por REST + webhook.

## Fase 1 — teste na máquina local

Pré-requisitos: Docker Desktop ligado.

```bash
cd "Projeto CRM/evolution"

# 1. Sobe Evolution API + Postgres + Redis
docker compose up -d

# 2. Túnel HTTPS público para o localhost:8080
#    (a URL muda a cada reinício — anote e atualize o secret EVOLUTION_API_URL)
./cloudflared.exe tunnel --url http://localhost:8080 --no-autoupdate
```

Os segredos ficam em `evolution/.env` (não versionado). Se precisar regerar:

```bash
openssl rand -hex 24   # EVOLUTION_API_KEY / EVOLUTION_WEBHOOK_TOKEN
```

### Secrets no Supabase (projeto `dsdqwigopzrdmxtmhsez`)

```bash
supabase secrets set --project-ref dsdqwigopzrdmxtmhsez \
  EVOLUTION_API_URL=<url-do-cloudflared> \
  EVOLUTION_API_KEY=<EVOLUTION_API_KEY do .env> \
  EVOLUTION_INSTANCE_NAME=scont-crm \
  EVOLUTION_WEBHOOK_TOKEN=<EVOLUTION_WEBHOOK_TOKEN do .env>
```

### Deploy das Edge Functions

```bash
supabase functions deploy evolution-connect evolution-webhook send-message \
  --project-ref dsdqwigopzrdmxtmhsez
```

### Uso

1. Login como ADMIN no CRM → **Conexão WhatsApp**.
2. Canal ativo = "QR Code" → **Gerar QR Code**.
3. Celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → escanear.

## Fase 2 — servidor do escritório

Mesmo `docker-compose.yml`. Diferenças:

- URL fixa: túnel nomeado do Cloudflare (com domínio próprio) ou Caddy/Traefik
  como proxy HTTPS na frente da porta 8080.
- Atualizar só o secret `EVOLUTION_API_URL` e o `SERVER_URL` no `.env`.
- Reescanear o QR (sessão nova) — nenhuma mudança de código.

## Operação

```bash
docker compose logs -f evolution-api   # logs
docker compose down                    # para (WhatsApp desconecta)
docker compose up -d                   # sobe de novo (sessão persiste no volume)
```

Para zerar tudo (perde a sessão): `docker compose down -v`.
