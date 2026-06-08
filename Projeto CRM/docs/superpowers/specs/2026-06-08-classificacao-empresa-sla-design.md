# Classificação de Empresa, Mensagens por Tier e SLA Diferenciado
**Data:** 2026-06-08
**Projeto:** SCONT CRM WhatsApp
**Status:** Aprovado

---

## 1. Objetivo

Permitir que empresas vinculadas a contatos sejam classificadas em níveis Bronze, Prata e Ouro. A classificação habilita: (1) mensagens de boas-vindas personalizadas por tier no chatbot, (2) multiplicadores de SLA configuráveis pelo admin, aplicados ao prazo de cada departamento.

---

## 2. Escopo

### Incluído
- Migration 014: coluna `classificacao` em `contatos_empresas`; colunas de mensagens por tier em `chatbot_config`; colunas `classificacao_empresa` em `chatbot_sessoes` e `conversas`; tabela `classificacao_sla_config`
- Seletor Bronze/Prata/Ouro por empresa no `ModalContato` (edição de contatos)
- Badge colorido de tier no card expandido do contato e no `PainelDireito`
- Seção de mensagens por tier na `ChatbotPage` (override opcional por nível)
- Variáveis `{nome}` e `{tier}` suportadas em todas as mensagens de boas-vindas
- Seção de multiplicadores de SLA na `SLAConfigPage` (editável pelo admin)
- SLA efetivo calculado com multiplicador no temporizador do `PainelDireito`
- Lógica do chatbot: seleciona mensagem pelo tier mais alto entre as empresas do contato

### Excluído
- Histórico retroativo de classificação em conversas antigas
- Notificações automáticas ao cliente sobre seu tier
- Relatórios segmentados por tier (escopo futuro)

---

## 3. Banco de Dados — Migration 014

```sql
-- 3.1 Classificação por empresa vinculada
ALTER TABLE contatos_empresas
  ADD COLUMN IF NOT EXISTS classificacao TEXT
  CHECK (classificacao IN ('BRONZE', 'PRATA', 'OURO'));

-- 3.2 Mensagens de boas-vindas por tier no chatbot_config
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_bronze TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_prata  TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_ouro   TEXT;

-- 3.3 Classificação na sessão e na conversa
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS classificacao_empresa TEXT;
ALTER TABLE conversas       ADD COLUMN IF NOT EXISTS classificacao_empresa TEXT;

-- 3.4 Multiplicadores de SLA por tier (valores padrão configuráveis)
CREATE TABLE IF NOT EXISTS classificacao_sla_config (
  classificacao TEXT PRIMARY KEY
    CHECK (classificacao IN ('BRONZE', 'PRATA', 'OURO', 'SEM_CLASSIFICACAO')),
  multiplicador NUMERIC NOT NULL DEFAULT 1.0
    CHECK (multiplicador > 0)
);
INSERT INTO classificacao_sla_config (classificacao, multiplicador) VALUES
  ('OURO',              0.5),
  ('PRATA',             0.75),
  ('BRONZE',            1.0),
  ('SEM_CLASSIFICACAO', 1.0)
ON CONFLICT DO NOTHING;

-- 3.5 RLS para classificacao_sla_config
ALTER TABLE classificacao_sla_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "classificacao_sla_select" ON classificacao_sla_config;
DROP POLICY IF EXISTS "classificacao_sla_update" ON classificacao_sla_config;
CREATE POLICY "classificacao_sla_select" ON classificacao_sla_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "classificacao_sla_update" ON classificacao_sla_config
  FOR UPDATE TO authenticated USING (true);
```

**Cálculo do SLA efetivo:** `sla_efetivo_min = tempo_maximo_min × multiplicador_tier`

---

## 4. Cadastro de Contatos — `ContatosPage.jsx`

### 4.1 `ModalContato` — seletor por empresa

Cada linha de empresa no modal de edição/cadastro ganha um `<select>` de classificação:

```
┌──────────────────────────┬──────────────┬──────────┬────┐
│ Razão social             │ Cargo        │   ˅ tier │  × │
│ CNPJ (opcional)          │              │          │    │
└──────────────────────────┴──────────────┴──────────┴────┘
```

Opções: `— Sem classificação` | `🥉 Bronze` | `🥈 Prata` | `🥇 Ouro`

