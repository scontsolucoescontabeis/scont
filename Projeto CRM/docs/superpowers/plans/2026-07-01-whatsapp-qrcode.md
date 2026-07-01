# Conexão WhatsApp via QR Code — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um segundo canal de envio/recebimento WhatsApp (QR Code via Evolution API) ao CRM, alternável por um switch global, sem alterar o comportamento existente da API oficial da Meta.

**Architecture:** Um serviço Evolution API (Node.js + Baileys, Docker, hospedagem a definir) mantém a sessão WhatsApp Web. Ele fala com o Supabase só por REST (Edge Functions chamando a Evolution API) e webhook (Evolution API chamando uma nova Edge Function `evolution-webhook`). Uma tabela singleton `whatsapp_config` guarda o canal ativo e o status da conexão; o frontend assina essa tabela via Realtime. `send-message` passa a rotear o envio conforme `canal_ativo`. Nenhuma mudança é necessária em `ChatPanel`/`ConversaList`/`InputBar` — o chat já opera sobre `conversas`/`mensagens`, agnóstico de canal.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), PostgreSQL + RLS, React 18 hooks + Realtime, Evolution API (externa, REST + webhook).

**Referência:** `docs/superpowers/specs/2026-07-01-whatsapp-qrcode-design.md`

## Global Constraints

- Nenhuma lógica de negócio do CRM roda fora de Edge Functions/Supabase — o único processo novo fora dessa fronteira é o serviço Evolution API em si (infra de conexão, não lógica de CRM).
- `canal_ativo` é uma configuração global única (não por conversa/departamento/agente).
- A integração com a API oficial da Meta (`whatsapp-webhook`, `send-message` ramo `API_OFICIAL`) não pode ter seu comportamento alterado — apenas ganha um branch novo ao lado.
- Zero mudanças em `ChatPanel`, `ConversaList`, `InputBar` ou qualquer componente de chat existente.
- Paleta SCONT: bordô `#7a1e1e` (ações primárias/ativo), `#2d7a4f` (ok/conectado), `#b83232` (erro/desconectado), `#b87a00` (aviso/conectando); títulos em `Merriweather, serif`; corpo em `DM Sans, sans-serif`.
- Este repositório não tem harness de teste automatizado para Edge Functions Deno (nenhuma existe hoje em `supabase/functions/`). A verificação dessas funções segue o padrão já usado no projeto (`dev-message`/`whatsapp-webhook`): rodar `supabase functions serve` localmente e testar com `curl`, checando o resultado no banco. Para lógica pura extraível no frontend, seguimos o padrão de `ModalImportarPlanilha.jsx`/`.test.jsx` (função pura exportada + teste Vitest).

---

### Task 1: Migration `whatsapp_config`

**Files:**
- Create: `supabase/migrations/018_whatsapp_channel.sql`

**Interfaces:**
- Produces: tabela `whatsapp_config` (colunas `id`, `canal_ativo` enum `QR_CODE`|`API_OFICIAL`, `status_conexao` enum `DESCONECTADO`|`CONECTANDO`|`CONECTADO`, `qrcode_base64` text nullable, `atualizado_em` timestamptz), linha singleton `id = 1`, replicada no Realtime. Usada por todas as tasks seguintes.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/018_whatsapp_channel.sql
CREATE TYPE canal_whatsapp_enum AS ENUM ('QR_CODE', 'API_OFICIAL');
CREATE TYPE status_conexao_whatsapp_enum AS ENUM ('DESCONECTADO', 'CONECTANDO', 'CONECTADO');

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id             INT PRIMARY KEY DEFAULT 1,
  canal_ativo    canal_whatsapp_enum NOT NULL DEFAULT 'QR_CODE',
  status_conexao status_conexao_whatsapp_enum NOT NULL DEFAULT 'DESCONECTADO',
  qrcode_base64  TEXT,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_config_singleton CHECK (id = 1)
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_config_read"  ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_write" ON whatsapp_config;

CREATE POLICY "whatsapp_config_read" ON whatsapp_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "whatsapp_config_write" ON whatsapp_config
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'ADMIN')
  );

INSERT INTO whatsapp_config (id, canal_ativo, status_conexao)
VALUES (1, 'QR_CODE', 'DESCONECTADO')
ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_config;
```

- [ ] **Step 2: Rodar a migration no Supabase (SQL Editor do projeto Portal) e verificar**

Rode o conteúdo do arquivo no SQL Editor do Supabase. Depois verifique:

```sql
SELECT * FROM whatsapp_config;
```

Expected: uma linha, `id = 1`, `canal_ativo = 'QR_CODE'`, `status_conexao = 'DESCONECTADO'`, `qrcode_base64 = NULL`.

```sql
-- confere que um usuário não-admin não consegue escrever (rode autenticado como AGENTE via Studio "Run as user", se disponível; senão, apenas documente e siga)
UPDATE whatsapp_config SET canal_ativo = 'API_OFICIAL' WHERE id = 1;
```

Expected (como ADMIN): sucesso, 1 linha afetada. Reverta com `UPDATE whatsapp_config SET canal_ativo = 'QR_CODE' WHERE id = 1;` antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/018_whatsapp_channel.sql
git commit -m "feat: adiciona tabela whatsapp_config para canal QR Code/API Oficial"
```

---

### Task 2: Extrair helper compartilhado `_shared/mensagens.ts`

