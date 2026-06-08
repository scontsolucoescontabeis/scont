# Classificação de Empresa, Mensagens por Tier e SLA Diferenciado — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar classificação Bronze/Prata/Ouro por empresa vinculada, com mensagens de boas-vindas personalizadas no chatbot e SLA diferenciado por multiplicador configurável.

**Architecture:** A classificação vive em `contatos_empresas.classificacao`. O chatbot lê o tier mais alto no `handleNOVO` e escolhe a mensagem adequada. O SLA aplica um multiplicador por tier em `useSLA.js`. A UI de configuração fica repartida entre `ChatbotPage` (mensagens) e `SLAConfigPage` (multiplicadores).

**Tech Stack:** React + Vite, Supabase (PostgreSQL + Edge Functions Deno/TypeScript), inline styles.

**Spec:** `docs/superpowers/specs/2026-06-08-classificacao-empresa-sla-design.md`

---

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/014_classificacao_empresa.sql` | Criar |
| `src/services/crm.service.js` | Modificar — 2 novas funções |
| `src/pages/ContatosPage.jsx` | Modificar — seletor tier + badge |
| `src/pages/ChatbotPage.jsx` | Modificar — seção mensagens por tier |
| `src/pages/SLAConfigPage.jsx` | Modificar — seção multiplicadores |
| `src/hooks/useSLA.js` | Modificar — aplicar multiplicador |
| `src/pages/CRMPage.jsx` | Modificar — carregar classificacaoSLAConfig |
| `src/components/ConversaList/ConversaList.jsx` | Modificar — prop classificacaoSLAConfig |
| `src/hooks/useConversas.js` | Modificar — adicionar classificacao_empresa ao SELECT |
| `supabase/functions/whatsapp-webhook/chatbot-processor.ts` | Modificar — resolverMensagemBoasVindas + persistência |
| `src/components/PainelDireito/PainelDireito.jsx` | Modificar — badge tier + query atualizada |
| `src/components/ContatosImport/ModalImportarPlanilha.jsx` | Modificar — coluna classificacao |

---

## Task 1: Migration 014

**Files:**
- Create: `supabase/migrations/014_classificacao_empresa.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/014_classificacao_empresa.sql

-- 1. Classificação por empresa vinculada
ALTER TABLE contatos_empresas
  ADD COLUMN IF NOT EXISTS classificacao TEXT
  CHECK (classificacao IN ('BRONZE', 'PRATA', 'OURO'));

-- 2. Mensagens de boas-vindas por tier no chatbot_config
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_bronze TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_prata  TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_ouro   TEXT;

-- 3. Classificação na sessão e na conversa
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS classificacao_empresa TEXT;
ALTER TABLE conversas       ADD COLUMN IF NOT EXISTS classificacao_empresa TEXT;

-- 4. Tabela global de multiplicadores SLA por tier
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

-- 5. RLS para classificacao_sla_config
ALTER TABLE classificacao_sla_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "classificacao_sla_select" ON classificacao_sla_config;
DROP POLICY IF EXISTS "classificacao_sla_update" ON classificacao_sla_config;
CREATE POLICY "classificacao_sla_select" ON classificacao_sla_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "classificacao_sla_update" ON classificacao_sla_config
  FOR UPDATE TO authenticated USING (true);
```

- [ ] **Step 2: Aplicar no Supabase**

Abrir o Supabase Dashboard → SQL Editor → colar o conteúdo do arquivo → executar.
Verificar que não houve erros. As colunas novas devem aparecer nas tabelas respectivas.

- [ ] **Step 3: Commit**

```bash
git add "Projeto CRM/supabase/migrations/014_classificacao_empresa.sql"
git commit -m "feat: migration 014 — classificação empresa, mensagens tier, SLA config"
```

---

## Task 2: Funções de serviço para classificacaoSLAConfig

**Files:**
- Modify: `src/services/crm.service.js` (ao final do arquivo, após `salvarSLAConfig`)

- [ ] **Step 1: Adicionar as duas funções ao final de `crm.service.js`**

Localizar a última linha do arquivo (após `salvarSLAConfig`) e adicionar:

```javascript
// ─── Classificação SLA Config ──────────────────────────────────

export async function buscarClassificacaoSLAConfig() {
  const { data, error } = await supabase
    .from('classificacao_sla_config')
    .select('*')
    .order('classificacao')
  if (error) throw error
  return data ?? []
}

export async function salvarClassificacaoSLAConfig(rows) {
  const { error } = await supabase
    .from('classificacao_sla_config')
    .upsert(rows, { onConflict: 'classificacao' })
  if (error) throw error
}
```

- [ ] **Step 2: Verificar**

Abrir o navegador com o CRM logado. No console do browser rodar:
```javascript
import('@/services/crm.service').then(m => m.buscarClassificacaoSLAConfig().then(console.log))
```
Deve retornar os 4 registros com multiplicadores padrão (BRONZE=1, OURO=0.5, PRATA=0.75, SEM_CLASSIFICACAO=1).

- [ ] **Step 3: Commit**

```bash
git add "Projeto CRM/src/services/crm.service.js"
git commit -m "feat: buscarClassificacaoSLAConfig e salvarClassificacaoSLAConfig"
```

---

## Task 3: Classificação no cadastro de contatos

**Files:**
- Modify: `src/pages/ContatosPage.jsx`

### 3a — Constantes e estado

- [ ] **Step 1: Atualizar `EMPRESA_VAZIA` para incluir `classificacao`**

Localizar a linha:
```javascript
const EMPRESA_VAZIA = { empresa: '', cargo: '', cnpj: '' }
```
Substituir por:
```javascript
const EMPRESA_VAZIA = { empresa: '', cargo: '', cnpj: '', classificacao: '' }
```

- [ ] **Step 2: Atualizar o map de `empresasIniciais` no `useState`**

Localizar:
```javascript
? empresasIniciais.map(e => ({ empresa: e.empresa, cargo: e.cargo ?? '', cnpj: e.cnpj ?? '', _key: crypto.randomUUID() }))
```
Substituir por:
```javascript
? empresasIniciais.map(e => ({ empresa: e.empresa, cargo: e.cargo ?? '', cnpj: e.cnpj ?? '', classificacao: e.classificacao ?? '', _key: crypto.randomUUID() }))
```

### 3b — Salvar classificacao no insert

- [ ] **Step 3: Atualizar o insert em `handleSalvar`**

Localizar:
```javascript
        const { error: errUp } = await supabase.from('contatos_empresas').insert({
          contato_id: contatoId,
          empresa:    item.empresa.trim(),
          cargo:      item.cargo.trim() || null,
          cnpj:       item.cnpj.trim() || null,
        })
