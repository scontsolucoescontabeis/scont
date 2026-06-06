# Chatbot de Roteamento — Design Spec
**Data:** 2026-06-05  
**Projeto:** SCONT CRM WhatsApp  
**Status:** Aprovado

---

## 1. Objetivo

Implantar um chatbot interativo no fluxo de mensagens WhatsApp que:
- Direciona automaticamente cada conversa para o departamento correto
- Coleta o motivo do contato em até 3 níveis (departamento → categoria → sub-categoria)
- Entrega contexto completo ao agente humano antes do primeiro "oi"
- Permite ao admin ligar/desligar o bot e editar menus sem código

---

## 2. Escopo

### Incluído
- Fluxo de roteamento com Lista Interativa do WhatsApp (fallback texto numerado)
- 4 departamentos: Pessoal, Contabilidade, Tributário/Fiscal, Administrativo
- 3 níveis de menu configuráveis pelo admin
- 12 funcionalidades enterprise (listadas na seção 5)
- Painel admin `/crm/chatbot` com 4 abas
- Integração com tabela `conversas` (novas colunas de contexto)
- Migration SQL idempotente (008)

### Excluído
- Integração com IA generativa (LLM) — apenas menus determinísticos
- Chatbot para outros canais além de WhatsApp
- Múltiplos números de WhatsApp

---

## 3. Arquitetura

### Modelo de interação
**Lista Interativa** da Meta Cloud API (`type: "interactive"`, `action.type: "list"`). Suporta até 10 itens por lista, com um botão de abertura (ex: "Ver opções"). Se a Meta API retornar erro na tentativa interativa, o ChatbotProcessor reenvia imediatamente como texto numerado simples (fallback). A resposta do cliente no fallback é um número ("1", "2", etc.) ou "0" para atendente.

### Onde vive a lógica
Módulo `ChatbotProcessor` embutido na Edge Function `whatsapp-webhook` (TypeScript). Sem nova função separada — reduz latência e complexidade de deploy.

### Fluxo de uma mensagem recebida
```
WhatsApp → whatsapp-webhook → ChatbotProcessor → Meta API (resposta)
                                      ↓
                               Supabase DB (sessão + mensagem)
```

Se `chatbot_config.bot_ativo = false` → mensagem vai direto para fila humana (comportamento atual).

---

## 4. Banco de Dados (Migration 008)

### Novas tabelas

#### `chatbot_config` (1 linha — configuração global)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | INT DEFAULT 1 | Sempre 1 (singleton) |
| bot_ativo | BOOLEAN | Liga/desliga o bot globalmente |
| horario_inicio | TIME | Início do atendimento (ex: 08:00) |
| horario_fim | TIME | Fim do atendimento (ex: 18:00) |
| dias_semana | INT[] | Ex: [1,2,3,4,5] = seg–sex |
| timeout_minutos | INT DEFAULT 15 | Sessão expira após inatividade |
| max_tentativas | INT DEFAULT 3 | Respostas inválidas antes de escalar |
| msg_boas_vindas | TEXT | Mensagem de abertura |
| msg_fora_horario | TEXT | Mensagem fora do expediente |
| msg_fila | TEXT | Mensagem após roteamento (suporta {departamento}, {assunto}, {protocolo}) |
| atualizado_em | TIMESTAMPTZ | |

#### `chatbot_dept_config` (1 linha por departamento)
| Coluna | Tipo | Descrição |
|---|---|---|
| departamento | departamento_enum PK | |
| ativo | BOOLEAN DEFAULT true | |
| horario_inicio | TIME | Override por departamento (NULL = usa global) |
| horario_fim | TIME | |
| msg_especifica | TEXT | Mensagem customizada ao selecionar este depto |

#### `chatbot_menus` (árvore de menus)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| parent_id | UUID FK self | NULL = raiz (nível departamento) |
| departamento | departamento_enum | Redundante para queries diretas |
| titulo | TEXT | Texto exibido ao cliente |
| nivel | INT | 1=departamento, 2=categoria, 3=sub-categoria |
| ordem | INT | Ordem de exibição |
| ativo | BOOLEAN DEFAULT true | |