Refatoração pontual: hoje `obterOuCriarContato`/`obterOuCriarConversa` vivem só dentro de `whatsapp-webhook/index.ts`. A nova `evolution-webhook` (Task 3) precisa da mesma lógica — em vez de duplicar, extraímos para um módulo compartilhado. Comportamento observável de `whatsapp-webhook` não muda.

**Files:**
- Create: `supabase/functions/_shared/mensagens.ts`
- Modify: `supabase/functions/whatsapp-webhook/index.ts:27-84,119-128,221-222`

**Interfaces:**
- Produces: `obterOuCriarContato(supabase, telefone: string, nome?: string) => Promise<Contato>`, `obterOuCriarConversa(supabase, contatoId: string) => Promise<{ conversa, isNova }>`, `salvarMensagemRecebida(supabase, { conversaId, conteudo, tipo?, mediaUrl?, whatsappMsgId? }) => Promise<Mensagem>`. Consumidos por `whatsapp-webhook` (este task) e `evolution-webhook` (Task 3).

- [ ] **Step 1: Criar o módulo compartilhado**

```ts
// supabase/functions/_shared/mensagens.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function obterOuCriarContato(supabase: SupabaseClient, telefone: string, nome?: string) {
  // telefone vem como dígitos puros do Meta / Evolution API / simulador (ex: 5511999999999)
  const digits = telefone.replace(/\D/g, '')
  const variantes = [...new Set([
    digits,
    '+' + digits,
    digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : null,
    '+55' + (digits.startsWith('55') ? digits.slice(2) : digits),
  ].filter(Boolean) as string[])]

  const { data: existentes } = await supabase
    .from('contatos')
    .select('*, contatos_empresas(id)')
    .in('telefone', variantes)

  if (existentes && existentes.length > 0) {
    const comEmpresas = existentes.find(
      (c: Record<string, unknown>) => Array.isArray(c.contatos_empresas) && (c.contatos_empresas as unknown[]).length > 0
    )
    return comEmpresas ?? existentes[0]
  }

  const { data: novo } = await supabase
    .from('contatos')
    .insert({ telefone: digits, nome: nome || digits })
    .select()
    .single()

  return novo
}

export async function obterOuCriarConversa(supabase: SupabaseClient, contatoId: string) {
  const { data: existente } = await supabase
    .from('conversas')
    .select('*')
    .eq('contato_id', contatoId)
    .in('status', ['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO'])
    .order('aberto_em', { ascending: false })
    .limit(1)
    .single()

  if (existente) return { conversa: existente, isNova: false }

  const { data: nova } = await supabase
    .from('conversas')
    .insert({
      contato_id: contatoId,
      departamento: 'PESSOAL',
      status: 'ABERTA',
    })
    .select()
    .single()

  return { conversa: nova, isNova: true }
}

export async function salvarMensagemRecebida(supabase: SupabaseClient, opts: {
  conversaId: string
  conteudo: string | null
  tipo?: string
  mediaUrl?: string | null
  whatsappMsgId?: string | null
}) {
  const { data, error } = await supabase.from('mensagens').insert({
    conversa_id:     opts.conversaId,
    conteudo:        opts.conteudo,
    tipo:            opts.tipo || 'text',
    media_url:       opts.mediaUrl ?? null,
    whatsapp_msg_id: opts.whatsappMsgId ?? null,
    origem:          'CLIENTE',
    lida:            false,
  }).select().single()
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Atualizar `whatsapp-webhook/index.ts` para usar o módulo compartilhado**

Remova as funções locais `obterOuCriarContato` (linhas 27-58 do arquivo atual) e `obterOuCriarConversa` (linhas 60-84), e importe do módulo novo:

```ts
// no topo do arquivo, junto aos outros imports
import { obterOuCriarContato, obterOuCriarConversa, salvarMensagemRecebida } from '../_shared/mensagens.ts'
```

Atualize a chamada dentro do `serve(...)` (era `obterOuCriarContato(telefone, ...)` / `obterOuCriarConversa(contato.id, telefone)`):

```ts
const contato = await obterOuCriarContato(supabase, telefone, (value?.contacts?.[0]?.profile?.name as string) || undefined)
const { conversa } = await obterOuCriarConversa(supabase, contato.id)
```

Dentro de `processarMensagem`, troque o insert direto em `mensagens` por:

```ts
  // Salva mensagem do cliente SEMPRE — antes do bot responder
  await salvarMensagemRecebida(supabase, {
    conversaId: (conversa as { id: string }).id,
    conteudo,
    tipo,
    mediaUrl,
    whatsappMsgId: msg.id as string,
  })
```

O restante do arquivo (`processarMensagem`, `baixarEGuardarMidia`, validação de assinatura, dev bypass, chamada ao `chatbot-processor`) permanece inalterado.

- [ ] **Step 3: Verificar que o comportamento não mudou (regressão manual)**

Rode localmente:

```bash
supabase functions serve whatsapp-webhook --env-file supabase/.env.local
```

Em outro terminal, simule uma mensagem recebida (ajuste `DEV_BYPASS_TOKEN` para o valor configurado localmente):

```bash
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -H "X-Dev-Bypass-Token: SEU_DEV_BYPASS_TOKEN" \
  -d '{
    "entry": [{ "changes": [{ "value": {
      "messages": [{ "id": "test-1", "from": "5561999990000", "type": "text", "text": { "body": "oi" } }],
      "contacts": [{ "profile": { "name": "Teste Regressão" } }]
    }}]}]
  }'