```
Substituir por:
```javascript
        const { error: errUp } = await supabase.from('contatos_empresas').insert({
          contato_id:    contatoId,
          empresa:       item.empresa.trim(),
          cargo:         item.cargo.trim() || null,
          cnpj:          item.cnpj.trim() || null,
          classificacao: item.classificacao || null,
        })
```

### 3c — Queries que precisam retornar classificacao

- [ ] **Step 4: Atualizar select em `handleEditar`**

Localizar:
```javascript
        .select('empresa, cargo, cnpj')
        .eq('contato_id', contato.id)
        .order('criado_em')
```
Substituir por:
```javascript
        .select('empresa, cargo, cnpj, classificacao')
        .eq('contato_id', contato.id)
        .order('criado_em')
```

- [ ] **Step 5: Atualizar select em `carregarDetalhes` (dentro de `ContatoCard`)**

Localizar:
```javascript
      supabase
        .from('contatos_empresas')
        .select('empresa, cargo, cnpj')
        .eq('contato_id', contato.id)
        .order('criado_em', { ascending: true }),
```
Substituir por:
```javascript
      supabase
        .from('contatos_empresas')
        .select('empresa, cargo, cnpj, classificacao')
        .eq('contato_id', contato.id)
        .order('criado_em', { ascending: true }),
```

### 3d — Seletor de tier no formulário do modal

- [ ] **Step 6: Adicionar constante de tier no topo do arquivo (após EMPRESA_VAZIA)**

```javascript
const TIER_OPTIONS = [
  { value: '',       label: '— Sem classificação' },
  { value: 'BRONZE', label: '🥉 Bronze' },
  { value: 'PRATA',  label: '🥈 Prata' },
  { value: 'OURO',   label: '🥇 Ouro' },
]
```

- [ ] **Step 7: Adicionar o `<select>` de tier na linha de empresa, ao lado de Cargo**

Localizar o bloco de campos da empresa no modal (linha de inputs empresa/cargo/X):
```jsx
                <div key={item._key ?? i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                    <input
                      value={item.empresa}
                      onChange={setEmpresa(i, 'empresa')}
                      placeholder="Razão social ou nome"
                      style={{ ...inputStyle, flex: 2 }}
                    />
                    <input
                      value={item.cargo}
                      onChange={setEmpresa(i, 'cargo')}
                      placeholder="Cargo / Função"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    {empresas.length > 1 && (
                      <button type="button" onClick={() => removeEmpresa(i)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '8px 4px', color: '#888480', flexShrink: 0,
                      }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
```
Substituir por:
```jsx
                <div key={item._key ?? i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                    <input
                      value={item.empresa}
                      onChange={setEmpresa(i, 'empresa')}
                      placeholder="Razão social ou nome"
                      style={{ ...inputStyle, flex: 2 }}
                    />
                    <input
                      value={item.cargo}
                      onChange={setEmpresa(i, 'cargo')}
                      placeholder="Cargo / Função"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <select
                      value={item.classificacao}
                      onChange={setEmpresa(i, 'classificacao')}
                      style={{ ...inputStyle, flex: '0 0 140px' }}
                    >
                      {TIER_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {empresas.length > 1 && (
                      <button type="button" onClick={() => removeEmpresa(i)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '8px 4px', color: '#888480', flexShrink: 0,
                      }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
```

### 3e — Badge de tier no card expandido

- [ ] **Step 8: Adicionar badge na listagem de empresas dentro de `ContatoCard`**

Localizar:
```jsx
              ) : empresas.map((e, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{e.empresa}</span>
                  {e.cargo && <span style={{ fontSize: 11, color: '#888480' }}> · {e.cargo}</span>}
                  {e.cnpj && (
                    <div style={{ fontSize: 10, color: '#888480', fontFamily: 'DM Mono, monospace', marginTop: 1 }}>
                      CNPJ {e.cnpj}
                    </div>
                  )}
                </div>
              ))}
```
Substituir por:
```jsx
              ) : empresas.map((e, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{e.empresa}</span>
                    {e.cargo && <span style={{ fontSize: 11, color: '#888480' }}>· {e.cargo}</span>}
                    {e.classificacao && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                        background: TIER_BG[e.classificacao],
                        color: TIER_COLOR[e.classificacao],
                      }}>
                        {TIER_EMOJI[e.classificacao]} {e.classificacao.charAt(0) + e.classificacao.slice(1).toLowerCase()}
                      </span>
                    )}
                  </div>
                  {e.cnpj && (
                    <div style={{ fontSize: 10, color: '#888480', fontFamily: 'DM Mono, monospace', marginTop: 1 }}>
                      CNPJ {e.cnpj}
                    </div>
                  )}
                </div>
              ))}
