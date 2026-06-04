# SCONT CRM WhatsApp

Módulo interno de atendimento via WhatsApp usando **Meta Cloud API Oficial**.

---

## Pré-requisitos

- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- Conta Supabase com projeto criado
- Conta Meta Business Suite com App WhatsApp Business criado
- Número de telefone dedicado homologado no Meta

---

## 1. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com os valores do seu projeto Supabase:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 2. Rodar a migration no Supabase

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push        # roda supabase/migrations/001_crm_schema.sql
```

---

## 3. Criar usuário admin

1. Acesse o **Supabase Dashboard** → Authentication → Users → **Add user**
2. Use o e-mail `herbertscont@gmail.com` e defina uma senha
3. Copie o UUID gerado
4. Execute no SQL Editor do Supabase:

```sql
INSERT INTO usuarios (auth_id, nome, email, departamento, role)
VALUES (
  'UUID-COPIADO-AQUI',
  'Herbert',
  'herbertscont@gmail.com',
  'PESSOAL',
  'ADMIN'
);
```

5. Rode o seed de tags:

```bash
supabase db seed   # ou execute supabase/seed.sql manualmente
```

---

## 4. Configurar Secrets das Edge Functions

```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=seu_token_permanente
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id
supabase secrets set WHATSAPP_VERIFY_TOKEN=token_aleatorio_seguro
supabase secrets set WHATSAPP_APP_SECRET=seu_app_secret
```

---

## 5. Deploy das Edge Functions

```bash
supabase functions deploy whatsapp-webhook
supabase functions deploy send-message
supabase functions deploy encerrar-conversa
supabase functions deploy transferir-conversa
```

---

## 6. Configurar webhook no Meta Business Suite

1. Acesse **Meta for Developers** → seu App → WhatsApp → Configuration
2. **Webhook URL:** `https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`
3. **Verify Token:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
4. **Subscribe to:** `messages`, `message_deliveries`, `message_reads`

---

## 7. Criar bucket de Storage

No Supabase Dashboard → Storage → **New bucket**:
- Nome: `crm-midias`
- Public bucket: ✓

---

## 8. Rodar o frontend

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`

---

## Estrutura do projeto

```
src/
  modules/crm/
    pages/          # CRMPage, MetricasPage, UsuariosPage
    components/     # ConversaList, ChatPanel, PainelDireito, shared
    hooks/          # useConversas, useMensagens, useRealtime, useWhatsApp
    services/       # crm.service.js
    contexts/       # CRMContext.jsx
  lib/
    supabaseClient.js

supabase/
  functions/        # 4 Edge Functions Deno
  migrations/       # 001_crm_schema.sql
  seed.sql
```

---

## Departamentos

| Departamento | Cor |
|---|---|
| Pessoal | Azul `#3B82F6` |
| Contábil | Verde `#10B981` |
| Administrativo | Âmbar `#F59E0B` |
| Tributário | Violeta `#8B5CF6` |

---

## Notas de segurança

- **Nunca commite** `.env.local` ou qualquer arquivo com tokens
- O webhook valida a assinatura `X-Hub-Signature-256` em todas as requisições POST
- RLS está habilitado em todas as tabelas — agentes só acessam seu próprio departamento
- `SUPABASE_SERVICE_ROLE_KEY` só é usada nas Edge Functions, nunca no frontend