Persistido em `contatos_empresas.classificacao` (NULL quando sem classificação).

### 4.2 `ContatoCard` — badge no card expandido

Cada empresa exibe badge colorido ao lado do nome:

| Tier   | Texto   | Background |
|--------|---------|------------|
| 🥇 Ouro  | `#b8860b` | `#fff8dc`  |
| 🥈 Prata | `#708090` | `#f0f0f0`  |
| 🥉 Bronze | `#8b4513` | `#fdf0e8`  |

### 4.3 Queries atualizadas

`handleEditar` e `carregarDetalhes` passam a selecionar `empresa, cargo, cnpj, classificacao` de `contatos_empresas`.

A planilha de importação ganha coluna `classificacao` (valores aceitos: `bronze`, `prata`, `ouro` — case-insensitive; outros valores → NULL).

---

## 5. ChatbotPage — mensagens por tier

Nova seção **"Mensagens de boas-vindas por classificação"** abaixo da mensagem padrão existente:

```
Padrão (obrigatório)       [textarea: msg_boas_vindas          ]
🥉 Bronze (opcional)       [textarea: msg_boas_vindas_bronze   ]
🥈 Prata  (opcional)       [textarea: msg_boas_vindas_prata    ]
🥇 Ouro   (opcional)       [textarea: msg_boas_vindas_ouro     ]

Variáveis disponíveis: {nome} · {tier}
```

Campos opcionais: vazios = usa a mensagem padrão.

---

## 6. SLAConfigPage — multiplicadores

Nova seção **"Multiplicadores de SLA por classificação"** abaixo da tabela de departamentos:

```
Classificação      Multiplicador    SLA efetivo (ref: maior dept)
─────────────      ─────────────    ─────────────────────────────
🥉 Bronze          [ 1,00 × ]       8h 00min
🥈 Prata           [ 0,75 × ]       6h 00min
🥇 Ouro            [ 0,50 × ]       4h 00min
Sem classificação  [ 1,00 × ]       8h 00min
                                    [ Salvar multiplicadores ]
```

- O "SLA efetivo (ref)" é calculado com o maior `tempo_maximo_min` dos departamentos ativos, apenas como referência visual
- Valores salvos/lidos de `classificacao_sla_config` via novas funções em `crm.service.js`:
  - `buscarClassificacaoSLAConfig()` → SELECT todos os 4 registros
  - `salvarClassificacaoSLAConfig(rows)` → UPSERT

---

## 7. Chatbot — `chatbot-processor.ts`

### 7.1 Interface `ChatbotConfig` (atualização)

```typescript
export interface ChatbotConfig {
  // ... campos existentes ...
  msg_boas_vindas_bronze: string | null
  msg_boas_vindas_prata:  string | null
  msg_boas_vindas_ouro:   string | null
}
```

### 7.2 Interface `BotSessao` (atualização)

```typescript
classificacao_empresa: string | null  // 'BRONZE' | 'PRATA' | 'OURO' | null
```

### 7.3 Função auxiliar `resolverMensagemBoasVindas`

```typescript
const TIER_ORDEM = { OURO: 3, PRATA: 2, BRONZE: 1 }

function resolverMensagemBoasVindas(
  config: ChatbotConfig,
  empresas: { classificacao: string | null }[],
  nome: string,
  tierOverride?: string | null
): string {
  const tier = tierOverride
    ?? empresas.reduce<string | null>((melhor, e) => {
      if (!e.classificacao) return melhor
      if (!melhor) return e.classificacao
      return (TIER_ORDEM[e.classificacao] ?? 0) > (TIER_ORDEM[melhor] ?? 0)
        ? e.classificacao : melhor
    }, null)

  const msgBase =
    (tier === 'OURO'   && config.msg_boas_vindas_ouro)   ? config.msg_boas_vindas_ouro   :
    (tier === 'PRATA'  && config.msg_boas_vindas_prata)  ? config.msg_boas_vindas_prata  :
    (tier === 'BRONZE' && config.msg_boas_vindas_bronze) ? config.msg_boas_vindas_bronze :
    config.msg_boas_vindas

  const tierLabel = tier
    ? tier.charAt(0) + tier.slice(1).toLowerCase()  // 'Ouro', 'Prata', 'Bronze'
    : ''

  return msgBase
    .replace(/\{nome\}/g,  nome)
    .replace(/\{tier\}/g,  tierLabel)
}
```