```

Expected: `200 OK` com JSON `{ "ok": true, "conversa_id": "...", "contato_id": "...", "protocolo": "SCT-..." }` (mesmo shape de antes da refatoração).

```sql
-- no SQL Editor
SELECT nome, telefone FROM contatos WHERE telefone = '5561999990000';
SELECT conteudo, origem FROM mensagens WHERE conteudo = 'oi' ORDER BY criado_em DESC LIMIT 1;
```

Expected: contato "Teste Regressão" criado, mensagem "oi" com `origem = 'CLIENTE'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/mensagens.ts supabase/functions/whatsapp-webhook/index.ts
git commit -m "refactor: extrai upsert de contato/conversa/mensagem para _shared/mensagens.ts"
```

---

### Task 3: Edge Function `evolution-webhook`

Recebe eventos da Evolution API (mensagem recebida, mudança de conexão, QR atualizado) e aplica o mesmo fluxo de `whatsapp-webhook`, via o helper compartilhado.

**Files:**
- Create: `supabase/functions/evolution-webhook/index.ts`
- Modify: `supabase/config.toml` (adiciona `verify_jwt = false` para esta função, como já existe para `whatsapp-webhook`)

**Interfaces:**
- Consumes: `obterOuCriarContato`, `obterOuCriarConversa`, `salvarMensagemRecebida` de `../_shared/mensagens.ts` (Task 2).
- Produces: endpoint público `POST /functions/v1/evolution-webhook?token=<EVOLUTION_WEBHOOK_TOKEN>`. Consumido pela Evolution API (configurada em Task 5) e pelos testes manuais deste task.

- [ ] **Step 1: Criar a Edge Function**

```ts
// supabase/functions/evolution-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { obterOuCriarContato, obterOuCriarConversa, salvarMensagemRecebida } from '../_shared/mensagens.ts'

const SB_URL         = Deno.env.get('SUPABASE_URL')!
const SB_KEY          = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_TOKEN   = Deno.env.get('EVOLUTION_WEBHOOK_TOKEN')!

const supabase = createClient(SB_URL, SB_KEY)

function normalizarEvento(nome: string): string {
  return (nome || '').toUpperCase().replace(/\./g, '_')
}

function extrairDigits(remoteJid: string): string {
  return (remoteJid || '').replace('@s.whatsapp.net', '').replace(/\D/g, '')
}

function extrairTexto(msg: Record<string, unknown>): string | null {
  const message = msg?.message as Record<string, unknown> | undefined
  if (!message) return null
  if (typeof message.conversation === 'string') return message.conversation
  const extended = message.extendedTextMessage as { text?: string } | undefined
  if (extended?.text) return extended.text
  return null
}

async function processarMensagensRecebidas(data: Record<string, unknown>) {
  const rawMessages = Array.isArray((data as { messages?: unknown[] }).messages)
    ? (data as { messages: Record<string, unknown>[] }).messages
    : [data]

  for (const msg of rawMessages) {
    const key = msg?.key as { remoteJid?: string; fromMe?: boolean; id?: string } | undefined
    if (!key?.remoteJid || key.fromMe) continue // ignora eco de mensagens enviadas por nós mesmos

    const texto = extrairTexto(msg)
    if (texto === null) continue // mídia/tipos não suportados nesta primeira versão

    const digits = extrairDigits(key.remoteJid)
    const nomeContato = (msg.pushName as string) || digits

    const contato = await obterOuCriarContato(supabase, digits, nomeContato)
    const { conversa } = await obterOuCriarConversa(supabase, contato.id)

    await salvarMensagemRecebida(supabase, {
      conversaId: (conversa as { id: string }).id,
      conteudo: texto,
      tipo: 'text',
      whatsappMsgId: key.id ?? null,
    })
  }
}

async function processarAtualizacaoConexao(data: Record<string, unknown>) {
  const estado = (data?.state as string) || ''
  const mapa: Record<string, string> = { open: 'CONECTADO', connecting: 'CONECTANDO', close: 'DESCONECTADO' }
  const status = mapa[estado]
  if (!status) return

  const update: Record<string, unknown> = { status_conexao: status, atualizado_em: new Date().toISOString() }
  if (status === 'CONECTADO') update.qrcode_base64 = null

  await supabase.from('whatsapp_config').update(update).eq('id', 1)
}

async function processarQrCodeAtualizado(data: Record<string, unknown>) {
  const qrcode = data?.qrcode as { base64?: string } | undefined
  if (!qrcode?.base64) return

  await supabase
    .from('whatsapp_config')
    .update({ qrcode_base64: qrcode.base64, status_conexao: 'CONECTANDO', atualizado_em: new Date().toISOString() })
    .eq('id', 1)
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(req.url)
  if (url.searchParams.get('token') !== WEBHOOK_TOKEN) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const payload = await req.json()
    const evento = normalizarEvento(payload?.event as string)
    const data = (payload?.data as Record<string, unknown>) || {}

    if (evento === 'MESSAGES_UPSERT') {
      await processarMensagensRecebidas(data)
    } else if (evento === 'CONNECTION_UPDATE') {
      await processarAtualizacaoConexao(data)
    } else if (evento === 'QRCODE_UPDATED') {
      await processarQrCodeAtualizado(data)
    }
  } catch (err) {
    console.error('Erro ao processar evolution-webhook:', err)
  }

  return new Response('OK', { status: 200 })
})
```

**Nota:** os nomes de evento/campos (`MESSAGES_UPSERT`, `key.remoteJid`, `qrcode.base64` etc.) seguem a API v2 documentada da Evolution API. Como o serviço ainda não está hospedado neste projeto, valide esses nomes contra a versão realmente implantada assim que ela estiver no ar (Task 5, Step 4) — se algum evento não bater, ajuste `normalizarEvento`/os extratores.

- [ ] **Step 2: Adicionar entrada em `supabase/config.toml`**

```toml
[functions.evolution-webhook]
verify_jwt = false
```

- [ ] **Step 3: Testar localmente com eventos simulados**

```bash
supabase functions serve evolution-webhook --env-file supabase/.env.local
```

Simule uma mensagem recebida:

```bash
curl -X POST "http://localhost:54321/functions/v1/evolution-webhook?token=SEU_EVOLUTION_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "scont-crm",
    "data": {
      "key": { "remoteJid": "5561988887777@s.whatsapp.net", "fromMe": false, "id": "3EB0TEST" },
      "message": { "conversation": "oi via qr code" },
      "pushName": "Teste QR"
    }
  }'