#### `chatbot_sessoes` (estado do bot por conversa)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| conversa_id | UUID FK conversas UNIQUE | |
| estado | TEXT | NOVO, AGUARD_DEPT, AGUARD_CAT, AGUARD_SUB, AGUARD_CONF, AGUARD_AVAL, CONCLUIDO |
| dept_selecionado | departamento_enum | |
| categoria_id | UUID FK chatbot_menus | |
| subcategoria_id | UUID FK chatbot_menus | |
| tentativas_invalidas | INT DEFAULT 0 | |
| iniciado_em | TIMESTAMPTZ | |
| ultimo_em | TIMESTAMPTZ | |

#### `chatbot_avaliacoes` (CSAT)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| conversa_id | UUID FK conversas | |
| nota | INT CHECK (1..5) | |
| comentario | TEXT | |
| criado_em | TIMESTAMPTZ | |

### Colunas adicionadas à tabela `conversas`
```sql
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_departamento TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_categoria    TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_subcategoria TEXT;
```

---

## 5. Máquina de Estados do Bot

```
NOVO → AGUARD_DEPT → AGUARD_CAT → AGUARD_SUB → AGUARD_CONF → CONCLUIDO
                                                              ↓ (após encerramento)
                                                         AGUARD_AVAL
```

**Saída de emergência (qualquer estado):** cliente digita `0` ou `atendente` → estado = CONCLUIDO, conversa entregue ao humano sem dados de contexto parciais.

**Timeout:** job periódico ou trigger na leitura — se `ultimo_em < NOW() - timeout_minutos` e estado ≠ CONCLUIDO, envia aviso e encerra sessão.

**Tentativas inválidas:** contador em `chatbot_sessoes.tentativas_invalidas`. Ao atingir `max_tentativas`, encaminha para humano.

**Cliente recorrente:** se a última conversa encerrada do mesmo contato, no mesmo departamento, foi há menos de 30 dias → bot pula para AGUARD_CAT perguntando "é sobre o mesmo assunto (X)?" Se responder SIM → pula para AGUARD_SUB reutilizando a categoria anterior. Se responder NÃO → segue fluxo normal a partir de AGUARD_CAT.

---

## 6. Funcionalidades Enterprise

| # | Feature | Implementação |
|---|---|---|
| 1 | Desligar bot (global/por depto) | `chatbot_config.bot_ativo` + `chatbot_dept_config.ativo` |
| 2 | Horário de atendimento | Verificação no início do fluxo em `chatbot_config` / `chatbot_dept_config` |
| 3 | "Falar com atendente" a qualquer momento | Opção fixa na lista + detecção de "0"/"atendente" |
| 4 | Timeout de inatividade | Campo `ultimo_em` + checagem a cada mensagem recebida |
| 5 | Avaliação CSAT | Enviada pelo webhook `encerrar-conversa` para toda conversa (com ou sem bot). Novo estado AGUARD_AVAL em `chatbot_sessoes` (criada se não existia). Nota capturada na próxima mensagem do cliente após envio. |
| 6 | Cliente recorrente | Query em `conversas` por `contato_id` + `departamento` nos últimos 30 dias |
| 7 | Confirmação antes de rotear | Estado AGUARD_CONF — resume escolha e pede confirmação |
| 8 | Limite de tentativas inválidas | Contador em `chatbot_sessoes.tentativas_invalidas` |
| 9 | Coleta de protocolo anterior | Após confirmação, bot pergunta "tem protocolo de atendimento anterior?" |
| 10 | Tag automática | Ao CONCLUIDO, insere tags via `conversa_tags` com dept + categoria |
| 11 | Mensagem de fila de espera | Última mensagem do bot antes de CONCLUIDO — usa template `msg_fila` |
| 12 | Editor visual de fluxo (admin) | Página `/crm/chatbot` com árvore editável de `chatbot_menus` |

---

## 7. Painel Admin (`/crm/chatbot`)