```

- [ ] **Step 9: Adicionar constantes de cor de tier logo após `TIER_OPTIONS`**

```javascript
const TIER_BG    = { OURO: '#fff8dc', PRATA: '#f0f0f0', BRONZE: '#fdf0e8' }
const TIER_COLOR = { OURO: '#b8860b', PRATA: '#708090', BRONZE: '#8b4513' }
const TIER_EMOJI = { OURO: '🥇',      PRATA: '🥈',      BRONZE: '🥉'      }
```

- [ ] **Step 10: Verificar visualmente**

Editar um contato, adicionar empresa com tier "Ouro", salvar. Expandir o card — deve aparecer o badge dourado ao lado do nome da empresa.

- [ ] **Step 11: Commit**

```bash
git add "Projeto CRM/src/pages/ContatosPage.jsx"
git commit -m "feat: classificação Bronze/Prata/Ouro por empresa vinculada no cadastro"
```

---

## Task 4: ChatbotPage — mensagens por tier

**Files:**
- Modify: `src/pages/ChatbotPage.jsx`

- [ ] **Step 1: Adicionar campos de tier logo após `msg_boas_vindas` na `AbaGeral`**

Localizar (linha ~275):
```jsx
      <CampoTexto
        label="💬 Mensagem de boas-vindas"
        value={config.msg_boas_vindas}
        onChange={v => setConfig(c => ({ ...c, msg_boas_vindas: v }))}
        rows={2}
      />
      <CampoTexto
        label="🌙 Mensagem fora do horário"
```
Substituir por:
```jsx
      <CampoTexto
        label="💬 Mensagem de boas-vindas (padrão)"
        value={config.msg_boas_vindas}
        onChange={v => setConfig(c => ({ ...c, msg_boas_vindas: v }))}
        rows={2}
        hint="Variáveis: {nome}"
      />

      <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fafaf9', border: '1px solid #e0dcd8', borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 10, fontFamily: 'DM Sans, sans-serif' }}>
          💎 Mensagens por classificação (deixe vazio para usar a mensagem padrão)
        </div>
        <div style={{ fontSize: 10, color: '#aaa', marginBottom: 10, fontFamily: 'DM Sans, sans-serif' }}>
          Variáveis: {'{nome}'} · {'{tier}'}
        </div>
        <CampoTexto
          label="🥉 Bronze"
          value={config.msg_boas_vindas_bronze ?? ''}
          onChange={v => setConfig(c => ({ ...c, msg_boas_vindas_bronze: v || null }))}
          rows={2}
        />
        <CampoTexto
          label="🥈 Prata"
          value={config.msg_boas_vindas_prata ?? ''}
          onChange={v => setConfig(c => ({ ...c, msg_boas_vindas_prata: v || null }))}
          rows={2}
        />
        <CampoTexto
          label="🥇 Ouro"
          value={config.msg_boas_vindas_ouro ?? ''}
          onChange={v => setConfig(c => ({ ...c, msg_boas_vindas_ouro: v || null }))}
          rows={2}
        />
      </div>

      <CampoTexto
        label="🌙 Mensagem fora do horário"
```

- [ ] **Step 2: Verificar visualmente**

Abrir a página de configuração do chatbot → aba Geral → confirmar que os 3 campos de tier aparecem abaixo da mensagem padrão, dentro de um bloco cinza claro.

- [ ] **Step 3: Commit**

```bash
git add "Projeto CRM/src/pages/ChatbotPage.jsx"
git commit -m "feat: mensagens de boas-vindas por tier na ChatbotPage"
```

---

## Task 5: SLAConfigPage — multiplicadores por tier

**Files:**
- Modify: `src/pages/SLAConfigPage.jsx`

- [ ] **Step 1: Adicionar imports no topo do arquivo**

Localizar:
```javascript
import { useState, useEffect } from 'react'
import { buscarSLAConfig, salvarSLAConfig } from '@/services/crm.service'
```
Substituir por:
```javascript
import { useState, useEffect } from 'react'
import { buscarSLAConfig, salvarSLAConfig, buscarClassificacaoSLAConfig, salvarClassificacaoSLAConfig } from '@/services/crm.service'
```

- [ ] **Step 2: Adicionar constante de tiers**

Logo após a definição de `DEPTOS`, adicionar:
```javascript
const TIERS = [
  { key: 'OURO',             label: '🥇 Ouro',             color: '#b8860b' },
  { key: 'PRATA',            label: '🥈 Prata',            color: '#708090' },
  { key: 'BRONZE',           label: '🥉 Bronze',           color: '#8b4513' },
  { key: 'SEM_CLASSIFICACAO',label: 'Sem classificação',   color: '#888480' },
]
```

- [ ] **Step 3: Adicionar estado para multiplicadores em `SLAConfigPage`**

Localizar dentro de `SLAConfigPage`:
```javascript
  const [config, setConfig]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [sucesso, setSucesso]   = useState(false)
```
Substituir por:
```javascript
  const [config, setConfig]             = useState([])
  const [multConfig, setMultConfig]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [salvando, setSalvando]         = useState(false)
  const [salvandoMult, setSalvandoMult] = useState(false)
  const [erro, setErro]                 = useState('')
  const [sucesso, setSucesso]           = useState(false)
  const [sucessoMult, setSucessoMult]   = useState(false)
