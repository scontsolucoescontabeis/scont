# Simulador WhatsApp — Design Spec

**Data:** 2026-06-07
**Status:** Aprovado

---

## Contexto

O CRM Messenger recebe mensagens via webhook da Meta Cloud API. Testar o sistema manualmente exige um número WhatsApp real e um dispositivo. O simulador é uma ferramenta de desenvolvimento que substitui esse fluxo: o desenvolvedor envia mensagens "como se fosse um cliente WhatsApp" direto do browser, e o CRM Messenger reage normalmente (chatbot, agentes, SLA, realtime).

---

## Decisões de design

| Questão | Decisão |
|---------|---------|
| O que simula? | Lado do **cliente** (WhatsApp). O CRM roda em outra janela normalmente. |
| Quantos clientes? | Múltiplos telefones simultâneos, cada um com conversa independente |
| Como injeta mensagens? | Via nova edge function `dev-message` que reutiliza o pipeline do webhook |
| O chatbot responde? | Sim — pipeline completo, incluindo chatbot processor |
| Onde vive? | Arquivo standalone `docs/simulador-whatsapp.html` (sem build) |
| UI | Clone do WhatsApp Web — tema verde escuro |

---

## Arquitetura

### Fluxo de dados

```
simulador-whatsapp.html
       |
       | POST { phone, name, message }
       ↓
supabase/functions/dev-message/index.ts
       |
       | POST payload Meta-format + X-Dev-Bypass-Token
       ↓
supabase/functions/whatsapp-webhook/index.ts  (modificado)
       |
       | pula HMAC se token válido
       | obterOuCriarContato(phone, name)
       | obterOuCriarConversa(contato_id)
       | insere mensagem CLIENTE
       | processarMensagemBot(...)  ← chatbot roda de verdade
       ↓
Supabase DB (mensagens, conversas, contatos, chatbot_sessoes)
       |
       | Supabase Realtime (anon key)
       ↓
simulador-whatsapp.html  ← respostas BOT/AGENTE/SISTEMA aparecem em tempo real
```

**Nota sobre a Meta API:** quando o chatbot ou agente envia resposta, o webhook tenta entregar ao número fake via Meta Cloud API e falha silenciosamente. A mensagem já está no banco antes da tentativa de envio — o Realtime a entrega ao simulador sem depender do Meta.

---

## Arquivos a criar / modificar

| Ação | Arquivo | O que muda |
|------|---------|-----------|
| Criar | `supabase/functions/dev-message/index.ts` | Nova edge function dev-only |
| Modificar | `supabase/functions/whatsapp-webhook/index.ts` | +bypass HMAC (6 linhas) |
| Criar | `supabase/migrations/011_dev_simulator.sql` | Policy SELECT anon em `mensagens` e `conversas` |
| Criar | `docs/simulador-whatsapp.html` | O simulador completo |

---

## Edge Function: `dev-message`

### Contrato

```
POST /functions/v1/dev-message
Headers:
  Authorization: Bearer <anon_key>
  Content-Type: application/json

Body:
  {
    "phone": "+5511990010001",   // obrigatório — número no formato Meta (sem + é aceito também)
    "name":  "Maria Oliveira",   // opcional — nome do contato
    "message": "Olá, preciso de ajuda"  // obrigatório
  }

Response 200:
  {
    "ok": true,
    "conversa_id": "uuid",
    "contato_id": "uuid",
    "protocolo": "SCT-20260607-001234"
  }

Response 400/500:
  { "error": "mensagem de erro" }
```

### Implementação

A função monta um payload mínimo no formato Meta Cloud API e o encaminha para `whatsapp-webhook` com o header `X-Dev-Bypass-Token`. O webhook recebe e processa normalmente.

```typescript
// supabase/functions/dev-message/index.ts
const DEV_BYPASS_TOKEN = Deno.env.get('DEV_BYPASS_TOKEN')!
const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`