Nova página, visível apenas para `role = ADMIN`. Acessível pelo menu lateral em "Administração".

### Aba Geral
- Toggle `bot_ativo` (liga/desliga global)
- Campos: `timeout_minutos`, `max_tentativas`
- Textareas editáveis: `msg_boas_vindas`, `msg_fora_horario`, `msg_fila`
- Botão "Salvar" — PATCH em `chatbot_config`

### Aba Menus
- Árvore renderizada a partir de `chatbot_menus`
- Ações: adicionar categoria/sub-item, editar título, excluir, reordenar (drag-and-drop via botões ↑↓)
- Cada departamento tem toggle ativo/inativo
- Sem "departamentos" novos via UI — departamentos = enum fixo do banco

### Aba Horários
- Horário global (`chatbot_config.horario_inicio/fim`) + dias da semana (checkboxes seg–dom)
- Override por departamento (`chatbot_dept_config`) com toggle por depto
- Campos de hora simples (input type="time")

### Aba Avaliações
- Nota média geral
- Distribuição por estrela (1–5) com barra proporcional
- Tabela com últimas 20 avaliações (nota + comentário + data + protocolo)
- Filtro por departamento e período

---

## 8. Visão do Agente (mudanças no frontend existente)

### `ConversaCard` — novos elementos
- Badge 🤖 quando `bot_departamento IS NOT NULL`
- Badge de categoria (`bot_categoria`) no card
- Badge "2ª visita" quando cliente recorrente

### `PainelDireito` — novo bloco "Contexto do bot"
- Card destacado (azul) com 3 campos: Departamento, Assunto, Detalhe
- Aparece apenas quando `bot_departamento IS NOT NULL`
- Posicionado acima dos dados do contato

### Chat — mensagem de sistema
- Linha `origem = 'SISTEMA'` exibida em estilo diferente (amarelo, itálico)
- Visível apenas no painel do agente — não enviada ao cliente

---

## 9. Impacto em Código Existente

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Adiciona módulo `ChatbotProcessor`, modifica `obterOuCriarConversa` para iniciar sessão bot, modifica `enviarBoasVindas` para usar fluxo do bot |
| `supabase/functions/encerrar-conversa/index.ts` | Após encerrar, inicia fluxo CSAT se sessão bot existir |
| `src/App.jsx` | Adiciona item "Chatbot" no menu lateral (admin only), importa `ChatbotPage` |
| `src/components/ConversaList/ConversaCard.jsx` | Badges de bot-categoria e 2ª visita |
| `src/components/PainelDireito/PainelDireito.jsx` | Bloco "Contexto do bot" |
| `src/components/ChatPanel/MessageBubble.jsx` | Estilo especial para origem `SISTEMA` |
| `src/services/crm.service.js` | Novas funções: `buscarChatbotConfig`, `salvarChatbotConfig`, `buscarMenus`, `salvarMenu`, `buscarAvaliacoes` |

---

## 10. Dados de Seed (Migration 008)

A migration inclui INSERT dos menus iniciais completos (ver Seção 4 da árvore aprovada) e 1 linha em `chatbot_config` com defaults. RLS habilitado em todas as novas tabelas: leitura por `authenticated`, escrita/update apenas por `role = ADMIN` (via função `get_user_role()` já existente). (4 departamentos, ~4 categorias cada, ~3-4 sub-itens cada) e 1 linha em `chatbot_config` com defaults razoáveis.

---

## 11. Ordem de Implementação

1. **Migration 008** — tabelas + seed de menus + colunas em `conversas`
2. **ChatbotProcessor** — módulo TypeScript com máquina de estados
3. **whatsapp-webhook** — integrar ChatbotProcessor
4. **encerrar-conversa** — trigger CSAT
5. **crm.service.js** — funções de chatbot
6. **ChatbotPage** — painel admin (4 abas)
7. **App.jsx** — rota e menu
8. **ConversaCard** — badges
9. **PainelDireito** — bloco contexto bot
10. **MessageBubble** — estilo SISTEMA