```

- [ ] **Step 4: Atualizar o `useEffect` para também carregar multiplicadores**

Localizar:
```javascript
  useEffect(() => {
    buscarSLAConfig()
      .then(data => { setConfig(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
```
Substituir por:
```javascript
  useEffect(() => {
    Promise.all([buscarSLAConfig(), buscarClassificacaoSLAConfig()])
      .then(([sla, mult]) => { setConfig(sla); setMultConfig(mult); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
```

- [ ] **Step 5: Adicionar handler para salvar multiplicadores**

Logo após `handleSalvar`, adicionar:
```javascript
  const handleSalvarMult = async () => {
    setSalvandoMult(true)
    setSucessoMult(false)
    try {
      await salvarClassificacaoSLAConfig(multConfig)
      setSucessoMult(true)
      setTimeout(() => setSucessoMult(false), 3_000)
    } catch (e) {
      setErro(e.message || 'Erro ao salvar multiplicadores.')
    } finally {
      setSalvandoMult(false)
    }
  }

  const setMult = (key, valor) =>
    setMultConfig(prev => prev.map(r => r.classificacao === key ? { ...r, multiplicador: valor } : r))
```

- [ ] **Step 6: Adicionar seção de multiplicadores no JSX**

Localizar o bloco da legenda no JSX:
```jsx
      {/* Legenda */}
      <div style={{ marginTop: 12, fontSize: 11, color: '#888480', lineHeight: 1.7 }}>
```
Inserir logo ANTES desse bloco:

```jsx
      {/* Multiplicadores por classificação */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
          ⚡ Multiplicadores de SLA por classificação
        </h2>
        <p style={{ fontSize: 12, color: '#888480', margin: '0 0 14px', lineHeight: 1.6 }}>
          SLA efetivo = tempo máximo do departamento × multiplicador. Quanto menor, mais rápido o atendimento.
        </p>
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', background: '#f7f6f4', borderBottom: '1px solid #e0dcd8' }}>
            <div style={{ ...thStyle, textAlign: 'left', paddingLeft: 16 }}>Classificação</div>
            <div style={thStyle}>Multiplicador</div>
            <div style={thStyle}>Exemplo (maior depto)</div>
          </div>
          {TIERS.map((t, i) => {
            const row = multConfig.find(r => r.classificacao === t.key)
            if (!row) return null
            const maiorDepto = config.reduce((max, c) => c.ativo && c.tempo_maximo_min > max ? c.tempo_maximo_min : max, 0)
            const efetivo = Math.round(maiorDepto * row.multiplicador)
            const h = Math.floor(efetivo / 60)
            const m = efetivo % 60
            return (
              <div key={t.key} style={{
                display: 'grid', gridTemplateColumns: '180px 1fr 1fr',
                alignItems: 'center', padding: '10px 0',
                borderBottom: i < TIERS.length - 1 ? '1px solid #f0ede9' : 'none',
                borderLeft: `3px solid ${t.color}`,
              }}>
                <div style={{ paddingLeft: 13, fontSize: 12, fontWeight: 700, color: t.color }}>{t.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <input
                    type="number" min={0.1} max={5} step={0.05}
                    value={row.multiplicador}
                    onChange={e => setMult(t.key, parseFloat(e.target.value) || 1)}
                    style={{
                      width: 64, padding: '5px 8px',
                      border: `1px solid ${t.color}55`, borderRadius: 5,
                      fontSize: 13, fontFamily: 'DM Mono, monospace',
                      textAlign: 'center', color: t.color, fontWeight: 600,
                      outline: 'none', background: `${t.color}08`,
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#888480' }}>×</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 12, color: '#888480', fontFamily: 'DM Mono, monospace' }}>
                  {maiorDepto > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : '—'}
                </div>
              </div>
            )
          })}
        </div>
        {sucessoMult && (
          <div style={{ marginTop: 10, padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: 12 }}>
            Multiplicadores salvos com sucesso.
          </div>
        )}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSalvarMult}
            disabled={salvandoMult}
            style={{
              padding: '9px 24px', background: salvandoMult ? '#9b6b6b' : '#7a1e1e',
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: salvandoMult ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {salvandoMult ? 'Salvando...' : 'Salvar multiplicadores'}
          </button>
        </div>
      </div>

```

- [ ] **Step 7: Verificar visualmente**

Abrir a página de SLA → confirmar que a seção de multiplicadores aparece abaixo da tabela de departamentos, com os 4 tiers e inputs de multiplicador.

- [ ] **Step 8: Commit**

```bash
git add "Projeto CRM/src/pages/SLAConfigPage.jsx"
git commit -m "feat: multiplicadores de SLA por classificação na SLAConfigPage"
```

---

## Task 6: SLA efetivo com multiplicador em useSLA + CRMPage + ConversaList

**Files:**
- Modify: `src/hooks/useSLA.js`
- Modify: `src/pages/CRMPage.jsx`
- Modify: `src/components/ConversaList/ConversaList.jsx`

### 6a — useSLA.js

- [ ] **Step 1: Atualizar `calcSLAStatus` para aceitar `classificacaoConfig`**

Substituir o conteúdo de `src/hooks/useSLA.js` por:

```javascript
import { useState, useEffect } from 'react'

export function calcSLAStatus(conversa, slaConfig, classificacaoConfig = []) {
  if (conversa.status !== 'ABERTA') {
    return { sla_status: 'OK', sla_tempo_restante_ms: null }
  }
  const temMsgAgente = conversa.mensagens?.some(m => m.origem === 'AGENTE') ?? false
  if (temMsgAgente) {
    return { sla_status: 'OK', sla_tempo_restante_ms: null }
  }

  const cfg = slaConfig.find(c => c.departamento === conversa.departamento)
  if (!cfg || !cfg.ativo) {
    return { sla_status: 'OK', sla_tempo_restante_ms: null }
  }

  const tierKey = conversa.classificacao_empresa ?? 'SEM_CLASSIFICACAO'
  const multRow = classificacaoConfig.find(r => r.classificacao === tierKey)
  const mult    = multRow?.multiplicador ?? 1.0

  const maxMs     = cfg.tempo_maximo_min      * mult * 60_000
  const avisoMs   = cfg.threshold_aviso_min         * 60_000
  const criticoMs = cfg.threshold_critico_min       * 60_000
  const elapsed   = Date.now() - new Date(conversa.aberto_em).getTime()
  const restante  = maxMs - elapsed

  if (restante <= 0)         return { sla_status: 'VENCIDO', sla_tempo_restante_ms: 0 }
  if (restante <= criticoMs) return { sla_status: 'CRITICO', sla_tempo_restante_ms: restante }
  if (restante <= avisoMs)   return { sla_status: 'AVISO',   sla_tempo_restante_ms: restante }
  return { sla_status: 'OK', sla_tempo_restante_ms: restante }
}

export function useSLA(conversas, slaConfig, classificacaoConfig = []) {
  const [conversasComSLA, setConversasComSLA] = useState(() =>
    conversas.map(c => ({ ...c, ...calcSLAStatus(c, slaConfig, classificacaoConfig) }))
  )

  useEffect(() => {
    const calc = () =>
      setConversasComSLA(conversas.map(c => ({ ...c, ...calcSLAStatus(c, slaConfig, classificacaoConfig) })))

    calc()
    const id = setInterval(calc, 1_000)
    return () => clearInterval(id)
  }, [conversas, slaConfig, classificacaoConfig])

  return conversasComSLA
}
```

### 6b — CRMPage.jsx

- [ ] **Step 2: Carregar `classificacaoSLAConfig` em `CRMPage`**

Localizar:
```javascript
import { buscarSLAConfig } from '@/services/crm.service'
```
Substituir por:
```javascript
import { buscarSLAConfig, buscarClassificacaoSLAConfig } from '@/services/crm.service'
```

Localizar:
```javascript
  const [slaConfig, setSlaConfig]         = useState([])

  useEffect(() => {
    buscarSLAConfig().then(setSlaConfig).catch(() => {})
  }, [])
```
Substituir por:
```javascript
  const [slaConfig, setSlaConfig]                   = useState([])
  const [classificacaoSLAConfig, setClassificacaoSLAConfig] = useState([])

  useEffect(() => {
    buscarSLAConfig().then(setSlaConfig).catch(() => {})
    buscarClassificacaoSLAConfig().then(setClassificacaoSLAConfig).catch(() => {})
  }, [])
```

Localizar:
```javascript
  const abertasComSLA = useSLA(abertasParaSLA, slaConfig)
```
Substituir por:
```javascript
  const abertasComSLA = useSLA(abertasParaSLA, slaConfig, classificacaoSLAConfig)
```

Localizar onde `slaConfig={slaConfig}` é passado para `ConversaList`:
```jsx
        slaConfig={slaConfig}
```
Substituir por:
```jsx
        slaConfig={slaConfig}
        classificacaoSLAConfig={classificacaoSLAConfig}
```

### 6c — ConversaList.jsx

- [ ] **Step 3: Aceitar e usar `classificacaoSLAConfig` em `ConversaList`**

Localizar:
```javascript
export function ConversaList({ conversaAtiva, onSelecionarConversa, perfilRole, slaConfig = [] }) {
```
Substituir por:
```javascript
export function ConversaList({ conversaAtiva, onSelecionarConversa, perfilRole, slaConfig = [], classificacaoSLAConfig = [] }) {
```

Localizar:
```javascript
  const conversasComSLA = useSLA(conversas, slaConfig)
```
Substituir por:
```javascript
  const conversasComSLA = useSLA(conversas, slaConfig, classificacaoSLAConfig)
```

- [ ] **Step 4: Verificar**

Abrir o CRM com uma conversa em aberto de um contato que tem empresa com tier "Ouro". O badge de SLA deve alertar mais cedo (metade do tempo) comparado a um contato sem classificação.

- [ ] **Step 5: Commit**

```bash
git add "Projeto CRM/src/hooks/useSLA.js" "Projeto CRM/src/pages/CRMPage.jsx" "Projeto CRM/src/components/ConversaList/ConversaList.jsx"
git commit -m "feat: SLA efetivo com multiplicador por tier em useSLA, CRMPage e ConversaList"
```

---

## Task 7: chatbot-processor.ts — resolverMensagemBoasVindas + persistência

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/chatbot-processor.ts`

### 7a — Interface ChatbotConfig

- [ ] **Step 1: Adicionar campos de tier em `ChatbotConfig`**

Localizar:
```typescript
export interface ChatbotConfig {
  bot_ativo: boolean
  horario_inicio: string
  horario_fim: string
  dias_semana: number[]
  timeout_minutos: number
  max_tentativas: number
  msg_boas_vindas: string
  msg_fora_horario: string
  msg_fila: string
}
```
Substituir por:
```typescript
export interface ChatbotConfig {
  bot_ativo: boolean
  horario_inicio: string
  horario_fim: string
  dias_semana: number[]
  timeout_minutos: number
  max_tentativas: number
  msg_boas_vindas: string
  msg_fora_horario: string
  msg_fila: string
  msg_boas_vindas_bronze: string | null
  msg_boas_vindas_prata:  string | null
  msg_boas_vindas_ouro:   string | null
}
```

### 7b — Interface BotSessao

- [ ] **Step 2: Adicionar `classificacao_empresa` em `BotSessao`**

Localizar a interface `BotSessao` e adicionar o campo:
```typescript
  classificacao_empresa: string | null
```
(após `cnpj_selecionado: string | null`)

### 7c — Função resolverMensagemBoasVindas

- [ ] **Step 3: Adicionar a função auxiliar**

Localizar a função `dentroDoHorario` (ou qualquer função auxiliar existente antes de `handleNOVO`) e adicionar logo antes de `handleNOVO`:

```typescript
const TIER_ORDEM: Record<string, number> = { OURO: 3, PRATA: 2, BRONZE: 1 }

function resolverMensagemBoasVindas(
  config: ChatbotConfig,
  empresas: Array<{ classificacao?: string | null }>,
  nome: string,
  tierOverride?: string | null,
): string {
  const tier = tierOverride !== undefined
    ? tierOverride
    : empresas.reduce<string | null>((melhor, e) => {
        if (!e.classificacao) return melhor
        if (!melhor) return e.classificacao
        return (TIER_ORDEM[e.classificacao] ?? 0) > (TIER_ORDEM[melhor] ?? 0)
          ? e.classificacao
          : melhor
      }, null)

  const msgBase =
    tier === 'OURO'   && config.msg_boas_vindas_ouro   ? config.msg_boas_vindas_ouro   :
    tier === 'PRATA'  && config.msg_boas_vindas_prata  ? config.msg_boas_vindas_prata  :
    tier === 'BRONZE' && config.msg_boas_vindas_bronze ? config.msg_boas_vindas_bronze :
    config.msg_boas_vindas

  const tierLabel = tier
    ? tier.charAt(0) + tier.slice(1).toLowerCase()
    : ''

  return msgBase
    .replace(/\{nome\}/g, nome)
    .replace(/\{tier\}/g, tierLabel)
}
```

### 7d — handleNOVO: usar classificacao na query e na saudação

- [ ] **Step 4: Atualizar a query de empresas em `handleNOVO` para incluir `classificacao`**

Localizar:
```typescript
  const { data: empData } = await supabase
    .from('contatos_empresas')
    .select('id, empresa, cnpj')
    .eq('contato_id', conversa.contato_id)
    .order('criado_em', { ascending: true })

  const empresas = (empData ?? []) as Array<{ id: string; empresa: string; cnpj: string | null }>
```
Substituir por:
```typescript
  const { data: empData } = await supabase
    .from('contatos_empresas')
    .select('id, empresa, cnpj, classificacao')
    .eq('contato_id', conversa.contato_id)
    .order('criado_em', { ascending: true })

  const empresas = (empData ?? []) as Array<{ id: string; empresa: string; cnpj: string | null; classificacao: string | null }>
```

- [ ] **Step 5: Substituir a saudação hardcoded pela função `resolverMensagemBoasVindas`**

Localizar (dentro de `handleNOVO`, no bloco `if (empresas.length > 0)`):
```typescript
    const saudacao = `Olá, ${nomeContato}! 👋 Sobre qual empresa você gostaria de falar?`
```
Substituir por:
```typescript
    const msgTier = resolverMensagemBoasVindas(config, empresas, nomeContato)
    const saudacao = msgTier || `Olá, ${nomeContato}! 👋 Sobre qual empresa você gostaria de falar?`
```

- [ ] **Step 6: Atualizar saudação no fluxo recorrente (sem empresas)**

Localizar (dentro de `handleNOVO`, no bloco `if (recorrente?.bot_departamento)`):
```typescript
      config.msg_boas_vindas,
```
Substituir por:
```typescript
      resolverMensagemBoasVindas(config, [], nomeContato),
```

Localizar (ainda dentro de `handleNOVO`, no branch final após o recorrente):
```typescript
    await enviarTexto(telefone, config.msg_boas_vindas, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, config.msg_boas_vindas)
```
Substituir por:
```typescript
    const msgBV = resolverMensagemBoasVindas(config, [], nomeContato)
    await enviarTexto(telefone, msgBV, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, msgBV)
```

### 7e — handleAGUARD_EMPRESA: salvar classificacao

- [ ] **Step 7: Atualizar queries de empresa em `handleAGUARD_EMPRESA` para incluir `classificacao`**

Localizar (no bloco `EMPRESA_REC`):
```typescript
    const { data: ce } = await supabase
      .from('contatos_empresas')
      .select('empresa, cnpj')
      .eq('id', ceId)
      .single()

    const empresa = (ce?.empresa as string | undefined) || null
    const cnpj = (ce?.cnpj as string | null | undefined) ?? null
```
Substituir por:
```typescript
    const { data: ce } = await supabase
      .from('contatos_empresas')
      .select('empresa, cnpj, classificacao')
      .eq('id', ceId)
      .single()

    const empresa        = (ce?.empresa        as string | undefined) || null
    const cnpj           = (ce?.cnpj           as string | null | undefined) ?? null
    const classificacao  = (ce?.classificacao  as string | null | undefined) ?? null
```

Localizar (ainda no bloco `EMPRESA_REC`):
```typescript
    await atualizarSessao(supabase, sessao.id, {
      empresa_selecionada: empresa,
      cnpj_selecionado: cnpj,
      dept_selecionado: deptAnterior,
      categoria_id: catId,
      tentativas_invalidas: 0,
    })

    if (empresa) {
      await supabase
        .from('conversas')
        .update({ bot_empresa: empresa, bot_cnpj: cnpj })
        .eq('id', conversa.id)
    }
```
Substituir por:
```typescript
    await atualizarSessao(supabase, sessao.id, {
      empresa_selecionada:  empresa,
      cnpj_selecionado:     cnpj,
      classificacao_empresa: classificacao,
      dept_selecionado:     deptAnterior,
      categoria_id:         catId,
      tentativas_invalidas: 0,
    })

    if (empresa) {
      await supabase
        .from('conversas')
        .update({ bot_empresa: empresa, bot_cnpj: cnpj, classificacao_empresa: classificacao })
        .eq('id', conversa.id)
    }
```

- [ ] **Step 8: Repetir a mesma atualização no bloco `EMPRESA:` de `handleAGUARD_EMPRESA`**

Localizar o segundo bloco (após `// EMPRESA:{ce_id} — empresa selecionada, novo assunto`):
```typescript
    const { data: ce } = await supabase
      .from('contatos_empresas')
      .select('empresa, cnpj')
      .eq('id', ceId)
      .single()
```
Substituir por:
```typescript
    const { data: ce } = await supabase
      .from('contatos_empresas')
      .select('empresa, cnpj, classificacao')
      .eq('id', ceId)
      .single()
```

Depois, na atualização da sessão e da conversa nesse bloco, adicionar `classificacao_empresa` da mesma forma que no Step 7 acima (buscar o padrão `bot_empresa: empresa, bot_cnpj: cnpj` e adicionar `classificacao_empresa: classificacao`; e no `atualizarSessao` adicionar `classificacao_empresa: classificacao`). Adicionar `const classificacao = (ce?.classificacao as string | null | undefined) ?? null` logo após as constantes `empresa` e `cnpj`.

- [ ] **Step 9: Deploy da Edge Function**

```bash
cd "Projeto CRM"
npx supabase functions deploy whatsapp-webhook --project-ref <seu-project-ref>
```

Ou pelo Supabase Dashboard → Edge Functions → `whatsapp-webhook` → Deploy.

- [ ] **Step 10: Commit**

```bash
git add "Projeto CRM/supabase/functions/whatsapp-webhook/chatbot-processor.ts"
git commit -m "feat: resolverMensagemBoasVindas por tier e persistência de classificacao_empresa no chatbot"
```

---

## Task 8: PainelDireito — badge tier + query atualizada

**Files:**
- Modify: `src/components/PainelDireito/PainelDireito.jsx`
- Modify: `src/hooks/useConversas.js`

### 8a — useConversas.js

- [ ] **Step 1: Adicionar `classificacao_empresa` ao SELECT de conversas**

Localizar em `src/hooks/useConversas.js`:
```javascript
        bot_departamento, bot_categoria, bot_subcategoria, bot_empresa, bot_cnpj,
```
Substituir por:
```javascript
        bot_departamento, bot_categoria, bot_subcategoria, bot_empresa, bot_cnpj, classificacao_empresa,
```

### 8b — PainelDireito.jsx

- [ ] **Step 2: Atualizar a query de `contatos_empresas` para incluir `classificacao`**

Localizar:
```javascript
    supabase
      .from('contatos_empresas')
      .select('empresa, cargo')
      .eq('contato_id', conversa.contatos.id)
      .order('criado_em', { ascending: true })
      .then(({ data }) => setEmpresasContato(data ?? []))
```
Substituir por:
```javascript
    supabase
      .from('contatos_empresas')
      .select('empresa, cargo, classificacao')
      .eq('contato_id', conversa.contatos.id)
      .order('criado_em', { ascending: true })
      .then(({ data }) => setEmpresasContato(data ?? []))
```

- [ ] **Step 3: Adicionar constantes de tier no topo do arquivo (após `DEPTO_COLORS`)**

```javascript
const TIER_BG    = { OURO: '#fff8dc', PRATA: '#f0f0f0', BRONZE: '#fdf0e8' }
const TIER_COLOR = { OURO: '#b8860b', PRATA: '#708090', BRONZE: '#8b4513' }
const TIER_EMOJI = { OURO: '🥇',      PRATA: '🥈',      BRONZE: '🥉'      }
```

- [ ] **Step 4: Adicionar badge de tier logo após o badge de empresa no bloco "Contexto do bot"**

Localizar:
```jsx
          {/* Empresa selecionada pelo bot */}
          {conversa.bot_empresa && (
            <div style={{ marginBottom: 10 }}>
              <span style={{
                background: '#1e3a5f', color: '#fff',
                fontSize: 10, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                🏢 {conversa.bot_empresa}
              </span>
              {conversa.bot_cnpj && (
                <div style={{
                  fontSize: 9, color: '#7a9fc0',
                  fontFamily: 'DM Mono, monospace', marginTop: 3,
                }}>
                  CNPJ {conversa.bot_cnpj}
                </div>
              )}
            </div>
          )}
```
Substituir por:
```jsx
          {/* Empresa selecionada pelo bot */}
          {conversa.bot_empresa && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                <span style={{
                  background: '#1e3a5f', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  padding: '3px 8px', borderRadius: 4,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  🏢 {conversa.bot_empresa}
                </span>
                {conversa.classificacao_empresa && (
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 3,
                    background: TIER_BG[conversa.classificacao_empresa],
                    color: TIER_COLOR[conversa.classificacao_empresa],
                  }}>
                    {TIER_EMOJI[conversa.classificacao_empresa]}{' '}
                    {conversa.classificacao_empresa.charAt(0) + conversa.classificacao_empresa.slice(1).toLowerCase()}
                  </span>
                )}
              </div>
              {conversa.bot_cnpj && (
                <div style={{
                  fontSize: 9, color: '#7a9fc0',
                  fontFamily: 'DM Mono, monospace', marginTop: 3,
                }}>
                  CNPJ {conversa.bot_cnpj}
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 5: Verificar visualmente**

Abrir uma conversa de um contato que tem empresa com tier. O painel direito deve mostrar o badge colorido ao lado do nome da empresa no bloco "Contexto do bot".

- [ ] **Step 6: Commit**

```bash
git add "Projeto CRM/src/hooks/useConversas.js" "Projeto CRM/src/components/PainelDireito/PainelDireito.jsx"
git commit -m "feat: badge de tier no PainelDireito e classificacao_empresa no SELECT de conversas"
```

---

## Task 9: ModalImportarPlanilha — coluna classificacao

**Files:**
- Modify: `src/components/ContatosImport/ModalImportarPlanilha.jsx`

- [ ] **Step 1: Adicionar `classificacao` ao modelo .xlsx**

Localizar:
```javascript
  const ws = XLSX.utils.aoa_to_sheet([
    ['nome', 'telefone', 'cpf_cnpj', 'empresa', 'cnpj_empresa', 'cargo', 'email', 'observacoes'],
    ['João Silva (exemplo)', '5561999991111', '000.000.000-00', 'ACME Ltda', '00.000.000/0001-00', 'Sócio', 'joao@acme.com', ''],
    ['João Silva (exemplo)', '5561999991111', '', 'Outra Empresa Ltda', '11.111.111/0001-11', 'Diretor', '', ''],
  ])
```
Substituir por:
```javascript
  const ws = XLSX.utils.aoa_to_sheet([
    ['nome', 'telefone', 'cpf_cnpj', 'empresa', 'cnpj_empresa', 'classificacao', 'cargo', 'email', 'observacoes'],
    ['João Silva (exemplo)', '5561999991111', '000.000.000-00', 'ACME Ltda', '00.000.000/0001-00', 'ouro', 'Sócio', 'joao@acme.com', ''],
    ['João Silva (exemplo)', '5561999991111', '', 'Outra Empresa Ltda', '11.111.111/0001-11', 'bronze', 'Diretor', '', ''],
  ])
```

- [ ] **Step 2: Adicionar `classificacao` em `normalizarLinhas`**

Localizar:
```javascript
      empresa:      String(row.empresa      ?? '').trim() || null,
      cnpj_empresa: String(row.cnpj_empresa ?? '').trim() || null,
      cargo:        String(row.cargo        ?? '').trim() || null,
```
Substituir por:
```javascript
      empresa:        String(row.empresa        ?? '').trim() || null,
      cnpj_empresa:   String(row.cnpj_empresa   ?? '').trim() || null,
      classificacao:  (() => {
        const v = String(row.classificacao ?? '').trim().toUpperCase()
        return ['BRONZE', 'PRATA', 'OURO'].includes(v) ? v : null
      })(),
      cargo:          String(row.cargo          ?? '').trim() || null,
```

- [ ] **Step 3: Adicionar `classificacao` nos inserts de `confirmarImportacao`**

Localizar (no bloco `novo_contato`):
```javascript
          .insert({ contato_id: novoContato.id, empresa: l.empresa, cargo: l.cargo || null, cnpj: l.cnpj_empresa || null })
```
Substituir por:
```javascript
          .insert({ contato_id: novoContato.id, empresa: l.empresa, cargo: l.cargo || null, cnpj: l.cnpj_empresa || null, classificacao: l.classificacao || null })
```

Localizar (no bloco `nova_empresa`):
```javascript
          .insert({ contato_id: l.contatoId, empresa: l.empresa, cargo: l.cargo || null, cnpj: l.cnpj_empresa || null })
```
Substituir por:
```javascript
          .insert({ contato_id: l.contatoId, empresa: l.empresa, cargo: l.cargo || null, cnpj: l.cnpj_empresa || null, classificacao: l.classificacao || null })
```

Localizar (no bloco `conflito/atualizar`):
```javascript
        .update({ cargo: l.cargo || null, cnpj: l.cnpj_empresa || null })
```
Substituir por:
```javascript
        .update({ cargo: l.cargo || null, cnpj: l.cnpj_empresa || null, classificacao: l.classificacao || null })
```

- [ ] **Step 4: Adicionar coluna "Tier" na tabela da prévia (`StepPrevia`)**

Localizar:
```javascript
            {['Nome', 'Telefone', 'Empresa', 'CNPJ Empresa', 'Cargo', 'Status'].map(col => (
```
Substituir por:
```javascript
            {['Nome', 'Telefone', 'Empresa', 'CNPJ Empresa', 'Tier', 'Cargo', 'Status'].map(col => (
```

Localizar:
```jsx
              <td style={{ padding: '7px 10px', color: '#888480', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{l.cnpj_empresa || '—'}</td>
              <td style={{ padding: '7px 10px', color: '#888480' }}>{l.cargo || '—'}</td>
```
Substituir por:
```jsx
              <td style={{ padding: '7px 10px', color: '#888480', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{l.cnpj_empresa || '—'}</td>
              <td style={{ padding: '7px 10px', color: '#888480', fontSize: 11 }}>{l.classificacao || '—'}</td>
              <td style={{ padding: '7px 10px', color: '#888480' }}>{l.cargo || '—'}</td>
```

- [ ] **Step 5: Commit**

```bash
git add "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.jsx"
git commit -m "feat: coluna classificacao na importação de planilha"
```

---

## Task 10: Build final e push

**Files:**
- Modify: `crm/index.html` (gerado pelo build)
- Create: `crm/assets/index-<hash>.js` (gerado pelo build)

- [ ] **Step 1: Build**

```bash
cd "Projeto CRM"
npm run build
```
Deve terminar sem erros. Anote o hash do novo arquivo `crm/assets/index-<hash>.js`.

- [ ] **Step 2: Staging do build**

```bash
cd ..
git add crm/
```

- [ ] **Step 3: Remover build antigo se necessário**

Verificar `git status --short`. Se aparecer algum `D crm/assets/index-*.js`, garantir que está staged com `git rm crm/assets/index-<hash-antigo>.js`.

- [ ] **Step 4: Commit do build**

```bash
git commit -m "chore: build CRM — classificação tier completa"
```

- [ ] **Step 5: Push**

```bash
git push origin main
```

Aguardar ~5 minutos e verificar o GitHub Pages em `https://scontsolucoescontabeis.github.io/scont/crm/`.
