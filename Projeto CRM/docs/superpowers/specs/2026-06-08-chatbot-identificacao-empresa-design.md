# Chatbot — Identificação de Empresa e Saudação Personalizada
**Data:** 2026-06-08  
**Projeto:** SCONT CRM WhatsApp  
**Status:** Aprovado

---

## 1. Objetivo

Personalizar o início do fluxo do chatbot para clientes cadastrados em `contatos`, saudando-os pelo nome e apresentando as empresas vinculadas a eles em `contatos_empresas`. A seleção de empresa (com CNPJ) é integrada em uma única pergunta combinada com o histórico recorrente, evitando múltiplas perguntas sequenciais. O contexto completo (empresa + CNPJ) é repassado ao agente humano com destaque visual.

---

## 2. Escopo

### Incluído
- Migration 013: coluna `cnpj` em `contatos_empresas`, colunas `bot_empresa`/`bot_cnpj` em `conversas`, colunas `empresa_selecionada`/`cnpj_selecionado` em `chatbot_sessoes`
- Novo estado `AGUARD_EMPRESA` na máquina de estados do bot
- Saudação personalizada com nome do contato cadastrado
- Lista dinâmica de empresas vinculadas + opção "Falar de outro assunto"
- Integração com histórico recorrente em uma única pergunta combinada
- Armazenamento de empresa selecionada em sessão e na conversa
- Destaque de empresa no bloco "Contexto do bot" do `PainelDireito`
- Mensagem de sistema com empresa incluída

### Excluído
- Cadastro de empresas pelo próprio cliente via chatbot
- Alteração no fluxo de AGUARD_DEPT em diante (inalterado)
- Retroação de histórico recorrente já existente com empresa (campo `bot_empresa` será nulo em conversas antigas)

---

## 3. Banco de Dados (Migration 013)

### 3.1 `contatos_empresas` — nova coluna
```sql
ALTER TABLE contatos_empresas ADD COLUMN IF NOT EXISTS cnpj TEXT;
```
CNPJ é nullable — nem toda empresa cadastrada tem CNPJ informado.

### 3.2 `chatbot_sessoes` — novas colunas
```sql
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS empresa_selecionada TEXT;
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS cnpj_selecionado    TEXT;
```
Persiste a escolha da empresa durante a sessão ativa do bot.

### 3.3 `conversas` — novas colunas
```sql
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_empresa TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_cnpj    TEXT;
```
Permite que agentes e relatórios consultem empresa do contexto bot mesmo após encerramento da sessão.

---

## 4. Máquina de Estados

```
NOVO → AGUARD_EMPRESA → AGUARD_DEPT → AGUARD_CAT → AGUARD_SUB → AGUARD_CONF → CONCLUIDO
                                                                              ↓ (encerramento)
                                                                         AGUARD_AVAL
```

`AGUARD_EMPRESA` é inserido **somente** quando o contato tem ao menos uma linha em `contatos_empresas`. Se não houver empresas vinculadas, o fluxo vai diretamente de `NOVO` para `AGUARD_DEPT`, preservando o comportamento atual.

**Nova constante de estado:**
```typescript
export type BotEstado =
  | 'NOVO'
  | 'AGUARD_EMPRESA'   // novo
  | 'AGUARD_DEPT'
  | 'AGUARD_CAT'
  | 'AGUARD_SUB'
  | 'AGUARD_CONF'
  | 'AGUARD_AVAL'
  | 'CONCLUIDO'
```

**Novos campos em `BotSessao`:**
```typescript
empresa_selecionada: string | null
cnpj_selecionado:    string | null
```

---

## 5. Lógica de `handleNOVO` (modificação)

### Fluxo com empresas vinculadas

1. Consulta `contatos_empresas` por `contato_id` — ordena por `criado_em ASC`.
2. Consulta histórico recorrente (lógica existente: conversa encerrada nos últimos 30 dias com `bot_departamento` preenchido).
3. Monta lista dinâmica:

| Condição | Opções geradas |
|---|---|
| Tem recorrente | Opção combinada no topo: `🔄 [Empresa] — mesmo assunto de antes: [categoria anterior]` com ID `EMPRESA_REC:{ce_id}:{cat_id\|''}` onde `ce_id` é o UUID da linha em `contatos_empresas` |
| Para cada empresa | `🏢 [Nome] (CNPJ: XX.XXX.XXX/XXXX-XX)` ou `🏢 [Nome]` se sem CNPJ, com ID `EMPRESA:{ce_id}` |
| Sempre ao final | `💬 Falar de outro assunto` com ID `OUTRO_ASSUNTO` |

