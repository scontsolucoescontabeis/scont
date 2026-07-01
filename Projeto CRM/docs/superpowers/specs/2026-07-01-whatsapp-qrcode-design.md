# Conexão WhatsApp via QR Code — Design Document

**Data:** 2026-07-01
**Produto:** CRM WhatsApp — Portal SCONT
**Status:** Aprovado para implementação

---

## 1. Contexto e Objetivo

O CRM hoje só envia/recebe WhatsApp pela Meta Cloud API oficial (ver `docs/superpowers/specs/2026-06-03-crm-whatsapp-design.md`), que exige credenciais da Meta Business ainda não obtidas. Enquanto essas credenciais não chegam, a SCONT precisa operar o atendimento via WhatsApp mesmo assim — usando a conexão não-oficial por QR Code (WhatsApp Web / multi-device).

**Decisão confirmada (2026-07-01):** o CRM passa a suportar dois canais de envio/recebimento — QR Code (Evolution API) e API Oficial (Meta Cloud API) — com um switch global para alternar entre eles. Isso não substitui a arquitetura existente da API oficial; adiciona um canal alternativo por cima dela, preservando todo o trabalho já feito.

**Nota sobre risco:** conexão por QR Code é integração não-oficial e está sujeita a banimento do número conectado. É o motivo pelo qual o projeto original priorizou a API oficial. O QR Code aqui é uma ponte temporária até a aprovação da Meta, não a solução definitiva.

---

## 2. Arquitetura

A **Evolution API** (projeto open-source Node.js que usa a lib Baileys por baixo) roda como um serviço Docker separado, responsável por manter a sessão do WhatsApp Web viva 24/7 — algo que Supabase Edge Functions (Deno, stateless) não conseguem fazer. Esse serviço se comunica com o Supabase exclusivamente via REST (Edge Functions chamando a Evolution API) e webhook (Evolution API chamando uma Edge Function quando chega mensagem ou muda o status de conexão).

A hospedagem do serviço Evolution API fica em aberto (VPS, Railway, Fly.io etc. — decisão de deploy, não de arquitetura). O design usa apenas a URL/credenciais como variáveis de ambiente genéricas.

Como o mesmo número de WhatsApp não pode estar simultaneamente registrado na Cloud API oficial e logado via QR Code, o switch de canal (`canal_ativo`) controla principalmente **qual canal é usado para enviar** mensagens. O recebimento chega naturalmente por apenas um dos dois webhooks, dependendo de qual conexão está de fato ativa no WhatsApp.

**Restrição preservada do design original:** nenhuma lógica de negócio do CRM roda fora de Edge Functions/Supabase. O único processo persistente novo é o serviço Evolution API em si, que é infraestrutura de conexão WhatsApp, não lógica do CRM.

---

## 3. Modelo de Dados

### Migration `002_whatsapp_channel.sql`

Nova tabela singleton `whatsapp_config`:

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | int (fixo = 1) | Garante linha única |
| `canal_ativo` | enum `QR_CODE` \| `API_OFICIAL` | Canal usado por `send-message` para enviar |
| `status_conexao` | enum `DESCONECTADO` \| `CONECTANDO` \| `CONECTADO` | Estado da sessão Evolution API |
| `qrcode_base64` | text (nullable) | QR Code atual, limpo quando conectado |
| `atualizado_em` | timestamptz | Última atualização |

**RLS:** leitura liberada para qualquer usuário autenticado (para exibir status/badge); escrita restrita a `ADMIN`.

---

## 4. Edge Functions

### Novas

**`evolution-webhook`**
- Recebe eventos da Evolution API: `messages.upsert` (mensagem recebida) e `connection.update` (mudança de status/QR).
- `messages.upsert` → usa o helper compartilhado `_shared/mensagens.ts` para upsert de contato, criação/atualização de conversa e inserção de mensagem — mesmo fluxo que `whatsapp-webhook` já usa para a Cloud API. O Realtime do Supabase cuida do resto (frontend não muda).
- `connection.update` → atualiza `whatsapp_config.status_conexao` e `qrcode_base64` (limpa o QR quando o status vira `CONECTADO`).
- Valida um token compartilhado (`EVOLUTION_WEBHOOK_TOKEN`) para rejeitar chamadas que não vieram da Evolution API.

