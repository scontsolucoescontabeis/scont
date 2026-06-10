# Benefícios VA/VT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a ferramenta `Projeto Beneficios/` para geração de TXT de lançamentos de Vale Transporte e Vale Alimentação no mesmo formato do Controle de Frequência.

**Architecture:** Arquivo único (`index.html` + `script.js` + `styles.css`) com sidebar navegável entre 3 telas (Lançamentos, Escalas, Configurações). Dados persistidos em 3 novas tabelas Supabase (`rh_beneficios_config`, `rh_beneficios_individuais`, `rh_beneficios_lancamentos`). Auth via `portal-auth-guard.js`.

**Tech Stack:** Vanilla JS ES2020, Supabase JS v2 (CDN), SheetJS/xlsx (CDN), paleta bordô do portal.

---

## File Map

```
Projeto Beneficios/
├── index.html              ← HTML skeleton + sidebar + 3 sections + modais
├── script.js               ← Toda a lógica (state, auth, Configurações, Escalas, Lançamentos, Excel, TXT)
├── styles.css              ← Paleta portal, sidebar, tabelas, formulários

C:\...\Projeto Portal Scont\
├── _sql\
│   └── add_beneficios_va_vt.sql   ← INSERT na tabela ferramentas
└── Projeto Beneficios\
    └── schema_beneficios.sql      ← CREATE TABLE das 3 novas tabelas + RLS
```

---

## Task 1: SQL Schema

**Files:**
- Create: `Projeto Beneficios/schema_beneficios.sql`
- Create: `_sql/add_beneficios_va_vt.sql`

- [ ] **Criar `Projeto Beneficios/schema_beneficios.sql`:**

```sql
-- ============================================================
-- Benefícios VA/VT — Schema Supabase
-- Execute no SQL Editor do Supabase (projeto Portal SCONT)
-- Idempotente: pode ser re-executado sem erros
-- ============================================================

-- Tabela 1: Configuração de rubricas e valor padrão por empresa
CREATE TABLE IF NOT EXISTS public.rh_beneficios_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    tipo            TEXT NOT NULL CHECK (tipo IN ('vt', 'va')),
    codigo_rubrica  TEXT NOT NULL DEFAULT '',
    tipo_processo   TEXT NOT NULL DEFAULT '11',
    valor_dia       NUMERIC(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT rh_ben_config_empresa_tipo_unique UNIQUE (codigo_empresa, tipo)
);
CREATE INDEX IF NOT EXISTS idx_rh_ben_config_empresa ON public.rh_beneficios_config (codigo_empresa);

-- Tabela 2: Valores individuais por empregado (override do padrão)
CREATE TABLE IF NOT EXISTS public.rh_beneficios_individuais (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    codigo_empregado  TEXT NOT NULL,
    vt_valor_dia      NUMERIC(10,2),   -- NULL = usa padrão da empresa
    va_valor_dia      NUMERIC(10,2),   -- NULL = usa padrão da empresa
    CONSTRAINT rh_ben_ind_empresa_emp_unique UNIQUE (codigo_empresa, codigo_empregado)
);
CREATE INDEX IF NOT EXISTS idx_rh_ben_ind_empresa ON public.rh_beneficios_individuais (codigo_empresa);

-- Tabela 3: Lançamentos salvos por empresa/competência
CREATE TABLE IF NOT EXISTS public.rh_beneficios_lancamentos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa        TEXT NOT NULL,
    competencia_pagamento TEXT NOT NULL,   -- MM/AAAA (entra no TXT)
    mes_referencia        TEXT,            -- MM/AAAA (mês futuro de trabalho)
    tipo_processo         TEXT NOT NULL DEFAULT '11',
    linhas_json           JSONB NOT NULL DEFAULT '[]',
    usuario_id            UUID,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rh_ben_lanc_empresa_comp_unique UNIQUE (codigo_empresa, competencia_pagamento)
);
CREATE INDEX IF NOT EXISTS idx_rh_ben_lanc_empresa ON public.rh_beneficios_lancamentos (codigo_empresa);

-- ============================================================
-- RLS — mesmo padrão das outras tabelas rh_*
-- ============================================================

ALTER TABLE public.rh_beneficios_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_beneficios_individuais  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_beneficios_lancamentos  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_ben_config: autenticado"      ON public.rh_beneficios_config;
DROP POLICY IF EXISTS "rh_ben_ind: autenticado"         ON public.rh_beneficios_individuais;
DROP POLICY IF EXISTS "rh_ben_lanc: autenticado"        ON public.rh_beneficios_lancamentos;

CREATE POLICY "rh_ben_config: autenticado"
    ON public.rh_beneficios_config FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "rh_ben_ind: autenticado"
    ON public.rh_beneficios_individuais FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "rh_ben_lanc: autenticado"
    ON public.rh_beneficios_lancamentos FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);
```

- [ ] **Criar `_sql/add_beneficios_va_vt.sql`:**

```sql
-- Registra Benefícios VA/VT na tabela ferramentas do Portal
-- Idempotente
ALTER TABLE public.ferramentas ADD COLUMN IF NOT EXISTS nova_aba BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem, nova_aba)
SELECT
  'Benefícios VA/VT',
  'Lançamento de Vale Transporte e Vale Alimentação — gera TXT para a folha',
  '🎫',
  './Projeto Beneficios/index.html',
  true,
  160,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.ferramentas WHERE nome = 'Benefícios VA/VT');
```

- [ ] **Executar `schema_beneficios.sql`** no SQL Editor do Supabase (projeto Portal). Verificar: 3 tabelas novas aparecem em Table Editor.
- [ ] **Executar `add_beneficios_va_vt.sql`** no SQL Editor. Verificar: admin-dashboard → aba Ferramentas mostra "Benefícios VA/VT".
- [ ] **Commit:**
```bash
git add "Projeto Beneficios/schema_beneficios.sql" "_sql/add_beneficios_va_vt.sql"
git commit -m "feat: schema e registro portal — Benefícios VA/VT"
```

---

## Task 2: index.html

**Files:**
- Create: `Projeto Beneficios/index.html`

- [ ] **Criar `Projeto Beneficios/index.html`:**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benefícios VA/VT — Portal Scont</title>
  <link rel="stylesheet" href="styles.css">
  <script src="../supabase-config.js"></script>
  <script src="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script src="https://unpkg.com/xlsx/dist/xlsx.full.min.js"></script>
  <script src="../portal-auth-guard.js"></script>
</head>
<body>

<!-- Auth overlay -->
<div id="authOverlay">
  <div class="auth-spinner"></div>
  <p class="auth-msg">Verificando acesso…</p>
</div>

