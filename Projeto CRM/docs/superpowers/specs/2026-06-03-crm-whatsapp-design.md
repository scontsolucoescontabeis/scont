# CRM WhatsApp — Portal SCONT: Design Document

**Data:** 2026-06-03  
**Produto:** CRM WhatsApp — Módulo Interno do Portal SCONT  
**Status:** Aprovado para implementação

---

## 1. Contexto e Objetivo

Substituir um CRM de terceiros que usa integração não-oficial com o WhatsApp (sujeito a banimento) por uma solução interna que usa a **Meta Cloud API Oficial**. O módulo é exclusivamente interno — usado pelos agentes da SCONT Soluções Contábeis para atender clientes via WhatsApp.

**Decisões confirmadas (2026-06-03):**
- Auth: Supabase Auth independente (email/senha + RLS por departamento). Sem reutilização do `portal-auth-guard.js`.
- Integração com o portal: card/link no `portal.html` que abre o CRM em nova aba.
- Credenciais Meta WhatsApp Business API: ainda não obtidas. O plano de implementação incluirá um guia passo-a-passo para registro no Meta Business Manager.
- Persistência: mesmo projeto Supabase do Portal (variáveis `SUPABASE_URL` / `SUPABASE_KEY`).

---

## 2. Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React + Tailwind CSS + shadcn/ui |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Banco de dados | Supabase PostgreSQL |
| Auth | Supabase Auth com RLS por departamento |
| Realtime | Supabase Realtime (CDC nativo) |
| WhatsApp | Meta Cloud API Oficial |
| Storage | Supabase Storage (mídias) |

**Restrição crítica:** Nenhum servidor Node.js/Express separado. Toda lógica de servidor vive em Edge Functions.

---

## 3. Identidade Visual SCONT

### Paleta de cores
```css
:root {
  --scont-primary: #7a1e1e;        /* Bordô — headers, botões, badges */
  --scont-primary-dark: #5c1515;   /* hover states */
  --scont-primary-light: #9b2c2c;  /* accents */
  --scont-primary-muted: #f0e8e8;  /* backgrounds suaves */
  --scont-bg: #f2f2f0;
  --scont-surface: #ffffff;
  --scont-surface-2: #f7f6f4;
  --scont-border: #e0dcd8;
  --scont-text: #1a1a1a;
  --scont-text-muted: #888480;
  --scont-ok: #2d7a4f;
  --scont-warn: #b87a00;
  --scont-danger: #b83232;
}
```

### Cores por departamento
| Departamento | Cor | Hex |
|---|---|---|
| PESSOAL | Azul | `#3B82F6` |
| CONTÁBIL | Verde esmeralda | `#10B981` |
| ADMINISTRATIVO | Âmbar | `#F59E0B` |
| TRIBUTÁRIO | Violeta | `#8B5CF6` |

### Tipografia
- **Display/Títulos:** Merriweather (serif), peso 400 e 700
- **Interface/Corpo:** DM Sans, pesos 300 400 500 600
- **Código/Timestamps/Badges:** DM Mono, pesos 400 500

---

## 4. Arquitetura de Dados

### Schema PostgreSQL (migration 001)

**Tabelas principais:**
- `usuarios` — agentes internos SCONT (auth_id → auth.users)
- `contatos` — clientes (identificados pelo telefone, formato `5561999999999`)
- `conversas` — thread de atendimento (departamento, status, agente, protocolo `SCT-YYYYMMDD-XXXXXX`)
- `mensagens` — mensagens individuais (tipo: text/image/audio/document/video, origem: CLIENTE/AGENTE/SISTEMA/BOT)
- `transferencias` — log completo de transferências entre deptos/agentes
- `anotacoes_internas` — notas invisíveis ao cliente
- `tags` + `conversa_tags` — categorização livre

**ENUMs:**
- `departamento_enum`: PESSOAL, CONTABIL, ADMINISTRATIVO, TRIBUTARIO
- `role_enum`: ADMIN, AGENTE
- `status_conversa`: ABERTA, EM_ATENDIMENTO, ENCERRADA, AGUARDANDO
- `origem_mensagem`: CLIENTE, AGENTE, SISTEMA, BOT

**RLS:**
- ADMIN vê todas as conversas
- AGENTE vê apenas conversas do seu departamento

---

## 5. Edge Functions (4 obrigatórias)

### `whatsapp-webhook`
- **GET** → verificação do webhook Meta (hub.challenge)
- **POST** → processa mensagem recebida
- Valida assinatura `X-Hub-Signature-256`
- Cria/atualiza contato por número de telefone
- Cria conversa se não existir
- Insere mensagem (o INSERT aciona Realtime automaticamente)
- Upload de mídia para Supabase Storage se tipo ≠ text
- Env vars: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `send-message`
- Recebe `{ conversa_id, conteudo, tipo }`
- Valida JWT do agente
- Busca número do contato via conversa_id
- POST para `https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages`
- Salva mensagem com `whatsapp_msg_id` retornado
- Env vars: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`

### `encerrar-conversa`
- Recebe `{ conversa_id }`
- Atualiza status → ENCERRADA, `encerrado_em = NOW()`
- Envia mensagem automática ao cliente via Meta API
- Insere mensagem de sistema na tabela

### `transferir-conversa`
- Recebe `{ conversa_id, para_departamento, para_agente_id?, motivo? }`
- Registra em `transferencias`
- Atualiza departamento e agente_id na conversa
- Insere mensagem de sistema "Conversa transferida para [depto]"
- Status → AGUARDANDO (sem agente destino) ou EM_ATENDIMENTO (com agente)

---

## 6. Frontend — Estrutura de Componentes

### Layout — 3 colunas
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER SCONT [bordô #7a1e1e] — Logo + Nav + UserMenu       │
├──────────┬───────────────────────┬──────────────────────────┤
│ SIDEBAR  │ LISTA CONVERSAS       │ CHAT + PAINEL DIREITO    │
│ Portal   │ (scrollável)          │                          │
│          │ Filtros: depto/status │ Histórico de mensagens   │
│ ▸ CRM   │ Cards de conversa     │ Campo de resposta        │
│ ▸ ...   │                       │ Dados do contato         │
│          │                       │ Timeline                 │
└──────────┴───────────────────────┴──────────────────────────┘
```