```

Expected: `200 OK` (corpo `"OK"`). Depois:

```sql
SELECT nome, telefone FROM contatos WHERE telefone = '5561988887777';
SELECT conteudo, origem FROM mensagens WHERE conteudo = 'oi via qr code';
```

Expected: contato "Teste QR" criado, mensagem salva com `origem = 'CLIENTE'`.

Simule uma atualização de conexão:

```bash
curl -X POST "http://localhost:54321/functions/v1/evolution-webhook?token=SEU_EVOLUTION_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "event": "connection.update", "instance": "scont-crm", "data": { "state": "open" } }'
```

Expected: `200 OK`. Depois:

```sql
SELECT status_conexao, qrcode_base64 FROM whatsapp_config WHERE id = 1;
```

Expected: `status_conexao = 'CONECTADO'`, `qrcode_base64 = NULL`.

Teste também o token errado:

```bash
curl -i -X POST "http://localhost:54321/functions/v1/evolution-webhook?token=errado" \
  -H "Content-Type: application/json" -d '{}'
```

Expected: `403 Forbidden`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/evolution-webhook supabase/config.toml
git commit -m "feat: adiciona evolution-webhook para receber mensagens/status via QR Code"
```

---

### Task 4: Roteamento de canal em `send-message`

**Files:**
- Modify: `supabase/functions/send-message/index.ts:74-103` (bloco de envio via Meta Cloud API)

**Interfaces:**
- Consumes: tabela `whatsapp_config` (Task 1), secrets `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE_NAME` (documentados/definidos na Task 5).
- Produces: comportamento inalterado quando `canal_ativo = API_OFICIAL`; novo envio via Evolution API quando `canal_ativo = QR_CODE`.

- [ ] **Step 1: Substituir o bloco de envio por um roteamento de canal**

No arquivo `supabase/functions/send-message/index.ts`, logo após a checagem `if (!telefone) { ... }` (linha 67-72 atual) e antes do bloco `// Envia via Meta Cloud API` (linha 74), insira a leitura do canal:

```ts
    // Decide o canal de envio (QR Code via Evolution API ou API Oficial da Meta)
    const { data: whatsappConfig } = await supabaseAdmin
      .from('whatsapp_config')
      .select('canal_ativo')
      .eq('id', 1)
      .single()
    const canal = whatsappConfig?.canal_ativo || 'API_OFICIAL'

    let whatsappMsgId: string | undefined

    if (canal === 'QR_CODE') {
      const EVOLUTION_API_URL       = Deno.env.get('EVOLUTION_API_URL')
      const EVOLUTION_API_KEY       = Deno.env.get('EVOLUTION_API_KEY')
      const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME')

      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
        return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const evoRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
        method: 'POST',
        headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: telefone, text: conteudo }),
      })
      const evoData = await evoRes.json()

      if (!evoRes.ok) {
        console.error('Erro Evolution API:', evoData)
        return new Response(JSON.stringify({ error: 'Falha ao enviar via QR Code', detail: evoData }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      whatsappMsgId = evoData?.key?.id
    } else {
      // Envia via Meta Cloud API
      const metaRes = await fetch(
        `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: telefone,
            type: tipo,
            text: tipo === 'text' ? { body: conteudo } : undefined,
          }),
        }
      )

      const metaData = await metaRes.json()

      if (!metaRes.ok) {
        console.error('Erro Meta API:', metaData)
        return new Response(JSON.stringify({ error: 'Falha ao enviar para WhatsApp', detail: metaData }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      whatsappMsgId = metaData?.messages?.[0]?.id
    }
```

Remova o bloco antigo (linhas 74-103 do arquivo original: `// Envia via Meta Cloud API` até `const whatsappMsgId = metaData?.messages?.[0]?.id`), já incorporado acima. O restante do arquivo (insert em `mensagens`, update de `conversas`, resposta HTTP) permanece igual, usando a mesma variável `whatsappMsgId`.

- [ ] **Step 2: Verificar o ramo `API_OFICIAL` (comportamento inalterado)**

```sql
SELECT canal_ativo FROM whatsapp_config WHERE id = 1; -- deve ser 'QR_CODE' após a Task 1; ajuste para testar cada ramo
UPDATE whatsapp_config SET canal_ativo = 'API_OFICIAL' WHERE id = 1;
```

```bash
supabase functions serve send-message --env-file supabase/.env.local
curl -X POST http://localhost:54321/functions/v1/send-message \
  -H "Authorization: Bearer SEU_JWT_DE_AGENTE" \
  -H "Content-Type: application/json" \
  -d '{ "conversa_id": "UUID_DE_UMA_CONVERSA_EXISTENTE", "conteudo": "teste api oficial" }'
```

Expected: mesmo resultado de antes da mudança — sucesso se `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` estiverem configurados e válidos, ou erro 502 da Meta se não (não deve mudar por causa desta task).

- [ ] **Step 3: Verificar o ramo `QR_CODE` sem Evolution API configurada (erro claro, não quebra)**

```sql
UPDATE whatsapp_config SET canal_ativo = 'QR_CODE' WHERE id = 1;
```

Rode o mesmo `curl` do Step 2 (sem `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE_NAME` definidos localmente).

Expected: `500` com `{ "error": "Evolution API não configurada" }` — falha explícita, sem crash da function.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-message/index.ts
git commit -m "feat: roteia envio de mensagem por canal_ativo (QR Code ou API Oficial)"
```

---

### Task 5: Edge Function `evolution-connect`

Admin-only: cria/reconecta a instância na Evolution API e devolve o QR Code, gravando em `whatsapp_config`.

**Files:**
- Create: `supabase/functions/evolution-connect/index.ts`

**Interfaces:**
- Consumes: tabela `usuarios` (checagem de `role = 'ADMIN'`), tabela `whatsapp_config` (Task 1), secrets `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE_NAME`/`EVOLUTION_WEBHOOK_TOKEN`.
- Produces: endpoint `POST /functions/v1/evolution-connect` (JWT obrigatório), resposta `{ ok: true, qrcode_base64: string }` ou `{ error: string }`. Consumido pelo hook `useWhatsAppConexao` (Task 6).

- [ ] **Step 1: Criar a Edge Function**

```ts
// supabase/functions/evolution-connect/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL         = Deno.env.get('SUPABASE_URL')!
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SB_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!

const supabaseAdmin = createClient(SB_URL, SB_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extrairQrCodeBase64(body: Record<string, unknown>): string | null {
  const direto = body?.base64 as string | undefined
  const aninhado = (body?.qrcode as { base64?: string } | undefined)?.base64
  return direto || aninhado || null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(SB_URL, SB_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: perfil } = await supabaseAdmin
      .from('usuarios')
      .select('role')
      .eq('id', user.id)
      .single()

    if (perfil?.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem gerenciar a conexão' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const EVOLUTION_API_URL       = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY       = Deno.env.get('EVOLUTION_API_KEY')
    const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME')
    const EVOLUTION_WEBHOOK_TOKEN = Deno.env.get('EVOLUTION_WEBHOOK_TOKEN')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      return new Response(JSON.stringify({
        error: 'Evolution API não configurada (EVOLUTION_API_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE_NAME ausentes)',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin
      .from('whatsapp_config')
      .update({ status_conexao: 'CONECTANDO', atualizado_em: new Date().toISOString() })
      .eq('id', 1)

    // Tenta reconectar uma instância já existente
    let qrBase64: string | null = null
    const connectRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE_NAME}`, {
      headers: { apikey: EVOLUTION_API_KEY },
    })

    if (connectRes.ok) {
      qrBase64 = extrairQrCodeBase64(await connectRes.json())
    } else {
      // Instância ainda não existe — cria já com o webhook configurado
      const webhookUrl = `${SB_URL}/functions/v1/evolution-webhook?token=${EVOLUTION_WEBHOOK_TOKEN}`
      const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: EVOLUTION_INSTANCE_NAME,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: { url: webhookUrl, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'] },
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        console.error('Erro Evolution API (create):', createData)
        return new Response(JSON.stringify({ error: 'Falha ao criar instância na Evolution API', detail: createData }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      qrBase64 = extrairQrCodeBase64(createData)
    }

    if (!qrBase64) {
      return new Response(JSON.stringify({ error: 'Evolution API não retornou QR Code' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin
      .from('whatsapp_config')
      .update({ qrcode_base64: qrBase64, status_conexao: 'CONECTANDO', atualizado_em: new Date().toISOString() })
      .eq('id', 1)

    return new Response(JSON.stringify({ ok: true, qrcode_base64: qrBase64 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro evolution-connect:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Nota:** os endpoints `/instance/connect/{instance}` e `/instance/create` e o formato de resposta do QR (`base64` direto ou aninhado em `qrcode.base64`) seguem a API v2 documentada da Evolution API — valide contra a versão realmente implantada (Step 4 abaixo).

- [ ] **Step 2: Verificar rejeição sem JWT e para não-admin**

```bash
supabase functions serve evolution-connect --env-file supabase/.env.local
curl -i -X POST http://localhost:54321/functions/v1/evolution-connect
```

Expected: `401` `{ "error": "Não autorizado" }`.

```bash
curl -i -X POST http://localhost:54321/functions/v1/evolution-connect \
  -H "Authorization: Bearer JWT_DE_UM_AGENTE_NAO_ADMIN"
```

Expected: `403` `{ "error": "Apenas administradores podem gerenciar a conexão" }`.

- [ ] **Step 3: Verificar erro claro sem Evolution API configurada**

Com um JWT de ADMIN válido, sem `EVOLUTION_API_URL` definida localmente:

```bash
curl -i -X POST http://localhost:54321/functions/v1/evolution-connect \
  -H "Authorization: Bearer JWT_DE_UM_ADMIN"
```

Expected: `500` `{ "error": "Evolution API não configurada (...)" }`.

- [ ] **Step 4: Verificar contra a Evolution API real, assim que hospedada**

Defina os secrets (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`, `EVOLUTION_WEBHOOK_TOKEN`) apontando para a instância Docker real e repita o `curl` do Step 3 com um JWT de ADMIN.

Expected: `200` com `{ "ok": true, "qrcode_base64": "data:image/png;base64,..." }`. Se o corpo de resposta da Evolution API não bater com `extrairQrCodeBase64`, ajuste a função com base no corpo real retornado (visível no log `console.error` se `createRes`/`connectRes` não for `ok`, ou inspecionando a resposta manualmente).

```sql
SELECT status_conexao, qrcode_base64 IS NOT NULL AS tem_qrcode FROM whatsapp_config WHERE id = 1;
```

Expected: `status_conexao = 'CONECTANDO'`, `tem_qrcode = true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/evolution-connect
git commit -m "feat: adiciona evolution-connect para gerar QR Code (admin-only)"
```

---

### Task 6: Frontend — página "Conexão WhatsApp"

**Files:**
- Modify: `src/services/crm.service.js` (adiciona `buscarWhatsAppConfig`, `salvarCanalWhatsApp`)
- Create: `src/hooks/useWhatsAppConexao.js`
- Create: `src/pages/ConexaoWhatsAppPage.jsx`
- Create: `src/pages/ConexaoWhatsAppPage.test.jsx`
- Modify: `src/App.jsx:1-14` (imports), `:193-211` (sidebar), `:341-352` (rotas)

**Interfaces:**
- Consumes: `buscarWhatsAppConfig()`, `salvarCanalWhatsApp(canal)` de `crm.service.js`; Edge Function `evolution-connect` (Task 5); tabela `whatsapp_config` via Realtime (Task 1).
- Produces: rota `/crm/conexao`, visível apenas para `isAdmin`.

- [ ] **Step 1: Escrever o teste da função pura de resolução do QR Code**

```jsx
// src/pages/ConexaoWhatsAppPage.test.jsx
import { describe, it, expect } from 'vitest'
import { resolverQrCodeSrc } from './ConexaoWhatsAppPage'

describe('resolverQrCodeSrc', () => {
  it('mantém strings já no formato data URI', () => {
    const src = resolverQrCodeSrc('data:image/png;base64,ABC123')
    expect(src).toBe('data:image/png;base64,ABC123')
  })

  it('adiciona o prefixo data URI quando vier base64 puro', () => {
    const src = resolverQrCodeSrc('ABC123')
    expect(src).toBe('data:image/png;base64,ABC123')
  })

  it('retorna null quando não há QR Code', () => {
    expect(resolverQrCodeSrc(null)).toBeNull()
    expect(resolverQrCodeSrc(undefined)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npm test -- ConexaoWhatsAppPage`
Expected: FAIL — `Failed to resolve import "./ConexaoWhatsAppPage"` (arquivo ainda não existe).

- [ ] **Step 3: Adicionar as funções de serviço**

Em `src/services/crm.service.js`, adicione ao final do arquivo (seguindo o padrão das seções existentes, ex.: linha 542 `// ─── Mensagens Prontas ───`):

```js
// ─── Conexão WhatsApp ──────────────────────────────────────────

export async function buscarWhatsAppConfig() {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) throw error
  return data
}

export async function salvarCanalWhatsApp(canal) {
  const { error } = await supabase
    .from('whatsapp_config')
    .update({ canal_ativo: canal, atualizado_em: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}
```

- [ ] **Step 4: Criar o hook `useWhatsAppConexao`**

```js
// src/hooks/useWhatsAppConexao.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { buscarWhatsAppConfig, salvarCanalWhatsApp } from '@/services/crm.service'

export function useWhatsAppConexao() {
  const [config, setConfig]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [gerandoQr, setGerandoQr] = useState(false)
  const [erro, setErro]         = useState('')

  useEffect(() => {
    buscarWhatsAppConfig()
      .then(setConfig)
      .catch(() => setErro('Não foi possível carregar a configuração de conexão.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-config-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_config' }, (payload) => {
        setConfig(payload.new)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const gerarQrCode = useCallback(async () => {
    setGerandoQr(true)
    setErro('')
    try {
      const { data, error } = await supabase.functions.invoke('evolution-connect')
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    } catch (e) {
      setErro(e.message || 'Erro ao gerar QR Code.')
    } finally {
      setGerandoQr(false)
    }
  }, [])

  const trocarCanal = useCallback(async (canal) => {
    setErro('')
    try {
      await salvarCanalWhatsApp(canal)
      setConfig(prev => prev ? { ...prev, canal_ativo: canal } : prev)
    } catch (e) {
      setErro(e.message || 'Erro ao trocar canal.')
    }
  }, [])

  return { config, loading, gerandoQr, erro, gerarQrCode, trocarCanal }
}
```

- [ ] **Step 5: Criar a página `ConexaoWhatsAppPage`**

```jsx
// src/pages/ConexaoWhatsAppPage.jsx
import { useState } from 'react'
import { QrCode, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useWhatsAppConexao } from '@/hooks/useWhatsAppConexao'

const STATUS_LABEL = {
  DESCONECTADO: { label: 'Desconectado', color: '#b83232' },
  CONECTANDO:   { label: 'Conectando...', color: '#b87a00' },
  CONECTADO:    { label: 'Conectado', color: '#2d7a4f' },
}

export function resolverQrCodeSrc(qrcodeBase64) {
  if (!qrcodeBase64) return null
  return qrcodeBase64.startsWith('data:') ? qrcodeBase64 : `data:image/png;base64,${qrcodeBase64}`
}

export default function ConexaoWhatsAppPage() {
  const { config, loading, gerandoQr, erro, gerarQrCode, trocarCanal } = useWhatsAppConexao()
  const [confirmandoCanal, setConfirmandoCanal] = useState(null)

  if (loading || !config) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888480', fontSize: 13 }}>
        Carregando...
      </div>
    )
  }

  const status = STATUS_LABEL[config.status_conexao] || STATUS_LABEL.DESCONECTADO
  const qrSrc = resolverQrCodeSrc(config.qrcode_base64)

  const handleTrocarCanal = async (canal) => {
    if (canal === config.canal_ativo) return
    await trocarCanal(canal)
    setConfirmandoCanal(null)
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Conexão WhatsApp
        </h1>
        <p style={{ fontSize: 12, color: '#888480', margin: '6px 0 0', lineHeight: 1.6 }}>
          Escolha como o CRM envia e recebe mensagens do WhatsApp: via QR Code (conexão temporária,
          enquanto a API oficial não está disponível) ou via API Oficial da Meta.
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          Canal Ativo
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {['QR_CODE', 'API_OFICIAL'].map(canal => (
            <button
              key={canal}
              onClick={() => setConfirmandoCanal(canal)}
              disabled={canal === config.canal_ativo}
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 8,
                border: canal === config.canal_ativo ? '2px solid #7a1e1e' : '1px solid #e0dcd8',
                background: canal === config.canal_ativo ? '#f0e8e8' : '#fff',
                color: canal === config.canal_ativo ? '#7a1e1e' : '#1a1a1a',
                fontWeight: 600,
                fontSize: 13,
                cursor: canal === config.canal_ativo ? 'default' : 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {canal === 'QR_CODE' ? 'QR Code' : 'API Oficial'}
              {canal === config.canal_ativo && (
                <div style={{ fontSize: 10, fontWeight: 500, marginTop: 4 }}>Em uso agora</div>
              )}
            </button>
          ))}
        </div>

        {confirmandoCanal && (
          <div style={{ marginTop: 14, padding: 14, background: '#f7f6f4', borderRadius: 6, border: '1px solid #e0dcd8' }}>
            <p style={{ fontSize: 12, color: '#1a1a1a', margin: '0 0 10px' }}>
              Trocar para <strong>{confirmandoCanal === 'QR_CODE' ? 'QR Code' : 'API Oficial'}</strong>?
              Isso muda imediatamente por onde as próximas mensagens são enviadas.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleTrocarCanal(confirmandoCanal)}
                style={{ padding: '7px 16px', background: '#7a1e1e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmandoCanal(null)}
                style={{ padding: '7px 16px', background: 'none', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {config.canal_ativo === 'QR_CODE' ? (
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20,
            background: `${status.color}15`, color: status.color, fontSize: 12, fontWeight: 700, marginBottom: 16,
          }}>
            {config.status_conexao === 'CONECTADO' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {status.label}
          </div>

          {config.status_conexao === 'CONECTADO' ? (
            <p style={{ fontSize: 13, color: '#888480' }}>Sessão conectada. Nenhuma ação necessária.</p>
          ) : (
            <>
              {qrSrc && (
                <img
                  src={qrSrc}
                  alt="QR Code WhatsApp"
                  style={{ width: 220, height: 220, margin: '0 auto 16px', border: '1px solid #e0dcd8', borderRadius: 8, display: 'block' }}
                />
              )}
              <div>
                <button
                  onClick={gerarQrCode}
                  disabled={gerandoQr}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 20px', background: gerandoQr ? '#9b6b6b' : '#7a1e1e',
                    color: '#fff', border: 'none', borderRadius: 6,
                    fontSize: 13, fontWeight: 600, cursor: gerandoQr ? 'not-allowed' : 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {gerandoQr ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                  {gerandoQr ? 'Gerando...' : (qrSrc ? 'Atualizar QR Code' : 'Gerar QR Code')}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#888480', marginTop: 12 }}>
                Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho, e escaneie o código acima.
              </p>
            </>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20,
            background: '#2d7a4f15', color: '#2d7a4f', fontSize: 12, fontWeight: 700,
          }}>
            <CheckCircle2 size={14} />
            Conectado via API Oficial
          </div>
          <p style={{ fontSize: 12, color: '#888480', marginTop: 12 }}>
            Mensagens são enviadas e recebidas pela Meta Cloud API, configurada nas variáveis WHATSAPP_*.
          </p>
        </div>
      )}

      {erro && (
        <div style={{ marginTop: 16, padding: '8px 14px', background: '#fff5f5', border: '1px solid #fde8e8', borderRadius: 6, color: '#b83232', fontSize: 12 }}>
          {erro}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Rodar o teste e verificar que passa**

Run: `npm test -- ConexaoWhatsAppPage`
Expected: PASS — 3 testes.

- [ ] **Step 7: Registrar a rota e o link no menu (`src/App.jsx`)**

No topo do arquivo, adicione aos imports existentes (linha 3, ícones) `QrCode`, e (linha 14, páginas) a nova página:

```js
import { MessageSquare, BarChart2, Users, LogOut, ClipboardList, BookUser, Bot, Timer, BookOpen, QrCode } from 'lucide-react'
// ...
import ConexaoWhatsAppPage from '@/pages/ConexaoWhatsAppPage'
```

No `Sidebar`, dentro do bloco `{isAdmin && (...)}` (por volta da linha 188-210), adicione um `NavLink` (sugestão: logo após "Chatbot", já que ambos tratam de infraestrutura de mensageria):

```jsx
            <NavLink to="/crm/chatbot" style={navLinkStyle}>
              <Bot size={15} />
              Chatbot
            </NavLink>
            <NavLink to="/crm/conexao" style={navLinkStyle}>
              <QrCode size={15} />
              Conexão WhatsApp
            </NavLink>
```

Nas `Routes` (por volta da linha 341-352), adicione a rota admin-only:

```jsx
              {isAdmin && <Route path="/crm/chatbot" element={<ChatbotPage />} />}
              {isAdmin && <Route path="/crm/conexao" element={<ConexaoWhatsAppPage />} />}
```

- [ ] **Step 8: Verificar o build**

Run: `npm run build`
Expected: build concluído sem erros.

- [ ] **Step 9: Verificar manualmente no navegador**

```bash
npm run dev
```

Faça login como ADMIN, navegue até "Conexão WhatsApp" no menu. Verifique:
- Card "Canal Ativo" mostra `QR Code` selecionado (estado default da migration).
- Clicar em "API Oficial" mostra o modal de confirmação; "Confirmar" troca o card em tempo real (via Realtime) e exibe o bloco "Conectado via API Oficial".
- Voltar para "QR Code" mostra o bloco de status com botão "Gerar QR Code"; clicar nele, sem a Evolution API configurada, mostra a mensagem de erro vinda do backend ("Evolution API não configurada...") na área de erro vermelha.

- [ ] **Step 10: Commit**

```bash
git add src/services/crm.service.js src/hooks/useWhatsAppConexao.js src/pages/ConexaoWhatsAppPage.jsx src/pages/ConexaoWhatsAppPage.test.jsx src/App.jsx
git commit -m "feat: adiciona página admin de Conexão WhatsApp (QR Code / API Oficial)"
```

---

### Task 7: Documentação — secrets, deploy e setup da Evolution API

**Files:**
- Modify: `README-CRM.md` (novo bloco após a seção `## 6. Configurar webhook no Meta Business Suite`, linha 97 atual)

**Interfaces:** nenhuma (apenas documentação).

- [ ] **Step 1: Adicionar a nova seção ao README**

Insira, logo antes de `## 7. Criar bucket de Storage` (linha 99 atual):

```markdown
---

## 6b. Conexão via QR Code (Evolution API) — canal alternativo

Enquanto as credenciais da Meta Cloud API não são aprovadas, o CRM pode operar via QR Code
(conexão não-oficial, usando a Evolution API — https://github.com/EvolutionAPI/evolution-api).
Isso é temporário: assim que a API oficial estiver disponível, o admin troca o canal em
`/crm/conexao` sem precisar reimplantar nada.

### Hospedar a Evolution API

Rode a Evolution API em Docker, em qualquer host (VPS próprio, Railway, Fly.io etc.):

```bash
docker run -d --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=sua_api_key_secreta \
  atendai/evolution-api:latest
```

Anote a URL pública do serviço (`EVOLUTION_API_URL`) e a `AUTHENTICATION_API_KEY` (`EVOLUTION_API_KEY`).

### Secrets do Supabase

```bash
supabase secrets set EVOLUTION_API_URL=https://sua-evolution-api.exemplo.com
supabase secrets set EVOLUTION_API_KEY=sua_api_key_secreta
supabase secrets set EVOLUTION_INSTANCE_NAME=scont-crm
supabase secrets set EVOLUTION_WEBHOOK_TOKEN=token_aleatorio_seguro
```

### Deploy das Edge Functions

```bash
supabase functions deploy evolution-webhook
supabase functions deploy evolution-connect
```

O webhook da instância é configurado automaticamente pela função `evolution-connect` na primeira
conexão — não é necessário configurar nada manualmente no painel da Evolution API.

### Uso

1. Faça login como ADMIN e acesse **Conexão WhatsApp** no menu.
2. Confirme que o canal ativo é "QR Code" e clique em **Gerar QR Code**.
3. No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → escaneie o código.
4. Quando a API oficial da Meta estiver aprovada (seções 4-6 acima), volte em **Conexão WhatsApp**
   e troque o canal ativo para "API Oficial".

---
```

- [ ] **Step 2: Commit**

```bash
git add README-CRM.md
git commit -m "docs: documenta setup da conexão WhatsApp via QR Code (Evolution API)"
```

---

## Notas para quem for implementar

- A Task 2 é uma refatoração pura — nenhum comportamento de `whatsapp-webhook` deve mudar. Se o teste de regressão do Step 3 divergir do comportamento anterior, pare e investigue antes de seguir para a Task 3.
- As Tasks 3 e 5 dependem de nomes de campos/eventos da Evolution API v2 que não puderam ser validados contra uma instância real durante o planejamento (o serviço ainda não está hospedado). Trate os `curl` de "Evolution API real" como o ponto de verificação definitivo — ajuste os extratores de payload se a versão implantada usar nomes diferentes.
- Diferente do design original (`docs/superpowers/specs/2026-06-03-crm-whatsapp-design.md`), a troca de canal (`canal_ativo`) é feita por escrita direta na tabela `whatsapp_config` protegida por RLS (mesmo padrão de `sla_config`/`SLAConfigPage.jsx`), não por uma Edge Function dedicada — simplifica a implementação sem mudar o resultado (troca continua admin-only).