**`evolution-connect`**
- Admin-only (valida JWT + role).
- Chama a Evolution API para criar/conectar a instância configurada (`EVOLUTION_INSTANCE_NAME`) e obter o QR Code.
- Grava `status_conexao = CONECTANDO` e `qrcode_base64` em `whatsapp_config`.
- Se a Evolution API estiver inacessível/mal configurada, retorna erro claro (não derruba o restante do CRM).

**`evolution-toggle-canal`**
- Admin-only.
- Recebe `{ canal: 'QR_CODE' | 'API_OFICIAL' }` e atualiza `whatsapp_config.canal_ativo`.

**`_shared/mensagens.ts`**
- Extrai a lógica de upsert de contato → conversa → mensagem (incluindo upload de mídia) que hoje vive dentro de `whatsapp-webhook/index.ts`, para ser reaproveitada tanto por `whatsapp-webhook` quanto por `evolution-webhook`. Refatoração pontual — sem mudar comportamento existente.

### Modificadas

**`send-message`**
- Antes de enviar, lê `whatsapp_config.canal_ativo`.
- Se `API_OFICIAL`: comportamento atual, inalterado (chama Meta Cloud API).
- Se `QR_CODE`: chama o endpoint de envio de mensagem da Evolution API (`EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE_NAME`).
- Falha de envio (ex: sessão QR desconectada) é silenciosa, mesmo padrão já usado hoje em `useWhatsApp.js` — a mensagem permanece salva no banco mesmo se o envio real falhar.

**`whatsapp-webhook`**
- Passa a usar `_shared/mensagens.ts` em vez da lógica inline. Comportamento observável inalterado.

---

## 5. Frontend

**Nova página:** `src/pages/ConexaoWhatsAppPage.jsx`, rota `/crm/conexao`, visível só para `ADMIN`, ao lado de Métricas e Usuários no menu admin.

**Novo hook:** `src/hooks/useWhatsAppConexao.js` — assina `whatsapp_config` via Supabase Realtime (mesmo padrão de `useRealtime`) e expõe: gerar QR Code (chama `evolution-connect`), trocar canal (chama `evolution-toggle-canal`).

**UI da página:**
- Card "Canal Ativo": mostra o canal atual (QR Code / API Oficial) com opção de trocar.
- Quando `QR_CODE`: badge de status (Desconectado/Conectando/Conectado) + botão "Gerar/Atualizar QR Code" que exibe a imagem; ao ser escaneado, o Realtime atualiza o status para `CONECTADO` e a imagem some automaticamente.
- Quando `API_OFICIAL`: mensagem estática "Conectado via API Oficial" — sem novidade aqui, é o fluxo já existente.

**Sem mudanças em `ChatPanel`/`ConversaList`/`InputBar`** — o chat já é agnóstico de canal, pois toda a UI opera sobre as tabelas `conversas`/`mensagens`, que continuam preenchidas do mesmo jeito independente do canal de origem.

---

## 6. Variáveis de Ambiente / Secrets

Novos secrets do Supabase (além dos já existentes `WHATSAPP_*` da API oficial):

```env
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=
EVOLUTION_WEBHOOK_TOKEN=
```

---

## 7. Regras de Negócio

1. `canal_ativo` é uma configuração global — todos os agentes usam o mesmo canal ao mesmo tempo.
2. Trocar o canal é ação de ADMIN, feita na página `/crm/conexao`.
3. O recebimento de mensagens funciona pelos dois webhooks (`whatsapp-webhook` e `evolution-webhook`) simultaneamente — não há necessidade de desativar um quando o outro está ativo, já que na prática só um estará realmente conectado no WhatsApp a qualquer momento.
4. Falhas de envio (canal desconectado/mal configurado) não bloqueiam o registro da mensagem no banco — mesmo comportamento silencioso já usado hoje.

---

## 8. Fora de Escopo (YAGNI)

- Múltiplas instâncias/números simultâneos (QR + API rodando ao mesmo tempo para números diferentes) — não é o caso de uso atual, que é migração sequencial do mesmo número.
- Botão de "desconectar/logout" da sessão QR — trocar o canal para `API_OFICIAL` é suficiente para parar de enviar por ali; a sessão pode permanecer conectada em segundo plano sem problema.
- Deploy/hospedagem do serviço Evolution API — decisão operacional, fora do escopo deste design.