### Componentes principais

**ConversaCard:**
- Badge departamento (pill colorido)
- Nome + prévia da última mensagem
- Timestamp relativo ("há 5min", "ontem")
- Bolinha bordô com contagem de não-lidas
- Badge status: ABERTA(cinza) | EM_ATENDIMENTO(verde) | AGUARDANDO(âmbar)
- Protocolo em DM Mono

**ChatPanel:**
- Balão cinza (esquerda) → cliente
- Balão bordô-claro `#f0e8e8` (direita) → agente
- Fundo amarelo suave + ícone cadeado → anotações internas
- Texto centralizado itálico cinza → mensagens de sistema
- Toolbar: [Assumir] [Transferir ↗] [Encerrar ✓] [Tags]
- InputBar: [Texto] [Nota Interna] [Anexo] [Enviar]
- ModalTransferencia: depto destino → agente (filtrado) → motivo

**PainelDireito:**
- Dados do contato (avatar, nome, telefone, empresa, protocolo, agente)
- Histórico de conversas anteriores (clicável)
- Timeline de transferências + tags

### Hooks
- `useConversas` — lista e filtros
- `useMensagens` — mensagens da conversa ativa
- `useRealtime` — subscriptions Supabase Realtime
- `useWhatsApp` — chamadas às Edge Functions

### Realtime behavior
- Nova mensagem → som de notificação + badge de não-lidas
- Se conversa ativa → scroll automático para nova mensagem

---

## 7. Estrutura de Pastas

```
scont-crm/
├── src/
│   ├── modules/crm/
│   │   ├── pages/
│   │   │   ├── CRMPage.jsx
│   │   │   ├── MetricasPage.jsx      (admin only)
│   │   │   └── UsuariosPage.jsx      (admin only)
│   │   ├── components/
│   │   │   ├── ConversaList/
│   │   │   ├── ChatPanel/
│   │   │   ├── PainelDireito/
│   │   │   └── shared/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── contexts/CRMContext.jsx
│   └── lib/supabaseClient.js
├── supabase/
│   ├── functions/
│   │   ├── whatsapp-webhook/index.ts
│   │   ├── send-message/index.ts
│   │   ├── encerrar-conversa/index.ts
│   │   └── transferir-conversa/index.ts
│   ├── migrations/001_crm_schema.sql
│   └── seed.sql
└── .env.example
```

---

## 8. Dashboard de Métricas (Admin)

Rota `/crm/metricas` — ADMIN only:
- KPI Cards: Abertas | Em atendimento | Encerradas hoje | Tempo médio 1ª resposta
- Gráfico rosca: distribuição por departamento (cores dos deptos)
- Gráfico barras: volume diário últimos 7 dias
- Tabela ranking agentes: Agente | Depto | Conversas atendidas | Tempo médio

---

## 9. Regras de Negócio

1. Nova conversa entra como **ABERTA**, sem agente
2. Qualquer agente do departamento pode "assumir" → **EM_ATENDIMENTO**
3. ADMIN vê todos os departamentos; AGENTE vê apenas o seu
4. Transferência registra log completo com timestamp
5. Encerramento exige confirmação modal
6. Encerramento gera mensagem automática ao cliente (Edge Function)
7. Primeiro contato recebe mensagem de boas-vindas automática
8. Notificação Realtime para nova mensagem no departamento do agente logado
9. Anotações internas **não** são enviadas ao cliente
10. Protocolo: `SCT-YYYYMMDD-XXXXXX` (gerado automaticamente)

---

## 10. Sequência de Entrega

| Etapa | Entregável |
|---|---|
| 0 | **Guia credenciais Meta** — passo-a-passo para obter tokens no Meta Business Manager |
| 1 | Migration SQL + seed no Supabase (tabelas, ENUMs, RLS, trigger protocolo) |
| 2 | Edge Function `whatsapp-webhook` |
| 3 | Edge Function `send-message` |
| 4 | Edge Functions `encerrar-conversa` e `transferir-conversa` |
| 5 | Registro do webhook no Meta Business Suite |
| 6 | `main.jsx` + router + tela de Login + `AuthContext` |
| 7 | `CRMContext` + hooks (useConversas, useRealtime, useWhatsApp) |
| 8 | `ConversaList` + `ConversaCard` |
| 9 | `ChatPanel` + `InputBar` + `ModalTransferencia` |
| 10 | `PainelDireito` |
| 11 | `MetricasPage` e `UsuariosPage` (admin) |
| 12 | Link/card no `portal.html` para abrir o CRM |

---

## 11. Variáveis de Ambiente

```env
# Frontend (.env.local)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase Secrets (nunca commitar)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```