serve(async (req) => {
  const { phone, name, message } = await req.json()
  const telefone = phone.replace(/\D/g, '')  // normaliza: remove +, espaços, traços → formato Meta (ex: 5511990010001)

  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{ id: `sim-${Date.now()}`, from: telefone, type: 'text', text: { body: message } }],
          contacts: [{ profile: { name: name || telefone } }],
          metadata: { phone_number_id: 'SIM', display_phone_number: 'SIM' }
        }
      }]
    }]
  }

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-Bypass-Token': DEV_BYPASS_TOKEN,
    },
    body: JSON.stringify(payload)
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
})
```

---

## Modificação: `whatsapp-webhook`

Adicionar no início do handler POST, antes da validação HMAC:

```typescript
const DEV_BYPASS_TOKEN = Deno.env.get('DEV_BYPASS_TOKEN')
const devBypass = DEV_BYPASS_TOKEN &&
  req.headers.get('X-Dev-Bypass-Token') === DEV_BYPASS_TOKEN

// Valida assinatura HMAC — pula apenas se bypass de dev ativo
if (!devBypass) {
  const signature = req.headers.get('x-hub-signature-256')
  const valido = await validarAssinatura(rawBody, signature)
  if (!valido) return new Response('Forbidden', { status: 403 })
}
```

A função deve também retornar `conversa_id`, `contato_id` e `protocolo` no body da resposta quando `devBypass` for true. O handler deve coletar esses valores durante `obterOuCriarConversa()` e incluí-los no `Response` final (`200 OK` com JSON `{ ok: true, conversa_id, contato_id, protocolo }`). `dev-message` repassa esse body diretamente ao simulador.

---

## Migração: `011_dev_simulator.sql`

Adiciona policies SELECT permissivas para o role `anon` nas tabelas que o simulador precisa ler via Realtime:

```sql
-- Policy para o simulador ler mensagens via Realtime (anon key)
DROP POLICY IF EXISTS "dev_sim_mensagens_read" ON mensagens;
CREATE POLICY "dev_sim_mensagens_read" ON mensagens
  FOR SELECT USING (true);

-- Policy para o simulador ler status da conversa
DROP POLICY IF EXISTS "dev_sim_conversas_read" ON conversas;
CREATE POLICY "dev_sim_conversas_read" ON conversas
  FOR SELECT USING (true);
```

**Aviso:** estas policies são permissivas intencionalmente — esta migração é para ambiente de desenvolvimento. Em produção com dados reais, considerar restringir ou remover.

---

## HTML Simulador: `docs/simulador-whatsapp.html`

### Tecnologias
- HTML + Vanilla JS (sem framework, sem build)
- `@supabase/supabase-js` via CDN (esm.sh)
- CSS inline — tema WhatsApp Web (cores `#111b21`, `#202c33`, `#00a884`)

### Estrutura de estado (localStorage)

```js
// Chave: "wpp_sim_config"
{
  supabase_url: "https://xxx.supabase.co",
  anon_key: "eyJ...",
  dev_bypass_token: "dev-sim-secret"
}

// Chave: "wpp_sim_clientes"
[
  {
    id: "uuid-local",           // gerado no browser
    phone: "+5511990010001",
    name: "Maria Oliveira",
    conversa_id: "uuid-supabase | null",  // null até primeira mensagem
    contato_id: "uuid-supabase | null",
    protocolo: "SCT-... | null",
    unread: 0                   // contador de não-lidas
  }
]
```

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚡ Simulador WhatsApp  [SCONT CRM — Ferramenta de Dev]             │
├──────────────────────┬──────────────────────────────────────────────┤
│  [Configuração ▼]    │                                              │
│  URL / Key / Token   │   Header: avatar + nome + phone + status    │
├──────────────────────┤                                              │
│  Telefones (N)       │   Área de mensagens (scroll)                │
│                      │   ┌────────────────────────────┐            │
│  ● +55 11 99001      │   │ cliente (direita, verde)    │            │
│    Maria · ABERTA    │   │ bot (esquerda, cinza escuro)│            │
│    "Bot: Escolha..." │   │ agente (esquerda, com nome) │            │
│                      │   │ sistema (centro, menor)     │            │
│  ○ +55 11 99002      │   └────────────────────────────┘            │
│    João · ATEND.     │                                              │
│                      │   [input de texto] [Enviar ➤]               │
│  ○ +47 99003-0003    │                                              │
│    Pedro · ABERTA    │                                              │
├──────────────────────┤                                              │
│  [+ Novo telefone]   │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