### 7.4 `handleNOVO` — uso da função

- Recorrente: usa `classificacao` da empresa anterior (recuperada por UUID)
- Novo: usa o tier mais alto entre `contatos_empresas` do contato

### 7.5 `handleAGUARD_EMPRESA` — persistência

Ao salvar empresa na sessão, também salva `classificacao`:

```typescript
await supabase.from('chatbot_sessoes').update({
  empresa_selecionada: empresa,
  cnpj_selecionado:    cnpj,
  classificacao_empresa: classificacao,  // novo
}).eq('id', sessao.id)

await supabase.from('conversas').update({
  bot_empresa:           empresa,
  bot_cnpj:              cnpj,
  classificacao_empresa: classificacao,  // novo
}).eq('id', conversa.id)
```

---

## 8. PainelDireito — badge tier e SLA efetivo

### 8.1 Badge de tier no bloco "Contexto do bot"

```jsx
{conversa.classificacao_empresa && (
  <span style={{
    background: TIER_BG[conversa.classificacao_empresa],
    color:      TIER_COLOR[conversa.classificacao_empresa],
    fontSize: 10, fontWeight: 700,
    padding: '2px 7px', borderRadius: 3,
  }}>
    {TIER_EMOJI[conversa.classificacao_empresa]} {conversa.classificacao_empresa.charAt(0) + conversa.classificacao_empresa.slice(1).toLowerCase()}
  </span>
)}
```

Constantes:
```typescript
const TIER_BG    = { OURO: '#fff8dc', PRATA: '#f0f0f0', BRONZE: '#fdf0e8' }
const TIER_COLOR = { OURO: '#b8860b', PRATA: '#708090', BRONZE: '#8b4513' }
const TIER_EMOJI = { OURO: '🥇',      PRATA: '🥈',      BRONZE: '🥉'      }
```

### 8.2 SLA efetivo com multiplicador

O `PainelDireito` já lê `sla_config` por departamento. Passa a também ler `classificacao_sla_config` e aplica:

```typescript
const multiplicador = slaClassificacao[conversa.classificacao_empresa ?? 'SEM_CLASSIFICACAO'] ?? 1.0
const slaEfetivo    = dept.tempo_maximo_min * multiplicador
```

O cronômetro e as barras de alerta usam `slaEfetivo` em vez de `tempo_maximo_min` direto.

---

## 9. Planilha de Importação — `ModalImportarPlanilha.jsx`

Coluna `classificacao` adicionada ao modelo `.xlsx`:

| nome | telefone | cpf_cnpj | empresa | cnpj_empresa | classificacao | cargo | email | observacoes |
|------|----------|----------|---------|--------------|---------------|-------|-------|-------------|
| João | 556199…  | …        | ACME    | 12.345…      | ouro          | Sócio | …     |             |

Valores aceitos (case-insensitive): `bronze`, `prata`, `ouro`. Outros → NULL.

---

## 10. Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/014_classificacao_empresa.sql` | Migration completa |
| `src/pages/ContatosPage.jsx` | Seletor tier por empresa, badge no card, query atualizada |
| `src/pages/ChatbotPage.jsx` | Seção mensagens por tier |
| `src/pages/SLAConfigPage.jsx` | Seção multiplicadores |
| `src/services/crm.service.js` | `buscarClassificacaoSLAConfig`, `salvarClassificacaoSLAConfig` |
| `src/components/PainelDireito/PainelDireito.jsx` | Badge tier, SLA efetivo com multiplicador |
| `supabase/functions/whatsapp-webhook/chatbot-processor.ts` | `resolverMensagemBoasVindas`, persistência de `classificacao_empresa` |
| `src/components/ContatosImport/ModalImportarPlanilha.jsx` | Coluna `classificacao` no modelo e no import |

---

## 11. Ordem de Implementação

1. Migration 014 (schema)
2. `ContatosPage` — seletor + badge (base para testar o campo)
3. `ChatbotPage` — seção mensagens por tier
4. `SLAConfigPage` — seção multiplicadores + service functions
5. `chatbot-processor.ts` — `resolverMensagemBoasVindas` + persistência
6. `PainelDireito` — badge + SLA efetivo
7. `ModalImportarPlanilha` — coluna classificacao