<!-- App (oculto até auth confirmada) -->
<div id="app" class="app-layout" style="display:none">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon">🎫</div>
      <div class="brand-text">
        <h2>Benefícios</h2>
        <p>VA / VT · Portal Scont</p>
      </div>
    </div>
    <nav class="sidebar-nav">
      <button class="nav-btn active" data-screen="lancamentos">📋 Lançamentos</button>
      <button class="nav-btn"        data-screen="escalas">📅 Escalas</button>
      <button class="nav-btn"        data-screen="config">⚙️ Configurações</button>
    </nav>
    <div class="sidebar-footer" id="sidebarUser"></div>
  </aside>

  <!-- MAIN -->
  <main class="main-content">

    <!-- ── LANÇAMENTOS ── -->
    <section id="screen-lancamentos" class="screen">
      <div class="screen-header">
        <h1>📋 Lançamentos VA / VT</h1>
        <p>Gere os lançamentos de benefícios para a folha</p>
      </div>

      <!-- Banner de competências -->
      <div class="period-banner" id="periodBanner">
        <div class="period-box period-red">
          <span class="period-label">Competência de Pagamento</span>
          <span class="period-value" id="bannerCompPgto">—</span>
        </div>
        <div class="period-arrow">← paga benefícios referentes a →<br><small>mês que o empregado vai trabalhar</small></div>
        <div class="period-box period-blue">
          <span class="period-label">Mês de Referência dos Dias</span>
          <span class="period-value" id="bannerMesRef">—</span>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">🏢 Seleção</h3>
        <div class="form-grid-4">
          <div class="fg">
            <label for="lancEmpresa">Empresa</label>
            <select id="lancEmpresa"><option value="">Selecione…</option></select>
          </div>
          <div class="fg">
            <label for="lancCompPgto">Competência de Pagamento ①</label>
            <input id="lancCompPgto" type="text" placeholder="MM/AAAA" maxlength="7">
          </div>
          <div class="fg">
            <label for="lancMesRef">Mês de Referência dos Dias ②</label>
            <input id="lancMesRef" type="text" placeholder="MM/AAAA" maxlength="7" class="input-blue">
          </div>
          <div class="fg">
            <label for="lancTipoProc">Tipo de Processo</label>
            <select id="lancTipoProc">
              <option value="11">11 — Folha Mensal</option>
              <option value="41">41 — Adiantamento Salarial</option>
              <option value="42">42 — Folha Complementar</option>
              <option value="51">51 — Adiantamento 13º</option>
              <option value="52">52 — 13º Salário</option>
              <option value="70">70 — PLR</option>
            </select>
          </div>
        </div>
        <div class="fg">
          <label for="lancEmpregados">Empregados</label>
          <select id="lancEmpregados">
            <option value="todos">Todos os empregados</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">💰 Valores Padrão</h3>
        <div class="form-grid-5">
          <div class="fg">
            <label for="lancVtDia">VT Padrão / Dia (R$)</label>
            <input id="lancVtDia" type="number" step="0.01" min="0" placeholder="0,00" class="input-red">
          </div>
          <div class="fg">
            <label for="lancVaDia">VA Padrão / Dia (R$)</label>
            <input id="lancVaDia" type="number" step="0.01" min="0" placeholder="0,00" class="input-red">
          </div>
          <div class="fg">
            <label for="lancDias">Dias a Trabalhar ②</label>
            <input id="lancDias" type="number" min="0" max="31" placeholder="0" class="input-blue">
          </div>
          <div class="fg">
            <label>Total VT Padrão <span class="formula-chip">= VT × Dias</span></label>
            <input id="lancTotalVt" type="text" readonly class="input-calc">
          </div>
          <div class="fg">
            <label>Total VA Padrão <span class="formula-chip">= VA × Dias</span></label>
            <input id="lancTotalVa" type="text" readonly class="input-calc">
          </div>
        </div>
        <div class="btn-row">
          <span class="hint-text">② Preenchido automaticamente pela tela Escalas</span>
          <button id="btnAplicarPadrao" class="btn btn-secondary">🔄 Aplicar Padrão a Todos</button>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">👥 Grade de Empregados</h3>
        <div class="btn-row" style="margin-bottom:12px">
          <button id="btnImportarExcel" class="btn btn-secondary">📥 Importar Excel</button>
          <input id="inputExcel" type="file" accept=".xlsx,.xls" style="display:none">
          <div style="margin-left:auto;display:flex;gap:8px">
            <button id="btnSalvar" class="btn btn-secondary">💾 Salvar</button>
            <button id="btnGerarTxt" class="btn btn-success">📄 Gerar TXT</button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="gradeTable">
            <thead>
              <tr>
                <th>Cód.</th><th>Nome</th>
                <th>VT/Dia</th><th>VA/Dia</th><th>Dias</th>
                <th>Total VT <span class="formula-chip">auto</span></th>
                <th>Total VA <span class="formula-chip">auto</span></th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody id="gradeTbody"></tbody>
          </table>
        </div>
        <p class="hint-text" style="margin-top:8px">
          <span class="badge badge-ok">Padrão</span> valor da empresa &nbsp;
          <span class="badge badge-ind">Individual</span> valor pré-configurado &nbsp;
          <span class="badge badge-warn">Divergente</span> difere do configurado → confirmação exigida
        </p>
      </div>
    </section>

    <!-- ── ESCALAS ── -->
    <section id="screen-escalas" class="screen hidden">
      <div class="screen-header">
        <h1>📅 Escalas — Dias Úteis</h1>
        <p>Calcule os dias do <strong>mês de referência</strong> e envie para Lançamentos</p>
      </div>

      <div class="card">
        <h3 class="card-title">📌 Parâmetros</h3>
        <div class="form-grid-3">
          <div class="fg">
            <label for="escEmpresa">Empresa</label>
            <select id="escEmpresa"><option value="">Selecione…</option></select>
          </div>
          <div class="fg">
            <label for="escMesRef">Mês de Referência (mês de trabalho)</label>
            <input id="escMesRef" type="text" placeholder="MM/AAAA" maxlength="7" class="input-blue">
          </div>
          <div class="fg">
            <label for="escConsiderarFeriados">Considerar Feriados desta empresa?</label>
            <select id="escConsiderarFeriados">
              <option value="sim">✅ Sim — descontar feriados cadastrados</option>
              <option value="nao">❌ Não — ignorar feriados</option>
            </select>
          </div>
        </div>
        <div class="info-box">
          📌 <strong>Mês de referência ≠ competência de pagamento.</strong>
          Folha de <strong>maio/2026</strong> → benefícios de <strong>junho/2026</strong>.
        </div>
      </div>

      <!-- Tabela de feriados (visível quando sim) -->
      <div class="card" id="feriadosCard" style="display:none">
        <h3 class="card-title">🗓️ Feriados do Mês <span class="card-subtitle">(mesmos do Controle de Frequência)</span></h3>
        <div class="info-box" style="margin-bottom:10px">
          Feriados carregados do histórico da empresa. Marque os que devem ser descontados do total.
        </div>
        <table class="data-table" id="feriadosTable">
          <thead><tr><th style="width:36px"></th><th>Data</th><th>Descrição</th></tr></thead>
          <tbody id="feriadosTbody"></tbody>
        </table>
        <div class="btn-row" style="margin-top:10px">
          <button id="btnAddFeriado" class="btn btn-secondary btn-sm">+ Adicionar feriado</button>
        </div>
        <div id="addFeriadoForm" style="display:none;margin-top:10px" class="form-grid-3">
          <div class="fg"><label>Data (DD/MM)</label><input id="novaDataFeriado" type="text" placeholder="13/06" maxlength="5"></div>
          <div class="fg"><label>Descrição</label><input id="novaDescFeriado" type="text" placeholder="Corpus Christi"></div>
          <div class="fg" style="display:flex;align-items:flex-end">
            <button id="btnConfirmarFeriado" class="btn btn-primary btn-sm">Confirmar</button>
          </div>
        </div>
      </div>

      <!-- Abas de modo -->
      <div class="tab-bar" id="escalaTabBar">
        <button class="tab-btn active" data-modo="semana">📆 Dias da Semana</button>
        <button class="tab-btn" data-modo="revezamento">🔄 Revezamento</button>
        <button class="tab-btn" data-modo="manual">🖱️ Manual</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 200px;gap:16px;align-items:start">
        <div>
          <!-- Modo: Dias da semana -->
          <div id="modoSemana" class="card">
            <h3 class="card-title">📆 Dias trabalhados na semana</h3>
            <div class="day-toggles" id="dayToggles">
              <button class="day-btn" data-dia="0">Dom</button>
              <button class="day-btn active" data-dia="1">Seg</button>
              <button class="day-btn active" data-dia="2">Ter</button>
              <button class="day-btn active" data-dia="3">Qua</button>
              <button class="day-btn active" data-dia="4">Qui</button>
              <button class="day-btn active" data-dia="5">Sex</button>
              <button class="day-btn" data-dia="6">Sáb</button>
            </div>
            <p id="escalaLabel" class="escala-label">Escala 5×2 — Seg a Sex</p>
          </div>

          <!-- Modo: Revezamento -->
          <div id="modoRevezamento" class="card hidden">
            <h3 class="card-title">🔄 Escala de Revezamento</h3>
            <div class="form-grid-3">
              <div class="fg"><label>Dias trabalhados</label><input id="revTrab" type="number" min="1" value="5"></div>
              <div class="fg"><label>Dias de folga</label><input id="revFolga" type="number" min="1" value="2"></div>
              <div class="fg"><label>Início da escala (DD/MM/AAAA)</label><input id="revInicio" type="text" placeholder="01/06/2026" maxlength="10"></div>
            </div>
          </div>

          <!-- Modo: Manual -->
          <div id="modoManual" class="card hidden">
            <h3 class="card-title">🖱️ Selecione os dias manualmente</h3>
            <p class="hint-text" style="margin-bottom:10px">Clique nos dias para marcar como trabalhado</p>
          </div>

          <!-- Calendário (compartilhado entre modos) -->
          <div class="card" id="calendarioCard">
            <h3 class="card-title" id="calTitulo">🗓️ —</h3>
            <div class="calendar" id="calendarGrid"></div>
            <p class="hint-text" style="margin-top:8px">🟢 Trabalhado &nbsp; ⬜ Fim de semana &nbsp; 🔴 Feriado descontado</p>
          </div>
        </div>

        <!-- Resultado -->
        <div>
          <div class="result-box" id="resultBox">
            <div class="result-mes" id="resultMes">—</div>
            <div class="result-num" id="resultNum">—</div>
            <div class="result-label">dias úteis</div>
            <div class="result-detalhe" id="resultDetalhe"></div>
          </div>
          <button id="btnAplicarEscala" class="btn btn-info btn-full" style="margin-top:12px">
            ➜ Aplicar nos Lançamentos
          </button>
          <div class="info-box" style="margin-top:10px;font-size:11px">
            Após aplicar, clique em <strong>"Aplicar Padrão a Todos"</strong> na tela Lançamentos.
          </div>
        </div>
      </div>
    </section>

    <!-- ── CONFIGURAÇÕES ── -->
    <section id="screen-config" class="screen hidden">
      <div class="screen-header">
        <h1>⚙️ Configurações</h1>
        <p>Rubricas, valores padrão e valores individuais por empregado</p>
      </div>

      <div class="card">
        <h3 class="card-title">🏢 Empresa</h3>
        <div class="fg" style="max-width:300px">
          <label for="cfgEmpresa">Selecionar empresa</label>
          <select id="cfgEmpresa"><option value="">Selecione…</option></select>
        </div>
      </div>

      <div class="tab-bar" id="cfgTabBar">
        <button class="tab-btn active" data-tab="padrao">🏢 Padrão da Empresa</button>
        <button class="tab-btn"        data-tab="individual">👤 Valores Individuais</button>
      </div>

      <!-- Tab: Padrão -->
      <div id="cfgTabPadrao">
        <div class="two-col-grid">
          <div class="card">
            <h3 class="card-title">🚌 Vale Transporte</h3>
            <div class="fg"><label for="cfgVtRubrica">Código da Rubrica</label><input id="cfgVtRubrica" type="text" placeholder="0285"></div>
            <div class="fg"><label for="cfgVtTipoProc">Tipo de Processo Padrão</label>
              <select id="cfgVtTipoProc">
                <option value="11">11 — Folha Mensal</option>
                <option value="41">41 — Adiant. Salarial</option>
                <option value="42">42 — Folha Complementar</option>
                <option value="51">51 — Adiant. 13º</option>
                <option value="52">52 — 13º Salário</option>
                <option value="70">70 — PLR</option>
              </select>
            </div>
            <div class="fg"><label for="cfgVtValorDia">Valor Padrão / Dia (R$)</label><input id="cfgVtValorDia" type="number" step="0.01" min="0" placeholder="0,00" class="input-red"></div>
          </div>
          <div class="card">
            <h3 class="card-title">🍽️ Vale Alimentação</h3>
            <div class="fg"><label for="cfgVaRubrica">Código da Rubrica</label><input id="cfgVaRubrica" type="text" placeholder="0286"></div>
            <div class="fg"><label for="cfgVaTipoProc">Tipo de Processo Padrão</label>
              <select id="cfgVaTipoProc">
                <option value="11">11 — Folha Mensal</option>
                <option value="41">41 — Adiant. Salarial</option>
                <option value="42">42 — Folha Complementar</option>
                <option value="51">51 — Adiant. 13º</option>
                <option value="52">52 — 13º Salário</option>
                <option value="70">70 — PLR</option>
              </select>
            </div>
            <div class="fg"><label for="cfgVaValorDia">Valor Padrão / Dia (R$)</label><input id="cfgVaValorDia" type="number" step="0.01" min="0" placeholder="0,00" class="input-red"></div>
          </div>
        </div>
        <div class="btn-row" style="justify-content:flex-end">
          <button id="btnSalvarConfig" class="btn btn-primary">💾 Salvar Padrões</button>
        </div>
      </div>

      <!-- Tab: Individual -->
      <div id="cfgTabIndividual" class="hidden">
        <div class="info-box">
          👤 Valores individuais substituem o padrão para o empregado específico. Mais comum para VT (custo de transporte varia por trajeto). Campo vazio = usa padrão da empresa.
        </div>
        <div class="card">
          <h3 class="card-title">👥 Valores por Empregado</h3>
          <div class="table-wrapper">
            <table class="data-table" id="indTable">
              <thead><tr><th>Código</th><th>Nome</th><th>VT / Dia Individual</th><th>VA / Dia Individual</th><th></th></tr></thead>
              <tbody id="indTbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

  </main>