### Componentes JS principais

| Função | Responsabilidade |
|--------|-----------------|
| `inicializar()` | Carrega config e clientes do localStorage, inicializa Supabase |
| `selecionarCliente(id)` | Troca o cliente ativo, cancela subscription anterior, cria nova |
| `enviarMensagem(texto)` | Chama `dev-message`, atualiza estado local, trava input enquanto aguarda |
| `subscreverRealtime(conversa_id)` | Supabase Realtime em `mensagens` filtrado por `conversa_id` |
| `onMensagemRecebida(msg)` | Renderiza mensagem BOT/AGENTE/SISTEMA na área de chat |
| `criarCliente(phone, name)` | Valida, adiciona ao array e salva no localStorage |
| `removerCliente(id)` | Remove do array e localStorage (mantém dados no Supabase) |
| `salvarConfig()` | Persiste config no localStorage, testa conexão chamando `dev-message` com ping |
| `gerarTelefoneAleatorio()` | Retorna `+5511 9XXXX-XXXX` com dígitos aleatórios |

### Renderização das mensagens por origem

| `origem` | Posição | Background | Prefixo |
|----------|---------|-----------|---------|
| `CLIENTE` | direita | `#005c4b` | — |
| `BOT` | esquerda | `#202c33` | 🤖 Bot SCONT |
| `AGENTE` | esquerda | `#1a2e3a` | 👤 + nome do agente |
| `SISTEMA` | centro | transparente | — (italic) |

### Modal "Novo telefone"

Campos:
- **Nome** (opcional) — placeholder "Ex: Maria Oliveira"
- **Telefone** — placeholder "+55 11 99001-0001" + botão "↻ Gerar aleatório"
- Botões: Cancelar / Criar

Ao clicar "Criar": valida que o telefone tem pelo menos 10 dígitos, adiciona ao array de clientes com `conversa_id: null`, fecha modal e seleciona o novo cliente. O contato/conversa no Supabase só é criado ao enviar a primeira mensagem.

### Painel de configuração (colapsável)

Campos: URL Supabase, Anon Key, Dev Bypass Token.
Botão "Salvar e testar conexão" — executa `supabase.from('mensagens').select('id').limit(1)` com a anon key configurada. Se retornar sem erro de autenticação, exibe `✓ Conectado`. Se falhar, exibe `✗ Erro: <mensagem>`.
Config salva no `localStorage` — nunca sai do browser.

---

## Verificação (como testar)

1. Rodar migração `011_dev_simulator.sql` no SQL Editor do Supabase
2. Adicionar `DEV_BYPASS_TOKEN` às variáveis de ambiente do Supabase e fazer deploy das funções
3. Abrir `docs/simulador-whatsapp.html` — inserir URL, anon key e token — "Salvar e testar"
4. Abrir o CRM Messenger em outra aba
5. Criar novo telefone no simulador → digitar mensagem → Enviar
6. No CRM: confirmar que a conversa aparece na fila ABERTA em tempo real
7. No simulador: confirmar que o chatbot responde com o menu de departamentos
8. Interagir com o menu (enviar "2") → confirmar bot avança para categorias
9. No CRM: agente assume a conversa → responde → confirmar mensagem aparece no simulador
10. Criar segundo telefone → confirmar que são conversas completamente independentes
11. Simular 3+ telefones ao mesmo tempo → confirmar que o Realtime de cada um é independente