> **Nota de parsing:** usar o UUID (`ce_id`) nos IDs evita colisão com `:` em nomes de empresa. Em `handleAGUARD_EMPRESA`, ao receber o ID, faz-se `SELECT empresa, cnpj FROM contatos_empresas WHERE id = :ce_id` para recuperar os dados.

4. Saudação: *"Olá, [nomeContato]! 👋 Sobre qual empresa você gostaria de falar?"*
5. Transição de estado: `AGUARD_EMPRESA`

### Fluxo sem empresas (inalterado)
Segue o comportamento atual: verifica recorrente → saudação → menu de departamentos → `AGUARD_DEPT`.

---

## 6. Novo Handler `handleAGUARD_EMPRESA`

Processa a resposta do cliente no estado `AGUARD_EMPRESA`.

### IDs de resposta e suas ações

| ID recebido | Ação |
|---|---|
| `EMPRESA_REC:{ce_id}:{cat_id}` | Busca `empresa`+`cnpj` via `ce_id`; salva na sessão; restaura dept e categoria anterior; vai para `AGUARD_SUB` (ou `AGUARD_CONF` se sem subcategorias) |
| `EMPRESA:{ce_id}` | Busca `empresa`+`cnpj` via `ce_id`; salva na sessão; vai para `AGUARD_DEPT` |
| `OUTRO_ASSUNTO` | Não salva empresa; vai para `AGUARD_DEPT` com mensagem de boas-vindas normal |
| `HUMANO` | Escala para atendente humano (comportamento padrão de escape) |
| inválido | Incrementa `tentativas_invalidas`; reexibe a lista; escala se atingir `max_tentativas` |

### Persistência da empresa
Ao salvar empresa na sessão, também atualiza a conversa:
```sql
UPDATE conversas
SET bot_empresa = :empresa, bot_cnpj = :cnpj
WHERE id = :conversa_id
```

---

## 7. Integração com `handleAGUARD_CONF` (modificação menor)

Ao confirmar o roteamento, a mensagem de sistema inclui a empresa quando preenchida:

- Sem empresa: `🤖 Bot roteou: Contabilidade › Folha de Pagamento`
- Com empresa: `🤖 Bot roteou: [Empresa A] — Contabilidade › Folha de Pagamento`

A coluna `bot_empresa` já foi salva em `AGUARD_EMPRESA`; `handleAGUARD_CONF` apenas lê da sessão para compor a string.

---

## 8. Painel do Agente — `PainelDireito` (modificação)

O bloco "Contexto do bot" exibe a empresa no topo, com badge de destaque azul escuro:

```
┌─────────────────────────────────────┐
│ 🤖 Contexto do bot                  │
│                                     │
│ 🏢 Empresa   [Empresa A]            │  ← badge azul escuro, exibe só se preenchido
│    CNPJ      12.345.678/0001-90     │  ← exibe só se bot_cnpj preenchido
│                                     │
│ Departamento  Contabilidade         │
│ Assunto       Folha de Pagamento    │
│ Detalhe       13º Salário           │
└─────────────────────────────────────┘
```

O campo Empresa aparece **somente** quando `bot_empresa IS NOT NULL`. O campo CNPJ aparece **somente** quando `bot_cnpj IS NOT NULL`.

---

## 9. Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/013_empresa_chatbot.sql` | Nova migration com as 4 alterações de schema |
| `supabase/functions/whatsapp-webhook/chatbot-processor.ts` | Novo estado `AGUARD_EMPRESA`, novos campos em `BotSessao`, `handleNOVO` modificado, novo `handleAGUARD_EMPRESA`, `handleAGUARD_CONF` com empresa na msg sistema, switch atualizado |
| `src/components/PainelDireito/PainelDireito.jsx` (ou `.tsx`) | Campos Empresa e CNPJ no bloco "Contexto do bot" |

---

## 10. Ordem de Implementação

1. **Migration 013** — schema
2. **`chatbot-processor.ts`** — estado, `BotSessao`, `handleNOVO`, `handleAGUARD_EMPRESA`, `handleAGUARD_CONF`
3. **`PainelDireito`** — campos Empresa e CNPJ no bloco de contexto