</div><!-- /app -->

<!-- Modal: Divergência de valor -->
<div id="modalDivergencia" class="modal hidden">
  <div class="modal-box">
    <h3 class="modal-title">⚠️ Divergência de Valor</h3>
    <p id="modalDivergenciaMsg" style="margin-bottom:16px;font-size:13px;line-height:1.6"></p>
    <div class="btn-row" style="justify-content:flex-end">
      <button id="btnDivCancelar" class="btn btn-secondary">Cancelar</button>
      <button id="btnDivConfirmar" class="btn btn-warning">Confirmar mesmo assim</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div id="toast" class="toast hidden"></div>

<script src="script.js"></script>
</body>
</html>
```

- [ ] **Verificar:** Abrir `index.html` no navegador — deve redirecionar para `../login.html` (auth guard funcionando).
- [ ] **Commit:**
```bash
git add "Projeto Beneficios/index.html"
git commit -m "feat: HTML skeleton — Benefícios VA/VT"
```

---

## Task 3: styles.css

**Files:**
- Create: `Projeto Beneficios/styles.css`

- [ ] **Criar `Projeto Beneficios/styles.css`:**

```css
/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, sans-serif; background: #F0F2F5; color: #2C3E50; font-size: 14px; }

/* ── Auth Overlay ── */
#authOverlay { position: fixed; inset: 0; background: #F0F2F5; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; gap: 12px; }
.auth-spinner { width: 36px; height: 36px; border: 3px solid #E0E6ED; border-top-color: #8B3A3A; border-radius: 50%; animation: spin .8s linear infinite; }
.auth-msg { font-size: 13px; color: #7F8C8D; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── App Layout ── */
.app-layout { display: flex; height: 100vh; overflow: hidden; }

/* ── Sidebar ── */
.sidebar { width: 220px; flex-shrink: 0; background: linear-gradient(160deg, #8B3A3A 0%, #2C3E50 100%); display: flex; flex-direction: column; color: #fff; }
.sidebar-brand { padding: 18px 16px 14px; border-bottom: 1px solid rgba(255,255,255,.12); display: flex; align-items: center; gap: 10px; }
.brand-icon { font-size: 26px; }
.brand-text h2 { font-size: 14px; font-weight: 700; }
.brand-text p { font-size: 10px; opacity: .65; margin-top: 2px; }
.sidebar-nav { padding: 12px 8px; flex: 1; display: flex; flex-direction: column; gap: 3px; }
.nav-btn { display: flex; align-items: center; gap: 9px; padding: 10px 12px; border-radius: 8px; background: none; border: none; color: #fff; font-size: 13px; cursor: pointer; text-align: left; transition: background .15s; }
.nav-btn:hover { background: rgba(255,255,255,.1); }
.nav-btn.active { background: rgba(255,255,255,.22); font-weight: 600; }
.sidebar-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,.12); font-size: 10px; opacity: .55; }

/* ── Main Content ── */
.main-content { flex: 1; overflow-y: auto; }
.screen { padding: 24px; max-width: 1100px; }
.hidden { display: none !important; }

/* ── Screen Header ── */
.screen-header { margin-bottom: 20px; }
.screen-header h1 { font-size: 20px; font-weight: 700; }
.screen-header p { font-size: 13px; color: #7F8C8D; margin-top: 4px; }

/* ── Card ── */
.card { background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.06); margin-bottom: 16px; }
.card-title { font-size: 12px; font-weight: 700; color: #8B3A3A; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
.card-subtitle { font-weight: 400; color: #7F8C8D; text-transform: none; font-size: 11px; }

/* ── Form ── */
.fg { display: flex; flex-direction: column; }
.fg label { font-size: 10px; font-weight: 700; color: #7F8C8D; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
.fg input, .fg select { padding: 8px 10px; border: 1.5px solid #E0E6ED; border-radius: 6px; font-size: 13px; font-family: inherit; color: #2C3E50; background: #fff; outline: none; transition: border-color .15s; }
.fg input:focus, .fg select:focus { border-color: #8B3A3A; }
.fg input.input-red { border-color: #8B3A3A; background: #FDF8F8; }
.fg input.input-blue { border-color: #2980B9; background: #EAF4FB; }
.fg input.input-calc { background: #F0FFF4; border-color: #27AE60; color: #1A6B3A; font-weight: 700; cursor: default; }
.form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.form-grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.form-grid-5 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* ── Period Banner ── */
.period-banner { display: flex; align-items: center; gap: 14px; background: #F8F9FA; border-radius: 9px; padding: 12px 16px; margin-bottom: 16px; }
.period-box { text-align: center; padding: 8px 16px; border-radius: 7px; }
.period-red { background: #FDF8F8; border: 1.5px solid #8B3A3A; }
.period-blue { background: #EAF4FB; border: 1.5px solid #2980B9; }
.period-label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #7F8C8D; }
.period-value { display: block; font-size: 15px; font-weight: 700; margin-top: 2px; }
.period-red .period-value { color: #8B3A3A; }
.period-blue .period-value { color: #2980B9; }
.period-arrow { flex: 1; text-align: center; font-size: 11px; color: #7F8C8D; line-height: 1.6; }

/* ── Buttons ── */
.btn { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: opacity .15s; }
.btn:hover { opacity: .88; }
.btn-primary   { background: #8B3A3A; color: #fff; }
.btn-secondary { background: #F5F5F5; color: #2C3E50; border: 1.5px solid #E0E6ED; }
.btn-success   { background: #27AE60; color: #fff; }
.btn-info      { background: #2980B9; color: #fff; }
.btn-warning   { background: #E67E22; color: #fff; }
.btn-sm { padding: 5px 10px; font-size: 11px; }
.btn-full { width: 100%; padding: 11px; font-size: 12px; }
.btn-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

/* ── Formula chip ── */
.formula-chip { display: inline-block; background: #F0FFF4; border: 1px solid #27AE60; border-radius: 3px; padding: 1px 5px; font-size: 9px; color: #1E8449; font-weight: 700; vertical-align: middle; margin-left: 4px; }

/* ── Tables ── */
.table-wrapper { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.data-table th { background: #F8F9FA; padding: 7px 8px; text-align: left; font-size: 10px; color: #7F8C8D; text-transform: uppercase; border-bottom: 2px solid #E0E6ED; white-space: nowrap; }
.data-table td { padding: 7px 8px; border-bottom: 1px solid #F0F2F5; }
.data-table tbody tr:hover td { background: #FDF8F8; }
.data-table input { padding: 4px 6px; border: 1px solid #E0E6ED; border-radius: 4px; font-size: 11px; width: 80px; }
.data-table input:focus { border-color: #8B3A3A; outline: none; }
.cell-calc { color: #1A6B3A; font-weight: 700; }

/* ── Badges ── */
.badge { display: inline-block; padding: 2px 7px; border-radius: 9px; font-size: 9px; font-weight: 700; }
.badge-ok   { background: #D5F5E3; color: #1E8449; }
.badge-ind  { background: #EAF4FB; color: #1A5276; }
.badge-warn { background: #FEF9E7; color: #B7950B; }

/* ── Info & Warn boxes ── */
.info-box { background: #EAF4FB; border: 1px solid #AED6F1; border-radius: 7px; padding: 10px 14px; font-size: 11px; color: #1A5276; line-height: 1.5; margin-bottom: 12px; }
.warn-box { background: #FEF9E7; border: 1px solid #F9CA56; border-radius: 7px; padding: 10px 14px; font-size: 11px; color: #7D6608; line-height: 1.5; margin-bottom: 12px; }
.hint-text { font-size: 10px; color: #7F8C8D; }

/* ── Tab bar ── */
.tab-bar { display: flex; gap: 4px; margin-bottom: 14px; }
.tab-btn { padding: 7px 14px; border-radius: 18px; border: none; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
.tab-btn.active { background: #8B3A3A; color: #fff; }
.tab-btn:not(.active) { background: #F0F2F5; color: #7F8C8D; }

/* ── Day toggles (Escalas) ── */
.day-toggles { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.day-btn { padding: 6px 12px; border-radius: 16px; border: 1.5px solid #E0E6ED; background: #F8F9FA; color: #BDC3C7; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
.day-btn.active { background: #D5F5E3; border-color: #27AE60; color: #1E8449; }
.escala-label { font-size: 11px; color: #27AE60; font-weight: 600; }

/* ── Calendar ── */
.calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; max-width: 320px; }
.cal-header { text-align: center; font-size: 9px; font-weight: 700; color: #7F8C8D; padding: 3px; }
.cal-day { text-align: center; padding: 5px 2px; border-radius: 4px; font-size: 11px; border: 1.5px solid #E0E6ED; background: #fff; cursor: default; user-select: none; }
.cal-day.work { background: #D5F5E3; border-color: #27AE60; color: #1E8449; font-weight: 700; }
.cal-day.weekend { background: #F8F9FA; color: #CCC; border-color: #F0F0F0; }
.cal-day.holiday { background: #FDECEA; border-color: #E74C3C; color: #C0392B; font-weight: 700; }
.cal-day.empty { border: none; background: transparent; }
.cal-day.manual-toggle { cursor: pointer; }
.cal-day.manual-toggle:hover { opacity: .8; }

/* ── Result box (Escalas) ── */
.result-box { background: linear-gradient(135deg, #8B3A3A, #2C3E50); color: #fff; border-radius: 10px; padding: 18px; text-align: center; }
.result-mes { font-size: 12px; opacity: .75; text-transform: uppercase; letter-spacing: .05em; }
.result-num { font-size: 42px; font-weight: 800; margin: 6px 0 2px; }
.result-label { font-size: 12px; opacity: .8; }
.result-detalhe { font-size: 10px; opacity: .6; margin-top: 3px; }

/* ── Modal ── */
.modal { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal-box { background: #fff; border-radius: 10px; padding: 24px; max-width: 460px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,.2); }
.modal-title { font-size: 16px; font-weight: 700; color: #2C3E50; margin-bottom: 14px; }

/* ── Toast ── */
.toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #fff; z-index: 2000; box-shadow: 0 4px 16px rgba(0,0,0,.2); animation: fadeIn .3s ease; }
.toast.success { background: #27AE60; }
.toast.error   { background: #E74C3C; }
.toast.info    { background: #2980B9; }
@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
```

- [ ] **Verificar:** Abrir `index.html` logado no portal — deve exibir o app com sidebar bordô.
- [ ] **Commit:**
```bash
git add "Projeto Beneficios/styles.css"
git commit -m "feat: styles — Benefícios VA/VT"
```

---

## Task 4: script.js — Foundation (State, Init, Auth, Navigation)

**Files:**
- Create: `Projeto Beneficios/script.js`

- [ ] **Criar `Projeto Beneficios/script.js`** com o seguinte conteúdo inicial:

```javascript
// ============================================================
// BENEFÍCIOS VA/VT — script.js
// ============================================================

// ── STATE ─────────────────────────────────────────────────
const S = {
  sb:           null,
  auth:         null,
  empresas:     [],
  empregados:   [],
  config:       null,       // { vt:{rubrica,tipoProc,valorDia}, va:{...} }
  individuais:  {},         // { cod_emp: {vt_dia, va_dia} }
  lancamento: {
    empresa: '', compPgto: '', mesRef: '',
    tipoProc: '11', linhas: []
    // linha: {cod_emp, nome, vt_dia, va_dia, dias, total_vt, total_va, status}
  },
  escalas: {
    modo:          'semana',
    diasSemana:    new Set([1,2,3,4,5]),   // 0=Dom..6=Sab
    revTrab:       5,
    revFolga:      2,
    revInicio:     '',
    diasManuais:   new Set(),              // Set de Date strings 'YYYY-MM-DD'
    feriados:      [],                     // [{data:'DD/MM', descricao:'...'}]
    feriadosMarcados: new Set(),           // Set de 'DD/MM'
    mesRef:        ''
  }
};

// ── HELPERS ───────────────────────────────────────────────
const pad  = (v, n) => String(v).padStart(n, '0');
const $ = id => document.getElementById(id);

function parseDecimal(s) {
  if (s === null || s === undefined || s === '') return 0;
  return parseFloat(String(s).replace(',', '.')) || 0;
}

function fmtMoeda(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "05/2026" → "202605" */
function compToAaaamm(comp) {
  const [mm, aaaa] = (comp || '').split('/');
  if (!mm || !aaaa) return '';
  return `${aaaa}${mm.padStart(2,'0')}`;
}

function showToast(msg, tipo = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${tipo}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(`screen-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === name);
  });
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  S.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

  const auth = await window.PortalAuthGuard.init(1);
  if (!auth) return;
  S.auth = auth;

  $('authOverlay').style.display = 'none';
  $('app').style.display = 'flex';
  $('sidebarUser').textContent = auth.email || '';

  // Navegação
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  await loadEmpresas();
  setupLancamentosListeners();
  setupEscalasListeners();
  setupConfigListeners();
});

// ── LOAD EMPRESAS / EMPREGADOS ────────────────────────────
async function loadEmpresas() {
  const { data, error } = await S.sb
    .from('rh_empresas')
    .select('codigo_empresa, nome_empresa')
    .order('codigo_empresa');
  if (error) { showToast('Erro ao carregar empresas', 'error'); return; }
  S.empresas = data || [];

  const opts = S.empresas.map(e =>
    `<option value="${e.codigo_empresa}">${e.codigo_empresa} — ${e.nome_empresa}</option>`
  ).join('');

  ['lancEmpresa', 'escEmpresa', 'cfgEmpresa'].forEach(id => {
    $(id).innerHTML = '<option value="">Selecione…</option>' + opts;
  });
}

async function loadEmpregados(empresa) {
  if (!empresa) { S.empregados = []; return; }
  const { data, error } = await S.sb
    .from('rh_empregados')
    .select('codigo_empregado, nome_empregado')
    .eq('codigo_empresa', empresa)
    .order('nome_empregado');
  if (error) { showToast('Erro ao carregar empregados', 'error'); return; }
  S.empregados = data || [];
}

async function loadConfig(empresa) {
  if (!empresa) { S.config = null; return; }
  const { data } = await S.sb
    .from('rh_beneficios_config')
    .select('tipo, codigo_rubrica, tipo_processo, valor_dia')
    .eq('codigo_empresa', empresa);
  const rows = data || [];
  const vt = rows.find(r => r.tipo === 'vt') || {};
  const va = rows.find(r => r.tipo === 'va') || {};
  S.config = {
    vt: { rubrica: vt.codigo_rubrica || '', tipoProc: vt.tipo_processo || '11', valorDia: parseFloat(vt.valor_dia) || 0 },
    va: { rubrica: va.codigo_rubrica || '', tipoProc: va.tipo_processo || '11', valorDia: parseFloat(va.valor_dia) || 0 }
  };
}

async function loadIndividuais(empresa) {
  if (!empresa) { S.individuais = {}; return; }
  const { data } = await S.sb
    .from('rh_beneficios_individuais')
    .select('codigo_empregado, vt_valor_dia, va_valor_dia')
    .eq('codigo_empresa', empresa);
  S.individuais = {};
  (data || []).forEach(r => {
    S.individuais[r.codigo_empregado] = {
      vt_dia: r.vt_valor_dia != null ? parseFloat(r.vt_valor_dia) : null,
      va_dia: r.va_valor_dia != null ? parseFloat(r.va_valor_dia) : null
    };
  });
}

/** Carrega feriados do histórico de rh_saves para a empresa */
async function loadFeriadosEmpresa(empresa) {
  if (!empresa) return;
  const { data } = await S.sb
    .from('rh_saves')
    .select('feriados_json')
    .eq('empresa_codigo', empresa)
    .not('feriados_json', 'is', null)
    .order('data_criacao', { ascending: false })
    .limit(1)
    .maybeSingle();
  try {
    const raw = data?.feriados_json;
    S.escalas.feriados = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
  } catch {
    S.escalas.feriados = [];
  }
  S.escalas.feriadosMarcados = new Set(S.escalas.feriados.map(f => f.data));
}
```

- [ ] **Verificar:** Abrir app logado → empresas carregam nos três selects, sem erros no console.
- [ ] **Commit:**
```bash
git add "Projeto Beneficios/script.js"
git commit -m "feat: foundation state/init/auth — Benefícios VA/VT"
```

---

## Task 5: Configurações Screen

**Files:**
- Modify: `Projeto Beneficios/script.js` (adicionar funções ao final)

- [ ] **Adicionar ao final de `script.js`:**

```javascript
// ============================================================
// CONFIGURAÇÕES
// ============================================================

function setupConfigListeners() {
  $('cfgEmpresa').addEventListener('change', async () => {
    const emp = $('cfgEmpresa').value;
    await Promise.all([loadConfig(emp), loadEmpregados(emp), loadIndividuais(emp)]);
    renderConfigPadrao();
    renderIndividuais();
  });

  $('cfgTabBar').addEventListener('click', e => {
    const tab = e.target.closest('.tab-btn')?.dataset.tab;
    if (!tab) return;
    $('cfgTabBar').querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab)
    );
    $('cfgTabPadrao').classList.toggle('hidden', tab !== 'padrao');
    $('cfgTabIndividual').classList.toggle('hidden', tab !== 'individual');
  });

  $('btnSalvarConfig').addEventListener('click', saveConfigPadrao);
}

function renderConfigPadrao() {
  if (!S.config) return;
  $('cfgVtRubrica').value  = S.config.vt.rubrica;
  $('cfgVtTipoProc').value = S.config.vt.tipoProc;
  $('cfgVtValorDia').value = S.config.vt.valorDia || '';
  $('cfgVaRubrica').value  = S.config.va.rubrica;
  $('cfgVaTipoProc').value = S.config.va.tipoProc;
  $('cfgVaValorDia').value = S.config.va.valorDia || '';
}

async function saveConfigPadrao() {
  const emp = $('cfgEmpresa').value;
  if (!emp) { showToast('Selecione uma empresa', 'error'); return; }

  const rows = [
    { codigo_empresa: emp, tipo: 'vt',
      codigo_rubrica: $('cfgVtRubrica').value.trim(),
      tipo_processo:  $('cfgVtTipoProc').value,
      valor_dia:      parseDecimal($('cfgVtValorDia').value) },
    { codigo_empresa: emp, tipo: 'va',
      codigo_rubrica: $('cfgVaRubrica').value.trim(),
      tipo_processo:  $('cfgVaTipoProc').value,
      valor_dia:      parseDecimal($('cfgVaValorDia').value) }
  ];

  const { error } = await S.sb
    .from('rh_beneficios_config')
    .upsert(rows, { onConflict: 'codigo_empresa,tipo' });

  if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
  await loadConfig(emp);
  showToast('✅ Configurações salvas!');
}

function renderIndividuais() {
  const tbody = $('indTbody');
  tbody.innerHTML = '';
  if (!S.empregados.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#7f8c8d;padding:16px">Selecione uma empresa</td></tr>';
    return;
  }
  S.empregados.forEach(emp => {
    const ind = S.individuais[emp.codigo_empregado] || {};
    const hasVt = ind.vt_dia != null;
    const hasVa = ind.va_dia != null;
    const vtVal = hasVt ? ind.vt_dia : '';
    const vaVal = hasVa ? ind.va_dia : '';
    const vtPlaceholder = S.config ? `padrão R$ ${fmtMoeda(S.config.vt.valorDia)}` : 'padrão';
    const vaPlaceholder = S.config ? `padrão R$ ${fmtMoeda(S.config.va.valorDia)}` : 'padrão';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#7f8c8d">${emp.codigo_empregado}</td>
      <td>${emp.nome_empregado}</td>
      <td><input type="number" step="0.01" min="0"
            class="ind-vt" data-cod="${emp.codigo_empregado}"
            value="${vtVal}" placeholder="${vtPlaceholder}"
            style="width:120px"></td>
      <td><input type="number" step="0.01" min="0"
            class="ind-va" data-cod="${emp.codigo_empregado}"
            value="${vaVal}" placeholder="${vaPlaceholder}"
            style="width:120px"></td>
      <td><button class="btn btn-sm btn-secondary btn-salvar-ind"
            data-cod="${emp.codigo_empregado}">💾</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-salvar-ind').forEach(btn => {
    btn.addEventListener('click', () => saveIndividual($('cfgEmpresa').value, btn.dataset.cod));
  });
}

async function saveIndividual(empresa, codEmp) {
  const vtInput = document.querySelector(`.ind-vt[data-cod="${codEmp}"]`);
  const vaInput = document.querySelector(`.ind-va[data-cod="${codEmp}"]`);
  const vt = vtInput.value.trim() === '' ? null : parseDecimal(vtInput.value);
  const va = vaInput.value.trim() === '' ? null : parseDecimal(vaInput.value);

  const { error } = await S.sb
    .from('rh_beneficios_individuais')
    .upsert({ codigo_empresa: empresa, codigo_empregado: codEmp, vt_valor_dia: vt, va_valor_dia: va },
            { onConflict: 'codigo_empresa,codigo_empregado' });

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  await loadIndividuais(empresa);
  showToast('✅ Valor individual salvo!');
}
```

- [ ] **Verificar:** Abrir Configurações → selecionar empresa → preencher rubricas e valor padrão → clicar Salvar → recarregar → valores persistiram. Testar Valores Individuais: salvar VT individual de um empregado → recarregar → valor mantido.
- [ ] **Commit:**
```bash
git add "Projeto Beneficios/script.js"
git commit -m "feat: Configurações screen — Benefícios VA/VT"
```

---

## Task 6: Escalas — Calendário + Feriados + Modo "Dias da Semana"

**Files:**
- Modify: `Projeto Beneficios/script.js`

- [ ] **Adicionar ao final de `script.js`:**

```javascript
// ============================================================
// ESCALAS
// ============================================================

function setupEscalasListeners() {
  $('escEmpresa').addEventListener('change', async () => {
    await loadFeriadosEmpresa($('escEmpresa').value);
    renderFeriados();
    calcularEAtualizar();
  });

  $('escMesRef').addEventListener('change', () => {
    S.escalas.mesRef = $('escMesRef').value;
    calcularEAtualizar();
  });

  $('escConsiderarFeriados').addEventListener('change', e => {
    $('feriadosCard').style.display = e.target.value === 'sim' ? 'block' : 'none';
    calcularEAtualizar();
  });

  // Abas de modo
  $('escalaTabBar').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    $('escalaTabBar').querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    const modo = btn.dataset.modo;
    S.escalas.modo = modo;
    $('modoSemana').classList.toggle('hidden',      modo !== 'semana');
    $('modoRevezamento').classList.toggle('hidden', modo !== 'revezamento');
    $('modoManual').classList.toggle('hidden',      modo !== 'manual');
    calcularEAtualizar();
  });

  // Toggles dos dias da semana
  $('dayToggles').addEventListener('click', e => {
    const btn = e.target.closest('.day-btn');
    if (!btn) return;
    const dia = parseInt(btn.dataset.dia);
    if (S.escalas.diasSemana.has(dia)) S.escalas.diasSemana.delete(dia);
    else S.escalas.diasSemana.add(dia);
    btn.classList.toggle('active', S.escalas.diasSemana.has(dia));
    atualizarEscalaLabel();
    calcularEAtualizar();
  });

  // Revezamento
  ['revTrab','revFolga','revInicio'].forEach(id => {
    $(id).addEventListener('change', () => {
      S.escalas.revTrab   = parseInt($('revTrab').value)  || 5;
      S.escalas.revFolga  = parseInt($('revFolga').value) || 2;
      S.escalas.revInicio = $('revInicio').value;
      calcularEAtualizar();
    });
  });

  // Feriados
  $('btnAddFeriado').addEventListener('click', () => {
    $('addFeriadoForm').style.display = 'flex';
  });
  $('btnConfirmarFeriado').addEventListener('click', adicionarFeriado);

  // Aplicar nos lançamentos
  $('btnAplicarEscala').addEventListener('click', aplicarNosLancamentos);
}

function atualizarEscalaLabel() {
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const sel = [0,1,2,3,4,5,6].filter(d => S.escalas.diasSemana.has(d));
  if (!sel.length) { $('escalaLabel').textContent = 'Nenhum dia selecionado'; return; }
  const nomes = sel.map(d => dias[d]).join(', ');
  $('escalaLabel').textContent = `Escala ${sel.length}×${7 - sel.length} — ${nomes}`;
}

function renderFeriados() {
  const mes = (S.escalas.mesRef || '').split('/')[0];
  const feriadosMes = mes
    ? S.escalas.feriados.filter(f => f.data && f.data.split('/')[1] === mes)
    : S.escalas.feriados;

  const tbody = $('feriadosTbody');
  tbody.innerHTML = '';
  if (!feriadosMes.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#7f8c8d;padding:12px">Nenhum feriado para este mês</td></tr>';
    return;
  }
  feriadosMes.forEach(f => {
    const marcado = S.escalas.feriadosMarcados.has(f.data);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" data-data="${f.data}" ${marcado ? 'checked' : ''}></td>
      <td>${f.data}</td><td>${f.descricao}</td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) S.escalas.feriadosMarcados.add(cb.dataset.data);
      else S.escalas.feriadosMarcados.delete(cb.dataset.data);
      calcularEAtualizar();
    });
  });
}

function adicionarFeriado() {
  const data = $('novaDataFeriado').value.trim();    // DD/MM
  const desc = $('novaDescFeriado').value.trim();
  if (!/^\d{2}\/\d{2}$/.test(data)) { showToast('Formato inválido. Use DD/MM', 'error'); return; }
  if (!desc) { showToast('Informe a descrição', 'error'); return; }
  if (!S.escalas.feriados.some(f => f.data === data)) {
    S.escalas.feriados.push({ data, descricao: desc });
    S.escalas.feriadosMarcados.add(data);
  }
  $('novaDataFeriado').value = '';
  $('novaDescFeriado').value = '';
  $('addFeriadoForm').style.display = 'none';
  renderFeriados();
  calcularEAtualizar();
}

/** Retorna um array de Date objects para cada dia do mês especificado (MM/AAAA) */
function getDiasMes(mesAno) {
  const [mm, aaaa] = (mesAno || '').split('/');
  if (!mm || !aaaa) return [];
  const ano = parseInt(aaaa), mes = parseInt(mm) - 1;
  const dias = [];
  const total = new Date(ano, mes + 1, 0).getDate();
  for (let d = 1; d <= total; d++) dias.push(new Date(ano, mes, d));
  return dias;
}

/** Para um modo "semana": retorna Set de datas 'YYYY-MM-DD' que são dias de trabalho */
function calcDiasSemana(dias) {
  return new Set(
    dias
      .filter(d => S.escalas.diasSemana.has(d.getDay()))
      .map(d => d.toISOString().split('T')[0])
  );
}

/** Para revezamento: projeta os dias trabalhados no mês */
function calcRevezamento(dias) {
  if (!S.escalas.revInicio) return new Set();
  const [dd, mm, aaaa] = S.escalas.revInicio.split('/');
  if (!dd || !mm || !aaaa) return new Set();
  const inicio = new Date(`${aaaa}-${mm}-${dd}`);
  const ciclo = S.escalas.revTrab + S.escalas.revFolga;
  const resultado = new Set();
  dias.forEach(d => {
    const diff = Math.floor((d - inicio) / 86400000);
    const pos = ((diff % ciclo) + ciclo) % ciclo;
    if (pos < S.escalas.revTrab) resultado.add(d.toISOString().split('T')[0]);
  });
  return resultado;
}

/** Retorna Set de strings 'DD/MM' dos feriados marcados no mês informado */
function getFeriadosMarcadosMes(mesAno) {
  if ($('escConsiderarFeriados').value !== 'sim') return new Set();
  const [mm] = (mesAno || '').split('/');
  if (!mm) return new Set();
  return new Set(
    [...S.escalas.feriadosMarcados].filter(data => data.split('/')[1] === mm)
  );
}

/** Dada uma data 'YYYY-MM-DD', verifica se está na lista de feriados marcados */
function isFeriado(dateStr, feriadosMes) {
  const [yyyy, mm, dd] = dateStr.split('-');
  return feriadosMes.has(`${dd}/${mm}`);
}

function calcularDiasUteis() {
  const mesRef = S.escalas.mesRef;
  if (!mesRef) return { diasTrab: new Set(), feriadosDescontados: 0 };
  const todosDias = getDiasMes(mesRef);
  const feriadosMes = getFeriadosMarcadosMes(mesRef);

  let diasTrab;
  if (S.escalas.modo === 'semana') {
    diasTrab = calcDiasSemana(todosDias);
  } else if (S.escalas.modo === 'revezamento') {
    diasTrab = calcRevezamento(todosDias);
  } else {
    diasTrab = new Set(S.escalas.diasManuais);
  }

  let feriadosDescontados = 0;
  for (const d of [...diasTrab]) {
    if (isFeriado(d, feriadosMes)) { diasTrab.delete(d); feriadosDescontados++; }
  }
  return { diasTrab, feriadosDescontados };
}

function renderCalendario(diasTrab) {
  const mesRef = S.escalas.mesRef;
  const grid = $('calendarGrid');
  grid.innerHTML = '';
  if (!mesRef) return;

  const [mm, aaaa] = mesRef.split('/');
  const ano = parseInt(aaaa), mes = parseInt(mm) - 1;
  const feriadosMes = getFeriadosMarcadosMes(mesRef);

  $('calTitulo').textContent = `🗓️ ${new Date(ano, mes).toLocaleDateString('pt-BR', {month:'long', year:'numeric'})}`;

  const headers = ['D','S','T','Q','Q','S','S'];
  headers.forEach(h => {
    const el = document.createElement('div');
    el.className = 'cal-header'; el.textContent = h;
    grid.appendChild(el);
  });

  const primeiroDia = new Date(ano, mes, 1).getDay();
  for (let i = 0; i < primeiroDia; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el);
  }

  const totalDias = new Date(ano, mes + 1, 0).getDate();
  for (let d = 1; d <= totalDias; d++) {
    const date = new Date(ano, mes, d);
    const dateStr = date.toISOString().split('T')[0];
    const ddMm = `${String(d).padStart(2,'0')}/${mm}`;
    const dow = date.getDay();
    const eFeriado = isFeriado(dateStr, feriadosMes);
    const eTrab   = diasTrab.has(dateStr);
    const eManual = S.escalas.modo === 'manual';

    const el = document.createElement('div');
    el.textContent = d;
    if (eManual) {
      el.className = 'cal-day manual-toggle' + (eTrab ? ' work' : (dow === 0 || dow === 6 ? ' weekend' : ''));
      el.addEventListener('click', () => toggleDiaManual(dateStr));
    } else if (eManual && eManual) {
      // noop
    } else if (eManual) {
      el.className = 'cal-day manual-toggle';
    } else if (eFeriado) {
      el.className = 'cal-day holiday';
      el.title = S.escalas.feriados.find(f => f.data === ddMm)?.descricao || 'Feriado';
    } else if (eTrab) {
      el.className = 'cal-day work';
    } else {
      el.className = 'cal-day' + (dow === 0 || dow === 6 ? ' weekend' : '');
    }
    grid.appendChild(el);
  }
}

function toggleDiaManual(dateStr) {
  if (S.escalas.diasManuais.has(dateStr)) S.escalas.diasManuais.delete(dateStr);
  else S.escalas.diasManuais.add(dateStr);
  calcularEAtualizar();
}

function calcularEAtualizar() {
  S.escalas.mesRef = $('escMesRef').value;
  const { diasTrab, feriadosDescontados } = calcularDiasUteis();
  const total = diasTrab.size;

  renderCalendario(diasTrab);

  const mesRef = S.escalas.mesRef;
  $('resultMes').textContent = mesRef
    ? new Date(...mesRef.split('/').reverse().map((v,i)=>i===1?v-1:v)).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
    : '—';
  $('resultNum').textContent = mesRef ? total : '—';

  const detalhes = [];
  if (feriadosDescontados > 0) detalhes.push(`${total + feriadosDescontados} úteis − ${feriadosDescontados} feriado(s)`);
  $('resultDetalhe').textContent = detalhes.join(' · ');
  $('btnAplicarEscala').disabled = !mesRef || total === 0;

  // Atualizar banner de referência nos lançamentos
  $('bannerMesRef').textContent = mesRef || '—';
}

function aplicarNosLancamentos() {
  const { diasTrab } = calcularDiasUteis();
  const total = diasTrab.size;
  const mesRef = S.escalas.mesRef;
  if (!mesRef || total === 0) { showToast('Calcule primeiro os dias úteis', 'error'); return; }

  $('lancDias').value  = total;
  $('lancMesRef').value = mesRef;
  S.lancamento.mesRef = mesRef;
  atualizarTotaisPadrao();
  showScreen('lancamentos');
  showToast(`✅ ${total} dias aplicados nos Lançamentos`);
}
```

- [ ] **Verificar:** Abrir Escalas → selecionar empresa + mês "06/2026" → marcar "Sim" para feriados → calendário exibe junho → total de dias aparece no box → clicar "Aplicar nos Lançamentos" → navega para Lançamentos com dias preenchidos.
- [ ] **Commit:**
```bash
git add "Projeto Beneficios/script.js"
git commit -m "feat: Escalas screen (dias da semana, revezamento, manual, feriados) — Benefícios VA/VT"
```

---

## Task 7: Lançamentos — Form, Grade, Totais

**Files:**
- Modify: `Projeto Beneficios/script.js`

- [ ] **Adicionar ao final de `script.js`:**

```javascript
// ============================================================
// LANÇAMENTOS
// ============================================================

function setupLancamentosListeners() {
  $('lancEmpresa').addEventListener('change', async () => {
    const emp = $('lancEmpresa').value;
    S.lancamento.empresa = emp;
    await Promise.all([loadConfig(emp), loadEmpregados(emp), loadIndividuais(emp)]);
    preencherConfigNaLancamentos();
    await tryLoadLancamento();
    buildGrade();
    renderGrade();
  });

  $('lancCompPgto').addEventListener('change', async () => {
    S.lancamento.compPgto = $('lancCompPgto').value;
    $('bannerCompPgto').textContent = S.lancamento.compPgto || '—';
    await tryLoadLancamento();
    renderGrade();
  });

  $('lancMesRef').addEventListener('change', () => {
    S.lancamento.mesRef = $('lancMesRef').value;
    $('bannerMesRef').textContent = S.lancamento.mesRef || '—';
  });

  ['lancVtDia','lancVaDia','lancDias'].forEach(id => {
    $(id).addEventListener('input', atualizarTotaisPadrao);
  });

  $('btnAplicarPadrao').addEventListener('click', aplicarPadraoATodos);
  $('btnSalvar').addEventListener('click', salvarLancamento);
  $('btnGerarTxt').addEventListener('click', gerarTxt);

  $('btnImportarExcel').addEventListener('click', () => $('inputExcel').click());
  $('inputExcel').addEventListener('change', e => {
    if (e.target.files[0]) importarExcel(e.target.files[0]);
    e.target.value = '';
  });
}

/** Pré-preenche valores padrão dos campos ao selecionar empresa */
function preencherConfigNaLancamentos() {
  if (!S.config) return;
  $('lancVtDia').value = S.config.vt.valorDia || '';
  $('lancVaDia').value = S.config.va.valorDia || '';
  atualizarTotaisPadrao();
}

function atualizarTotaisPadrao() {
  const vt   = parseDecimal($('lancVtDia').value);
  const va   = parseDecimal($('lancVaDia').value);
  const dias = parseInt($('lancDias').value) || 0;
  $('lancTotalVt').value = dias > 0 ? `R$ ${fmtMoeda(vt * dias)}` : '';
  $('lancTotalVa').value = dias > 0 ? `R$ ${fmtMoeda(va * dias)}` : '';
}

/** Tenta carregar lançamento salvo para empresa + competência */
async function tryLoadLancamento() {
  const emp  = S.lancamento.empresa;
  const comp = S.lancamento.compPgto;
  if (!emp || !comp) return;

  const { data } = await S.sb
    .from('rh_beneficios_lancamentos')
    .select('*')
    .eq('codigo_empresa', emp)
    .eq('competencia_pagamento', comp)
    .maybeSingle();

  if (data) {
    S.lancamento.mesRef    = data.mes_referencia || '';
    S.lancamento.tipoProc  = data.tipo_processo || '11';
    S.lancamento.linhas    = data.linhas_json || [];
    $('lancMesRef').value  = S.lancamento.mesRef;
    $('lancTipoProc').value = S.lancamento.tipoProc;
    $('bannerMesRef').textContent = S.lancamento.mesRef || '—';
    showToast('Lançamento anterior carregado', 'info');
  } else {
    S.lancamento.linhas = [];
    buildGrade();
  }
}

/** Monta linhas do estado inicial com base nos empregados + config + individuais */
function buildGrade() {
  const vtPad = parseDecimal($('lancVtDia').value) || (S.config?.vt.valorDia || 0);
  const vaPad = parseDecimal($('lancVaDia').value) || (S.config?.va.valorDia || 0);
  const dias  = parseInt($('lancDias').value) || 0;

  S.lancamento.linhas = S.empregados.map(emp => {
    const ind = S.individuais[emp.codigo_empregado] || {};
    const vtDia = ind.vt_dia != null ? ind.vt_dia : vtPad;
    const vaDia = ind.va_dia != null ? ind.va_dia : vaPad;
    const status = ind.vt_dia != null || ind.va_dia != null ? 'individual' : 'padrao';
    return {
      cod_emp: emp.codigo_empregado,
      nome:    emp.nome_empregado,
      vt_dia: vtDia, va_dia: vaDia, dias,
      total_vt: vtDia * dias, total_va: vaDia * dias,
      status
    };
  });
}

function calcTotaisLinha(linha) {
  linha.total_vt = parseDecimal(linha.vt_dia) * (parseInt(linha.dias) || 0);
  linha.total_va = parseDecimal(linha.va_dia) * (parseInt(linha.dias) || 0);
}

function renderGrade() {
  const tbody = $('gradeTbody');
  tbody.innerHTML = '';
  if (!S.lancamento.linhas.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#7f8c8d;padding:16px">Selecione empresa e competência</td></tr>';
    return;
  }

  S.lancamento.linhas.forEach((linha, idx) => {
    const badgeClass = {padrao:'badge-ok', individual:'badge-ind', divergente:'badge-warn'}[linha.status] || 'badge-ok';
    const badgeLabel = {padrao:'Padrão', individual:'Individual', divergente:'Divergente'}[linha.status] || 'Padrão';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${linha.cod_emp}</td>
      <td>${linha.nome}</td>
      <td><input type="number" step="0.01" min="0" class="grade-vt" data-idx="${idx}" value="${linha.vt_dia}"></td>
      <td><input type="number" step="0.01" min="0" class="grade-va" data-idx="${idx}" value="${linha.va_dia}"></td>
      <td><input type="number" min="0" max="31" class="grade-dias" data-idx="${idx}" value="${linha.dias}"></td>
      <td class="cell-calc">R$ ${fmtMoeda(linha.total_vt)}</td>
      <td class="cell-calc">R$ ${fmtMoeda(linha.total_va)}</td>
      <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
      <td></td>`;
    tbody.appendChild(tr);
  });

  // Input listeners na grade
  tbody.querySelectorAll('.grade-vt').forEach(inp => {
    inp.addEventListener('change', () => onGradeChange(parseInt(inp.dataset.idx), 'vt', parseDecimal(inp.value)));
  });
  tbody.querySelectorAll('.grade-va').forEach(inp => {
    inp.addEventListener('change', () => onGradeChange(parseInt(inp.dataset.idx), 'va', parseDecimal(inp.value)));
  });
  tbody.querySelectorAll('.grade-dias').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = parseInt(inp.dataset.idx);
      S.lancamento.linhas[idx].dias = parseInt(inp.value) || 0;
      calcTotaisLinha(S.lancamento.linhas[idx]);
      renderGrade();
    });
  });
}

/** Trata mudança de VT ou VA em uma linha — verifica divergência */
function onGradeChange(idx, tipo, novoValor) {
  const linha = S.lancamento.linhas[idx];
  const ind   = S.individuais[linha.cod_emp] || {};
  const configVal = tipo === 'vt'
    ? (ind.vt_dia != null ? ind.vt_dia : S.config?.vt.valorDia || 0)
    : (ind.va_dia != null ? ind.va_dia : S.config?.va.valorDia || 0);

  if (Math.abs(novoValor - configVal) > 0.001) {
    mostrarModalDivergencia(linha, tipo, novoValor, configVal, (confirmado) => {
      if (confirmado) {
        if (tipo === 'vt') linha.vt_dia = novoValor; else linha.va_dia = novoValor;
        linha.status = 'divergente';
        calcTotaisLinha(linha);
        renderGrade();
      } else {
        // Reverter input
        renderGrade();
      }
    });
  } else {
    if (tipo === 'vt') linha.vt_dia = novoValor; else linha.va_dia = novoValor;
    linha.status = ind.vt_dia != null || ind.va_dia != null ? 'individual' : 'padrao';
    calcTotaisLinha(linha);
    renderGrade();
  }
}

function mostrarModalDivergencia(linha, tipo, novoValor, configVal, callback) {
  const tipoLabel = tipo === 'vt' ? 'Vale Transporte' : 'Vale Alimentação';
  $('modalDivergenciaMsg').innerHTML =
    `O valor de <strong>${tipoLabel}</strong> para <strong>${linha.nome}</strong>:<br>
     <br>Novo valor: <strong>R$ ${fmtMoeda(novoValor)}</strong><br>
     Valor configurado: <strong>R$ ${fmtMoeda(configVal)}</strong><br>
     <br>Deseja confirmar a divergência?`;

  $('modalDivergencia').classList.remove('hidden');

  const onConfirmar = () => { cleanup(); callback(true); };
  const onCancelar  = () => { cleanup(); callback(false); };

  function cleanup() {
    $('modalDivergencia').classList.add('hidden');
    $('btnDivConfirmar').removeEventListener('click', onConfirmar);
    $('btnDivCancelar').removeEventListener('click', onCancelar);
  }

  $('btnDivConfirmar').addEventListener('click', onConfirmar);
  $('btnDivCancelar').addEventListener('click', onCancelar);
}

function aplicarPadraoATodos() {
  const vtPad = parseDecimal($('lancVtDia').value);
  const vaPad = parseDecimal($('lancVaDia').value);
  const dias  = parseInt($('lancDias').value) || 0;

  S.lancamento.linhas.forEach(linha => {
    const ind = S.individuais[linha.cod_emp] || {};
    linha.vt_dia = ind.vt_dia != null ? ind.vt_dia : vtPad;
    linha.va_dia = ind.va_dia != null ? ind.va_dia : vaPad;
    linha.dias   = dias;
    calcTotaisLinha(linha);
    linha.status = ind.vt_dia != null || ind.va_dia != null ? 'individual' : 'padrao';
  });
  renderGrade();
  showToast('✅ Padrão aplicado a todos');
}

async function salvarLancamento() {
  const emp  = S.lancamento.empresa;
  const comp = S.lancamento.compPgto;
  if (!emp || !comp) { showToast('Selecione empresa e competência', 'error'); return; }
  if (!S.lancamento.linhas.length) { showToast('Grade vazia', 'error'); return; }

  const payload = {
    codigo_empresa:        emp,
    competencia_pagamento: comp,
    mes_referencia:        S.lancamento.mesRef || null,
    tipo_processo:         $('lancTipoProc').value,
    linhas_json:           S.lancamento.linhas,
    usuario_id:            S.auth?.authUserId || null,
    atualizado_em:         new Date().toISOString()
  };

  const { error } = await S.sb
    .from('rh_beneficios_lancamentos')
    .upsert(payload, { onConflict: 'codigo_empresa,competencia_pagamento' });

  if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
  showToast('✅ Lançamento salvo!');
}
```

- [ ] **Verificar:** Selecionar empresa → empregados carregam na grade → preencher competência → campos de dias e valores preenchidos → "Aplicar Padrão a Todos" distribui valores → alterar VT de um empregado para valor diferente do configurado → modal de divergência aparece → confirmar → status muda para "Divergente" → Salvar → recarregar página → lançamento reaparece.
- [ ] **Commit:**
```bash
git add "Projeto Beneficios/script.js"
git commit -m "feat: Lançamentos screen (grade, divergência, salvar/carregar) — Benefícios VA/VT"
```

---

## Task 8: Excel Import

**Files:**
- Modify: `Projeto Beneficios/script.js`

- [ ] **Adicionar ao final de `script.js`:**

```javascript
// ============================================================
// EXCEL IMPORT
// ============================================================

/**
 * Colunas esperadas (índice 0-based):
 * A(0): Código da Empresa
 * B(1): Código do Empregado
 * C(2): Valor Diário VT (R$)
 * D(3): Valor Diário VA (R$)
 * E(4): Quantidade de Dias
 */
function importarExcel(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const workbook = XLSX.read(e.target.result, { type: 'array' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const empAtual  = S.lancamento.empresa;
    const linhasMap = {};
    S.lancamento.linhas.forEach(l => { linhasMap[l.cod_emp] = l; });

    const pendentes = []; // [{linha, tipo, novoValor, configVal}]

    for (const row of rows) {
      if (!row[1]) continue; // pula linhas sem código de empregado
      const codEmp = String(row[1]).trim();
      const codEmp = String(row[1]).trim().padStart(
        S.empregados.find(e => e.codigo_empregado === String(row[1]).trim())
          ? String(row[1]).trim().length : String(row[1]).trim().length,
        '0'
      );
      const vtNovo = parseDecimal(row[2]);
      const vaNovo = parseDecimal(row[3]);
      const diasNovo = parseInt(row[4]) || 0;

      const linha = linhasMap[codEmp];
      if (!linha) continue; // empregado não na grade, ignorar

      const ind = S.individuais[codEmp] || {};
      const vtConfig = ind.vt_dia != null ? ind.vt_dia : (S.config?.vt.valorDia || 0);
      const vaConfig = ind.va_dia != null ? ind.va_dia : (S.config?.va.valorDia || 0);

      const divergeVt = Math.abs(vtNovo - vtConfig) > 0.001;
      const divergeVa = Math.abs(vaNovo - vaConfig) > 0.001;

      if (divergeVt || divergeVa) {
        pendentes.push({ linha, vtNovo, vaNovo, diasNovo, vtConfig, vaConfig, divergeVt, divergeVa });
      } else {
        linha.vt_dia = vtNovo; linha.va_dia = vaNovo; linha.dias = diasNovo;
        calcTotaisLinha(linha);
        linha.status = ind.vt_dia != null || ind.va_dia != null ? 'individual' : 'padrao';
      }
    }

    // Processar pendentes sequencialmente
    for (const p of pendentes) {
      await new Promise(resolve => {
        const tiposDiv = [];
        if (p.divergeVt) tiposDiv.push(`VT: R$ ${fmtMoeda(p.vtNovo)} (config: R$ ${fmtMoeda(p.vtConfig)})`);
        if (p.divergeVa) tiposDiv.push(`VA: R$ ${fmtMoeda(p.vaNovo)} (config: R$ ${fmtMoeda(p.vaConfig)})`);

        $('modalDivergenciaMsg').innerHTML =
          `Importação de <strong>${p.linha.nome}</strong> com divergência:<br><br>
           ${tiposDiv.join('<br>')}<br><br>Confirmar os valores importados?`;

        $('modalDivergencia').classList.remove('hidden');

        const onConfirmar = () => {
          p.linha.vt_dia = p.vtNovo; p.linha.va_dia = p.vaNovo; p.linha.dias = p.diasNovo;
          calcTotaisLinha(p.linha);
          p.linha.status = 'divergente';
          cleanup(); resolve();
        };
        const onCancelar = () => { cleanup(); resolve(); };

        function cleanup() {
          $('modalDivergencia').classList.add('hidden');
          $('btnDivConfirmar').removeEventListener('click', onConfirmar);
          $('btnDivCancelar').removeEventListener('click', onCancelar);
        }
        $('btnDivConfirmar').addEventListener('click', onConfirmar);
        $('btnDivCancelar').addEventListener('click', onCancelar);
      });
    }

    renderGrade();
    showToast(`✅ Excel importado — ${rows.length - 1} linha(s) processada(s)`);
  };
  reader.readAsArrayBuffer(file);
}
```

> **Nota:** O trecho com `codEmp` duplicado deve ser corrigido para simplesmente:
> `const codEmp = String(row[1]).trim();`

- [ ] **Corrigir** o trecho duplicado de `codEmp` deixando apenas:
```javascript
const codEmp = String(row[1]).trim();
```

- [ ] **Verificar:** Criar um arquivo `.xlsx` de teste com colunas A-E (empresa, empregado, VT, VA, dias) → importar → linhas atualizam na grade → para valores divergentes, modal aparece → confirmar/cancelar funciona.
- [ ] **Commit:**
```bash
git add "Projeto Beneficios/script.js"
git commit -m "feat: Excel import — Benefícios VA/VT"
```

---

## Task 9: TXT Generation

**Files:**
- Modify: `Projeto Beneficios/script.js`

- [ ] **Adicionar ao final de `script.js`:**

```javascript
// ============================================================
// TXT GENERATION
// ============================================================

/**
 * Formato de cada linha:
 * 10[cod_emp_10D][AAAAMM][cod_rubrica_9D][tipo_proc_2D][centavos_9D][cod_empresa_10D]\n
 *
 * Encoding de valor monetário: Math.round(valorDia * dias * 100) → padStart(9,'0')
 */
function gerarTxt() {
  const empresa  = S.lancamento.empresa;
  const compPgto = S.lancamento.compPgto;
  const tipoProc = $('lancTipoProc').value;

  if (!empresa || !compPgto) { showToast('Selecione empresa e competência', 'error'); return; }
  if (!S.config?.vt.rubrica || !S.config?.va.rubrica) {
    showToast('Configure as rubricas de VT e VA em Configurações', 'error'); return;
  }
  if (!S.lancamento.linhas.length) { showToast('Grade vazia', 'error'); return; }

  const aaaamm      = compToAaaamm(compPgto);
  const codEmpPad   = pad(empresa, 10);
  const rubVt       = pad(S.config.vt.rubrica, 9);
  const rubVa       = pad(S.config.va.rubrica, 9);
  const tpPad       = pad(tipoProc, 2);

  let linhas = [];

  S.lancamento.linhas.forEach(linha => {
    const codEmpFolhaPad = pad(linha.cod_emp, 10);
    const dias = parseInt(linha.dias) || 0;

    const vtCentavos = Math.round(parseDecimal(linha.vt_dia) * dias * 100);
    const vaCentavos = Math.round(parseDecimal(linha.va_dia) * dias * 100);

    if (vtCentavos > 0) {
      linhas.push(`10${codEmpFolhaPad}${aaaamm}${rubVt}${tpPad}${pad(vtCentavos, 9)}${codEmpPad}`);
    }
    if (vaCentavos > 0) {
      linhas.push(`10${codEmpFolhaPad}${aaaamm}${rubVa}${tpPad}${pad(vaCentavos, 9)}${codEmpPad}`);
    }
  });

  if (!linhas.length) { showToast('Nenhum lançamento com valor > 0', 'error'); return; }

  const conteudo = linhas.join('\n') + '\n';
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const [mm, aaaa] = compPgto.split('/');
  const nomeArquivo = `Beneficios_${empresa}_${mm}-${aaaa}.txt`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(a.href);

  showToast(`✅ ${nomeArquivo} gerado com ${linhas.length} linha(s)`);
}
```

- [ ] **Verificar:** Com grade preenchida → clicar "Gerar TXT" → arquivo baixa → abrir em editor de texto → verificar formato das linhas:
  - 2 chars "10"
  - 10 chars código empregado (zero-padded)
  - 6 chars AAAAMM (ex: "202605")
  - 9 chars código rubrica (zero-padded)
  - 2 chars tipo processo (ex: "11")
  - 9 chars valor em centavos (zero-padded)
  - 10 chars código empresa (zero-padded)
  - Total: 48 chars por linha

  Exemplo esperado: `10000000000120260500000028511000000027500000000010`
  (empregado 1, junho 2026, rubrica 285, tipo 11, R$ 275,00 = 27500 centavos, empresa 10)

- [ ] **Commit:**
```bash
git add "Projeto Beneficios/script.js"
git commit -m "feat: TXT generation — Benefícios VA/VT"
```

---

## Task 10: Portal Integration & Access Grant

**Files:**
- `_sql/add_beneficios_va_vt.sql` (já executado no Task 1)

- [ ] **No admin-dashboard.html** → aba Acessos → localizar usuário que precisa acessar a ferramenta → clicar "✎ Editar Acesso" → marcar ✓ "Benefícios VA/VT" → Salvar.

- [ ] **Testar fluxo completo:**
  1. Login com usuário que tem acesso → portal exibe card "🎫 Benefícios VA/VT"
  2. Clicar no card → ferramenta abre
  3. Configurações → empresa → preencher rubricas e valores padrão → salvar ✓
  4. Escalas → selecionar empresa + mês "06/2026" → modo "Dias da semana" → Seg-Sex → resultado "21 dias" → Aplicar nos Lançamentos ✓
  5. Lançamentos → empresa + competência "05/2026" → grade com empregados → "Aplicar Padrão a Todos" → Salvar ✓
  6. Recarregar página → Lançamentos → mesma empresa + competência → dados recarregados ✓
  7. Importar Excel com um valor de VT diferente → modal de divergência aparece → confirmar ✓
  8. Gerar TXT → arquivo baixa → verificar formato das linhas ✓
  9. Usuário sem acesso → ferramenta não aparece no portal ✓

- [ ] **Commit final:**
```bash
git add -A
git commit -m "feat: Benefícios VA/VT — ferramenta completa"
```

---

## Notas de Implementação

### Formato do TXT
Cada linha tem exatamente 48 caracteres (sem o `\n`):
```
10 [10D] [6D] [9D] [2D] [9D] [10D]
```
Valor em centavos: `Math.round(valorDia * dias * 100)` — sem casas decimais.

### Feriados
Não há tabela separada `rh_feriados`. Os feriados vêm de `rh_saves.feriados_json` (formato `[{data:"DD/MM", descricao:"..."}]`). A tela Escalas carrega o registro mais recente de qualquer empregado daquela empresa para obter a lista base. O usuário pode adicionar/remover feriados por sessão.

### Divergência
Regra: `Math.abs(novoValor - valorConfigurado) > 0.001` → exige confirmação. A verificação usa o valor individual do empregado se configurado, ou o padrão da empresa.
