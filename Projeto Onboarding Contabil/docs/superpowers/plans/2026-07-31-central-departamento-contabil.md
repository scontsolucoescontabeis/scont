# Central do Departamento Contábil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `Projeto Onboarding Contabil` into a hub ("Central do Departamento
Contábil") with two sub-tools — Onboarding (relocated, unchanged logic) and Mapeamento
Estratégico (new) — backed by three new Supabase tables.

**Architecture:** Static HTML/vanilla-JS pages (matches every other tool in this portal,
e.g. `Projeto RH`), Supabase JS client for persistence, `PortalAuthGuard` for session
checks. No build step, no framework.

**Tech Stack:** HTML, vanilla JS (IIFE modules), Supabase JS v2 (CDN), existing
`shared.css`/`styles.css` conventions.

## Global Constraints

- Follow `_sql/schema_contabil_onboarding.sql` conventions exactly: `codigo_empresa`
  as text FK (no real FK constraint, matches `rh_empresas.codigo_empresa`), RLS
  policies scoped to `authenticated` role only, `updated_at` trigger.
- Every page keeps the existing auth overlay + `PortalAuthGuard.init(1)` pattern
  (see `onboarding.js` `iniciar()`).
- Portuguese (pt-BR) for all UI copy, matching the rest of the portal.
- No new dependencies/CDNs beyond what's already loaded (`@supabase/supabase-js@2`).
- SQL migration file is created but **not executed automatically** — this repo's
  convention (see multiple `schema_*.sql` files across projects) is the user runs
  migrations manually in the Supabase SQL editor.

---

## File Structure

| File | Responsibility |
|---|---|
| `_sql/schema_contabil_mapeamento.sql` (new, repo root `_sql/`) | 3 tables + RLS + trigger for Mapeamento Estratégico |
| `index.html` (rewritten) | Hub: two cards (Onboarding / Mapeamento Estratégico) |
| `onboarding.html` (renamed from `index.html`) | Existing onboarding UI, unchanged markup except nav target |
| `onboarding.js` (renamed from `app.js`) | Existing onboarding logic, unchanged except one line (back button target) |
| `mapeamento.html` (new) | Mapeamento Estratégico shell: sidebar + dashboard + profile containers |
| `mapeamento-nivel-atencao.js` (new) | Pure function: computes suggested `nivel_atencao` from mapeamento + pendências data. Unit-tested. |
| `mapeamento.js` (new) | Mapeamento Estratégico: data loading, dashboard rendering, profile form, pendências CRUD, empresas relacionadas |
| `test-mapeamento-nivel-atencao.js` (new) | Node test script for the pure calculator, following `Projeto RH/test-escala-calculo.js` convention |
| `styles.css` (modified) | Append hub + mapeamento styles (dashboard cards, badges, tags input, pendências list, accordion sections) |

**Interfaces between files:**
- `mapeamento-nivel-atencao.js` exports `calcularNivelSugerido(mapeamento, pendencias, hoje)` → `'baixo'|'medio'|'alto'|'critico'`. Loaded via `<script>` tag before `mapeamento.js` (browser global `window.calcularNivelSugerido`), and via `module.exports` for the Node test script (dual-export pattern, same as other parsers in this repo, e.g. `Projeto RH/ferias-parser.js`).
- `mapeamento.js` consumes `window.calcularNivelSugerido`, `window.PortalAuthGuard`, `window.supabase`, `SUPABASE_URL`/`SUPABASE_KEY` from `../supabase-config.js`.

---

### Task 1: SQL migration for Mapeamento Estratégico

**Files:**
- Create: `_sql/schema_contabil_mapeamento.sql`

**Interfaces:**
- Produces tables/columns consumed by Task 6-9: `contabil_mapeamento`,
  `contabil_mapeamento_pendencias`, `contabil_mapeamento_relacionadas` (see spec
  §2 for full column list).

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- MAPEAMENTO ESTRATÉGICO — Departamento Contábil
-- ============================================================

-- 1. TABELA: contabil_mapeamento (1 registro por empresa)
CREATE TABLE IF NOT EXISTS public.contabil_mapeamento (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa            TEXT NOT NULL UNIQUE,
    periodicidade             TEXT,
    regime_tributario         TEXT,
    responsavel_execucao      TEXT,
    ultimo_mes_fechado        DATE,
    situacao_2025_status      TEXT,
    situacao_2025_obs         TEXT,
    situacao_2026_status      TEXT,
    situacao_2026_obs         TEXT,
    financeiro_interno_bpo    TEXT,
    forma_envio_documentos    TEXT[] NOT NULL DEFAULT '{}',
    acesso_bancario_leitura   BOOLEAN NOT NULL DEFAULT false,
    bancos_utilizados         TEXT[] NOT NULL DEFAULT '{}',
    sistemas_utilizados       TEXT[] NOT NULL DEFAULT '{}',
    contato_nome              TEXT,
    contato_telefone          TEXT,
    contato_email             TEXT,
    entregaveis_esperados     TEXT[] NOT NULL DEFAULT '{}',
    entregaveis_obs           TEXT,
    particularidades_contabeis    TEXT,
    particularidades_fiscais      TEXT,
    particularidades_societarias  TEXT,
    obrigacoes_acessorias     TEXT[] NOT NULL DEFAULT '{}',
    nivel_atencao             TEXT NOT NULL DEFAULT 'baixo',
    nivel_atencao_travado     BOOLEAN NOT NULL DEFAULT false,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_mapeamento_empresa ON public.contabil_mapeamento (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_contabil_mapeamento_nivel   ON public.contabil_mapeamento (nivel_atencao);

-- 2. TABELA: contabil_mapeamento_pendencias (N por empresa)
CREATE TABLE IF NOT EXISTS public.contabil_mapeamento_pendencias (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapeamento_id  UUID NOT NULL REFERENCES public.contabil_mapeamento (id) ON DELETE CASCADE,
    descricao      TEXT NOT NULL,
    responsavel    TEXT,
    prazo          DATE,
    status         TEXT NOT NULL DEFAULT 'aberta',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolvido_em   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contabil_pendencias_mapeamento ON public.contabil_mapeamento_pendencias (mapeamento_id);
CREATE INDEX IF NOT EXISTS idx_contabil_pendencias_status     ON public.contabil_mapeamento_pendencias (status);

-- 3. TABELA: contabil_mapeamento_relacionadas (N:N simétrico)
CREATE TABLE IF NOT EXISTS public.contabil_mapeamento_relacionadas (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa              TEXT NOT NULL,
    codigo_empresa_relacionada  TEXT NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (codigo_empresa, codigo_empresa_relacionada)
);

CREATE INDEX IF NOT EXISTS idx_contabil_relacionadas_empresa ON public.contabil_mapeamento_relacionadas (codigo_empresa);

-- 4. RLS
ALTER TABLE public.contabil_mapeamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contabil_mapeamento: leitura autenticado" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento: escrita autenticado"  ON public.contabil_mapeamento;
CREATE POLICY "contabil_mapeamento: leitura autenticado"
    ON public.contabil_mapeamento FOR SELECT
    TO authenticated USING (true);
CREATE POLICY "contabil_mapeamento: escrita autenticado"
    ON public.contabil_mapeamento FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.contabil_mapeamento_pendencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contabil_pendencias: leitura autenticado" ON public.contabil_mapeamento_pendencias;
DROP POLICY IF EXISTS "contabil_pendencias: escrita autenticado"  ON public.contabil_mapeamento_pendencias;
CREATE POLICY "contabil_pendencias: leitura autenticado"
    ON public.contabil_mapeamento_pendencias FOR SELECT
    TO authenticated USING (true);
CREATE POLICY "contabil_pendencias: escrita autenticado"
    ON public.contabil_mapeamento_pendencias FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.contabil_mapeamento_relacionadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contabil_relacionadas: leitura autenticado" ON public.contabil_mapeamento_relacionadas;
DROP POLICY IF EXISTS "contabil_relacionadas: escrita autenticado"  ON public.contabil_mapeamento_relacionadas;
CREATE POLICY "contabil_relacionadas: leitura autenticado"
    ON public.contabil_mapeamento_relacionadas FOR SELECT
    TO authenticated USING (true);
CREATE POLICY "contabil_relacionadas: escrita autenticado"
    ON public.contabil_mapeamento_relacionadas FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- 5. updated_at automático
CREATE OR REPLACE FUNCTION public.contabil_mapeamento_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contabil_mapeamento_updated_at ON public.contabil_mapeamento;
CREATE TRIGGER trg_contabil_mapeamento_updated_at
    BEFORE UPDATE ON public.contabil_mapeamento
    FOR EACH ROW
    EXECUTE FUNCTION public.contabil_mapeamento_set_updated_at();

-- 6. Renomeia o card no portal (rodar manualmente após revisar)
UPDATE public.ferramentas
   SET nome = 'Departamento Contábil',
       descricao = 'Onboarding e mapeamento estratégico de clientes contábeis'
 WHERE nome = 'Onboarding Contábil';
```

- [ ] **Step 2: Verify against spec** — re-read spec §2 and confirm every column
  listed there exists in the CREATE TABLE statements above (checklist, no execution
  needed — there is no local Postgres to run this against; matches this repo's
  existing convention of hand-reviewed, manually-executed SQL files).

- [ ] **Step 3: Commit**

```bash
git add "_sql/schema_contabil_mapeamento.sql"
git commit -m "feat(contabil): schema SQL do Mapeamento Estrategico"
```

---

### Task 2: Rename Onboarding files, no logic change

**Files:**
- Rename: `index.html` → `onboarding.html`
- Rename: `app.js` → `onboarding.js`
- Modify: `onboarding.html` (script src + back-button target)

**Interfaces:**
- No exported interface change — `onboarding.js` keeps the same internal IIFE,
  same `iniciar()` entry point.

- [ ] **Step 1: Rename via git mv**

```bash
git mv "Projeto Onboarding Contabil/index.html" "Projeto Onboarding Contabil/onboarding.html"
git mv "Projeto Onboarding Contabil/app.js" "Projeto Onboarding Contabil/onboarding.js"
```

- [ ] **Step 2: Update `onboarding.html`**

Change the script tag at the bottom from `<script src="app.js"></script>` to
`<script src="onboarding.js"></script>`. Change the sidebar footer button:

```html
<button class="btn-voltar" onclick="window.location.href='index.html'">
  🏠 <span>Central Contábil</span>
</button>
```

(replaces the old `onclick="window.location.href='../portal.html'"`).

- [ ] **Step 3: Manual check** — open `onboarding.html` directly in a browser via
  the portal (Central → Onboarding) and confirm the existing onboarding flow still
  works: list loads, "+ Novo Onboarding" opens the form, back button returns to the
  new hub instead of the old portal page.

- [ ] **Step 4: Commit**

```bash
git add "Projeto Onboarding Contabil/onboarding.html" "Projeto Onboarding Contabil/onboarding.js"
git commit -m "refactor(contabil): renomeia Onboarding para sub-ferramenta do hub"
```

---

### Task 3: Hub `index.html`

**Files:**
- Create: `index.html` (new content, this becomes the hub)

**Interfaces:**
- Links to `onboarding.html` and `mapeamento.html` (created in later tasks — file
  paths are fixed now so this task is self-contained even before they exist).

- [ ] **Step 1: Write the hub page**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Departamento Contábil — Scont</title>
  <link rel="icon" type="image/x-icon" href="../assets/favicon.ico" />
  <link rel="stylesheet" href="styles.css" />
  <script src="../supabase-config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../portal-auth-guard.js"></script>
</head>
<body>
<div id="authOverlay" style="position:fixed;inset:0;background:#F0F2F5;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
  <div style="font-size:40px;">🔐</div>
  <p style="font-family:sans-serif;color:#8B3A3A;font-weight:600;font-size:15px;">Verificando acesso...</p>
</div>

<div class="hub-container">
  <div class="hub-header">
    <div class="brand-mark">🧾</div>
    <h1>Central do Departamento Contábil</h1>
    <p>Escolha uma ferramenta para continuar.</p>
  </div>

  <div class="hub-cards">
    <a class="hub-card" href="onboarding.html">
      <div class="hub-card-icon">📋</div>
      <h2>Onboarding</h2>
      <p>Levantamento e checklist de documentos para empresas novas.</p>
    </a>
    <a class="hub-card" href="mapeamento.html">
      <div class="hub-card-icon">🗺️</div>
      <h2>Mapeamento Estratégico</h2>
      <p>Perfil operacional, fiscal e de risco de cada empresa da carteira.</p>
    </a>
  </div>

  <button class="btn-voltar-portal" onclick="window.location.href='../portal.html'">
    🏠 Voltar ao Portal
  </button>
</div>

<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();
  });
</script>
</body>
</html>
```

- [ ] **Step 2: Manual check** — open the portal, click the "Departamento Contábil"
  card, confirm the hub loads (after auth), both cards are visible and navigate
  correctly (the Mapeamento card will 404 until Task 5 — that's expected at this
  point).

- [ ] **Step 3: Commit**

```bash
git add "Projeto Onboarding Contabil/index.html"
git commit -m "feat(contabil): cria hub da Central do Departamento Contabil"
```

---

### Task 4: Hub + Mapeamento shared CSS

**Files:**
- Modify: `styles.css` (append new rules; do not touch existing onboarding rules)

**Interfaces:**
- Produces CSS classes consumed by Task 3 (`hub-*`) and Tasks 5-9
  (`mapa-*` — dashboard cards, badges, tags input, accordion, pendências list).

- [ ] **Step 1: Append hub styles**

```css
/* ─── HUB (Central do Departamento Contábil) ─────────────── */
.hub-container { max-width: 720px; margin: 0 auto; padding: 64px 24px; text-align: center; }
.hub-header .brand-mark { font-size: 48px; }
.hub-header h1 { font-size: 24px; margin: 8px 0 4px; color: #333; }
.hub-header p { color: #777; margin-bottom: 32px; }
.hub-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
.hub-card { display: block; padding: 28px 20px; border: 1px solid #E4E4E7; border-radius: 12px; text-decoration: none; color: inherit; background: #fff; transition: box-shadow .15s, transform .15s; }
.hub-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); transform: translateY(-2px); }
.hub-card-icon { font-size: 32px; margin-bottom: 8px; }
.hub-card h2 { font-size: 17px; margin: 0 0 6px; color: #8B3A3A; }
.hub-card p { font-size: 13px; color: #777; margin: 0; }
.btn-voltar-portal { margin-top: 40px; background: none; border: 1px solid #E4E4E7; border-radius: 8px; padding: 10px 18px; cursor: pointer; color: #555; }

/* ─── MAPEAMENTO ESTRATÉGICO ──────────────────────────────── */
.mapa-dashboard-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.mapa-count-card { border-radius: 10px; padding: 16px; cursor: pointer; border: 2px solid transparent; text-align: center; }
.mapa-count-card.active { border-color: currentColor; }
.mapa-count-card .num { font-size: 26px; font-weight: 700; }
.mapa-count-card .label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.mapa-count-card.nivel-baixo   { background: #E8F5E9; color: #2E7D32; }
.mapa-count-card.nivel-medio   { background: #FFF8E1; color: #F9A825; }
.mapa-count-card.nivel-alto    { background: #FFF3E0; color: #EF6C00; }
.mapa-count-card.nivel-critico { background: #FFEBEE; color: #C62828; }

.badge-nivel { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.badge-nivel.nivel-baixo   { background: #E8F5E9; color: #2E7D32; }
.badge-nivel.nivel-medio   { background: #FFF8E1; color: #F9A825; }
.badge-nivel.nivel-alto    { background: #FFF3E0; color: #EF6C00; }
.badge-nivel.nivel-critico { background: #FFEBEE; color: #C62828; }

.mapa-table { width: 100%; border-collapse: collapse; }
.mapa-table th, .mapa-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #EEE; font-size: 13px; }
.mapa-table tbody tr { cursor: pointer; }
.mapa-table tbody tr:hover { background: #FAFAFA; }

.mapa-filtros { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.mapa-filtros select, .mapa-filtros input { padding: 6px 10px; border: 1px solid #DDD; border-radius: 6px; font-size: 13px; }

.mapa-secao { border: 1px solid #EEE; border-radius: 10px; margin-bottom: 14px; overflow: hidden; }
.mapa-secao-header { background: #FAFAFA; padding: 10px 16px; font-weight: 600; font-size: 13px; color: #8B3A3A; }
.mapa-secao-body { padding: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.mapa-secao-body .full { grid-column: 1 / -1; }
.mapa-secao-body label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
.mapa-secao-body input, .mapa-secao-body select, .mapa-secao-body textarea { width: 100%; padding: 7px 10px; border: 1px solid #DDD; border-radius: 6px; font-size: 13px; }

.mapa-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.mapa-tag { background: #F0F2F5; border-radius: 999px; padding: 3px 10px; font-size: 12px; display: flex; align-items: center; gap: 6px; }
.mapa-tag button { border: none; background: none; cursor: pointer; color: #999; }

.mapa-pendencia-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; }
.mapa-pendencia-item.vencida { color: #C62828; }
.mapa-pendencia-item .desc { flex: 1; }
.mapa-pendencia-item.resolvida { text-decoration: line-through; color: #999; }
```

- [ ] **Step 2: Manual check** — open `mapeamento.html` once Task 5+ land and
  confirm no unstyled/broken layout (revisit after Task 9).

- [ ] **Step 3: Commit**

```bash
git add "Projeto Onboarding Contabil/styles.css"
git commit -m "style(contabil): estilos do hub e do Mapeamento Estrategico"
```

---

### Task 5: `mapeamento-nivel-atencao.js` (pure calculator) + unit tests

**Files:**
- Create: `mapeamento-nivel-atencao.js`
- Create: `test-mapeamento-nivel-atencao.js`

**Interfaces:**
- Produces: `calcularNivelSugerido(mapeamento, pendencias, hoje)` where
  `mapeamento = { periodicidade, ultimo_mes_fechado, situacao_2025_status, situacao_2026_status }`,
  `pendencias = [{ status, prazo }, ...]`, `hoje = Date`. Returns
  `'baixo' | 'medio' | 'alto' | 'critico'`.
- Dual export: `window.calcularNivelSugerido` in browser, `module.exports` in Node
  (same pattern as `Projeto RH/ferias-parser.js`).

- [ ] **Step 1: Write the failing tests**

```js
// test-mapeamento-nivel-atencao.js
const assert = require('assert');
const { calcularNivelSugerido } = require('./mapeamento-nivel-atencao.js');

function caso(nome, mapeamento, pendencias, hoje, esperado) {
  const resultado = calcularNivelSugerido(mapeamento, pendencias, hoje);
  assert.strictEqual(resultado, esperado, `${nome}: esperado "${esperado}", recebido "${resultado}"`);
  console.log(`OK: ${nome}`);
}

const HOJE = new Date('2026-07-31');

caso(
  'sem atraso, sem pendencia, sem situacao critica -> baixo',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'baixo'
);

caso(
  'situacao 2026 critica -> critico, independente do resto',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'critico' },
  [],
  HOJE,
  'critico'
);

caso(
  'mensal com 3 meses de atraso -> critico',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-03-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'critico'
);

caso(
  'mensal com 2 meses de atraso -> alto',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-04-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'alto'
);

caso(
  'mensal com 1 pendencia vencida -> medio',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [{ status: 'aberta', prazo: '2026-07-01' }],
  HOJE,
  'medio'
);

caso(
  '2 pendencias vencidas -> alto',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [{ status: 'aberta', prazo: '2026-07-01' }, { status: 'aberta', prazo: '2026-07-10' }],
  HOJE,
  'alto'
);

caso(
  'pendencia vencida mas ja resolvida nao conta',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [{ status: 'resolvida', prazo: '2026-01-01' }],
  HOJE,
  'baixo'
);

caso(
  'trimestral, 1 trimestre de atraso -> medio (nao alto, pois trimestral tolera mais)',
  { periodicidade: 'trimestral', ultimo_mes_fechado: '2026-04-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'medio'
);

console.log('Todos os testes passaram.');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node "Projeto Onboarding Contabil/test-mapeamento-nivel-atencao.js"`
Expected: `Cannot find module './mapeamento-nivel-atencao.js'`

- [ ] **Step 3: Implement the calculator**

```js
// mapeamento-nivel-atencao.js
(function (root) {
  'use strict';

  function mesesEntre(dataA, dataB) {
    return (dataB.getFullYear() - dataA.getFullYear()) * 12 + (dataB.getMonth() - dataA.getMonth());
  }

  function atrasoEmUnidades(ultimoMesFechado, periodicidade, hoje) {
    if (!ultimoMesFechado) return 99;
    const fechado = new Date(ultimoMesFechado);
    const meses = mesesEntre(fechado, hoje);
    if (periodicidade === 'trimestral') return Math.floor(meses / 3);
    if (periodicidade === 'anual') return Math.floor(meses / 12);
    return meses; // mensal (default)
  }

  function calcularNivelSugerido(mapeamento, pendencias, hoje) {
    hoje = hoje || new Date();
    mapeamento = mapeamento || {};
    pendencias = pendencias || [];

    const situacaoCritica = mapeamento.situacao_2025_status === 'critico' || mapeamento.situacao_2026_status === 'critico';
    if (situacaoCritica) return 'critico';

    const atraso = atrasoEmUnidades(mapeamento.ultimo_mes_fechado, mapeamento.periodicidade, hoje);
    const pendenciasVencidas = pendencias.filter((p) => p.status === 'aberta' && p.prazo && new Date(p.prazo) < hoje).length;

    if (atraso >= 3 || pendenciasVencidas >= 3) return 'critico';
    if (atraso === 2 || pendenciasVencidas === 2) return 'alto';
    if (atraso === 1 || pendenciasVencidas === 1) return 'medio';
    return 'baixo';
  }

  const api = { calcularNivelSugerido };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.calcularNivelSugerido = calcularNivelSugerido;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node "Projeto Onboarding Contabil/test-mapeamento-nivel-atencao.js"`
Expected: `Todos os testes passaram.`

- [ ] **Step 5: Commit**

```bash
git add "Projeto Onboarding Contabil/mapeamento-nivel-atencao.js" "Projeto Onboarding Contabil/test-mapeamento-nivel-atencao.js"
git commit -m "feat(contabil): calculadora de nivel de atencao sugerido, com testes"
```

---

### Task 6: `mapeamento.html` shell + data loading + dashboard

**Files:**
- Create: `mapeamento.html`
- Create: `mapeamento.js`

**Interfaces:**
- Consumes: `window.calcularNivelSugerido` (Task 5), `window.PortalAuthGuard`,
  Supabase client, tables from Task 1.
- Produces (used by Tasks 7-9, same file `mapeamento.js`): module-level state
  `empresas`, `mapeamentos`, `mapeamentoAtual`; functions `carregarDados()`,
  `renderDashboard()`, `selecionarEmpresa(codigoEmpresa)`, `renderPerfil()`.

- [ ] **Step 1: Write `mapeamento.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mapeamento Estratégico — Scont</title>
  <link rel="icon" type="image/x-icon" href="../assets/favicon.ico" />
  <link rel="stylesheet" href="styles.css" />
  <script src="../supabase-config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../portal-auth-guard.js"></script>
</head>
<body>
<div id="authOverlay" style="position:fixed;inset:0;background:#F0F2F5;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
  <div style="font-size:40px;">🔐</div>
  <p style="font-family:sans-serif;color:#8B3A3A;font-weight:600;font-size:15px;">Verificando acesso...</p>
</div>

<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">🗺️</div>
      <div>
        <h1>SCONT</h1>
        <p>Mapeamento Estratégico</p>
      </div>
    </div>

    <button class="btn-novo" id="btnDashboard">📊 Visão Geral</button>
    <input type="text" class="busca-onboarding" id="buscaEmpresa" placeholder="Buscar empresa..." />
    <div class="nav-tree" id="listaEmpresas">
      <p class="nav-loading">Carregando...</p>
    </div>

    <div class="sidebar-footer">
      <button class="btn-voltar" onclick="window.location.href='index.html'">
        🏠 <span>Central Contábil</span>
      </button>
    </div>
  </aside>

  <main class="main" id="main">
    <div class="empty-state">
      <div class="emoji">🗺️</div>
      <h2>Mapeamento Estratégico</h2>
      <p>Selecione uma empresa na lista ao lado, ou veja a Visão Geral da carteira.</p>
    </div>
  </main>
</div>

<script src="mapeamento-nivel-atencao.js"></script>
<script src="mapeamento.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `mapeamento.js` — bootstrap, data loading, dashboard**

```js
(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const NIVEIS = ['baixo', 'medio', 'alto', 'critico'];
  const NIVEL_LABELS = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico' };
  const REGIME_LABELS = { simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI' };

  let empresas = [];          // [{ codigo_empresa, nome_empresa }]
  let mapeamentos = [];       // linhas de contabil_mapeamento (join com pendências resumidas)
  let pendenciasPorMapeamento = {}; // { mapeamento_id: [pendencias] }
  let mapeamentoAtualId = null;
  let filtro = { nivel: null, regime: '', financeiro: '', termo: '' };

  document.addEventListener('DOMContentLoaded', iniciar);

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();

    document.getElementById('btnDashboard').addEventListener('click', () => { mapeamentoAtualId = null; renderDashboard(); renderListaEmpresas(); });
    document.getElementById('buscaEmpresa').addEventListener('input', renderListaEmpresas);

    await carregarDados();
    renderDashboard();
    renderListaEmpresas();
  }

  async function carregarDados() {
    const [{ data: dataEmpresas, error: errEmpresas }, { data: dataMapeamentos, error: errMapeamentos }] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_mapeamento').select('*'),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errMapeamentos) console.error(errMapeamentos);

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao));
    mapeamentos = dataMapeamentos || [];

    const ids = mapeamentos.map((m) => m.id);
    pendenciasPorMapeamento = {};
    if (ids.length) {
      const { data: pendencias, error: errPend } = await supabaseClient
        .from('contabil_mapeamento_pendencias')
        .select('*')
        .in('mapeamento_id', ids);
      if (errPend) console.error(errPend);
      (pendencias || []).forEach((p) => {
        (pendenciasPorMapeamento[p.mapeamento_id] = pendenciasPorMapeamento[p.mapeamento_id] || []).push(p);
      });
    }
  }

  function mapeamentoDe(codigoEmpresa) {
    return mapeamentos.find((m) => m.codigo_empresa === codigoEmpresa) || null;
  }

  function nivelDe(codigoEmpresa) {
    const m = mapeamentoDe(codigoEmpresa);
    return m ? (m.nivel_atencao || 'baixo') : 'baixo';
  }

  function pendenciasAbertasDe(mapeamentoId) {
    return (pendenciasPorMapeamento[mapeamentoId] || []).filter((p) => p.status === 'aberta');
  }

  // ─── DASHBOARD ──────────────────────────────────────────────

  function empresasFiltradas() {
    return empresas.filter((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      if (filtro.nivel && nivelDe(e.codigo_empresa) !== filtro.nivel) return false;
      if (filtro.regime && (!m || m.regime_tributario !== filtro.regime)) return false;
      if (filtro.financeiro && (!m || m.financeiro_interno_bpo !== filtro.financeiro)) return false;
      if (filtro.termo && !e.nome_empresa.toLowerCase().includes(filtro.termo)) return false;
      return true;
    });
  }

  function renderDashboard() {
    const main = document.getElementById('main');
    const contagens = { baixo: 0, medio: 0, alto: 0, critico: 0 };
    empresas.forEach((e) => { contagens[nivelDe(e.codigo_empresa)]++; });

    const cardsHtml = NIVEIS.map((n) => `
      <div class="mapa-count-card nivel-${n} ${filtro.nivel === n ? 'active' : ''}" data-nivel="${n}">
        <div class="num">${contagens[n]}</div>
        <div class="label">${NIVEL_LABELS[n]}</div>
      </div>
    `).join('');

    const linhas = empresasFiltradas().map((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      const nivel = nivelDe(e.codigo_empresa);
      const abertas = m ? pendenciasAbertasDe(m.id).length : 0;
      return `
        <tr data-codigo="${escapeHtml(e.codigo_empresa)}">
          <td>${escapeHtml(e.nome_empresa)}</td>
          <td>${m && m.regime_tributario ? REGIME_LABELS[m.regime_tributario] || m.regime_tributario : '—'}</td>
          <td>${m && m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</td>
          <td>${m && m.ultimo_mes_fechado ? formatarMesAno(m.ultimo_mes_fechado) : '—'}</td>
          <td><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></td>
          <td>${abertas}</td>
        </tr>
      `;
    }).join('');

    main.innerHTML = `
      <div class="mapa-dashboard-cards">${cardsHtml}</div>
      <div class="mapa-filtros">
        <select id="filtroRegime">
          <option value="">Todos os regimes</option>
          ${Object.entries(REGIME_LABELS).map(([v, l]) => `<option value="${v}" ${filtro.regime === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <select id="filtroFinanceiro">
          <option value="">Financeiro (todos)</option>
          <option value="interno" ${filtro.financeiro === 'interno' ? 'selected' : ''}>Interno</option>
          <option value="bpo_scont" ${filtro.financeiro === 'bpo_scont' ? 'selected' : ''}>BPO Scont</option>
          <option value="bpo_terceiro" ${filtro.financeiro === 'bpo_terceiro' ? 'selected' : ''}>BPO Terceiro</option>
          <option value="nao_possui" ${filtro.financeiro === 'nao_possui' ? 'selected' : ''}>Não possui</option>
        </select>
      </div>
      <table class="mapa-table">
        <thead><tr><th>Empresa</th><th>Regime</th><th>Responsável</th><th>Último mês fechado</th><th>Nível</th><th>Pendências</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6">Nenhuma empresa encontrada.</td></tr>'}</tbody>
      </table>
    `;

    main.querySelectorAll('.mapa-count-card').forEach((card) => {
      card.addEventListener('click', () => {
        const n = card.getAttribute('data-nivel');
        filtro.nivel = filtro.nivel === n ? null : n;
        renderDashboard();
      });
    });
    document.getElementById('filtroRegime').addEventListener('change', (ev) => { filtro.regime = ev.target.value; renderDashboard(); });
    document.getElementById('filtroFinanceiro').addEventListener('change', (ev) => { filtro.financeiro = ev.target.value; renderDashboard(); });
    main.querySelectorAll('tbody tr[data-codigo]').forEach((tr) => {
      tr.addEventListener('click', () => selecionarEmpresa(tr.getAttribute('data-codigo')));
    });
  }

  function formatarMesAno(dataStr) {
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // ─── SIDEBAR: LISTA DE EMPRESAS ─────────────────────────────

  function renderListaEmpresas() {
    const nav = document.getElementById('listaEmpresas');
    const termo = (document.getElementById('buscaEmpresa').value || '').toLowerCase().trim();
    filtro.termo = termo;

    const filtradas = termo ? empresas.filter((e) => e.nome_empresa.toLowerCase().includes(termo)) : empresas;
    if (!filtradas.length) { nav.innerHTML = '<p class="nav-empty">Nenhuma empresa encontrada.</p>'; return; }

    nav.innerHTML = '';
    filtradas.forEach((e) => {
      const nivel = nivelDe(e.codigo_empresa);
      const btn = document.createElement('button');
      btn.className = 'nav-onboarding-btn' + (e.codigo_empresa === mapeamentoAtualId ? ' active' : '');
      btn.innerHTML = `<span class="nav-onboarding-empresa">${escapeHtml(e.nome_empresa)}</span><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span>`;
      btn.addEventListener('click', () => selecionarEmpresa(e.codigo_empresa));
      nav.appendChild(btn);
    });
  }

  window.__mapeamentoInternals = { carregarDados, renderDashboard, renderListaEmpresas, empresasFiltradas };
})();
```

- [ ] **Step 3: Manual check** — open `mapeamento.html` through the hub, confirm
  the dashboard renders with the 4 count cards and the empresa table (will show
  every active empresa from `rh_empresas` with "—" placeholders since no
  `contabil_mapeamento` rows exist yet), and the sidebar list renders with search.

- [ ] **Step 4: Commit**

```bash
git add "Projeto Onboarding Contabil/mapeamento.html" "Projeto Onboarding Contabil/mapeamento.js"
git commit -m "feat(contabil): shell do Mapeamento Estrategico com dashboard e lista"
```

---

### Task 7: Perfil da empresa — formulário principal (seções 1-4)

**Files:**
- Modify: `mapeamento.js` (add `selecionarEmpresa`, `renderPerfil`, `salvarCampo`)

**Interfaces:**
- Consumes: state from Task 6 (`empresas`, `mapeamentos`, `mapeamentoDe`).
- Produces: `selecionarEmpresa(codigoEmpresa)` (used by Task 6's click handlers,
  already wired), `mapeamentoAtual` module state consumed by Tasks 8-9.

- [ ] **Step 1: Add to `mapeamento.js`** (append before the final
  `window.__mapeamentoInternals` line, and add `let mapeamentoAtual = null;` next to
  the other `let` declarations at the top)

```js
  const BANCOS_SUGERIDOS = ['Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa', 'Santander', 'Sicoob', 'Sicredi', 'Inter', 'Nubank'];
  const SISTEMAS_SUGERIDOS = ['Domínio', 'Alterdata', 'Bling', 'Omie', 'Contmatic', 'SAP', 'Totvs'];
  const ENTREGAVEIS_SUGERIDOS = ['Balancete', 'DRE', 'Folha de Pagamento', 'Guias de Impostos', 'Relatório Gerencial'];
  const OBRIGACOES_SUGERIDAS = ['SPED Fiscal', 'SPED Contribuições', 'ECD', 'ECF', 'DCTF', 'DCTFWeb', 'EFD-Reinf', 'DAS', 'DEFIS', 'DIRF'];

  async function selecionarEmpresa(codigoEmpresa) {
    mapeamentoAtualId = codigoEmpresa;
    let m = mapeamentoDe(codigoEmpresa);
    if (!m) {
      const { data, error } = await supabaseClient
        .from('contabil_mapeamento')
        .insert({ codigo_empresa: codigoEmpresa })
        .select()
        .single();
      if (error) { console.error(error); return; }
      m = data;
      mapeamentos.push(m);
    }
    mapeamentoAtual = m;
    renderListaEmpresas();
    renderPerfil();
  }

  function empresaNome(codigoEmpresa) {
    const e = empresas.find((x) => x.codigo_empresa === codigoEmpresa);
    return e ? e.nome_empresa : codigoEmpresa;
  }

  function renderPerfil() {
    const main = document.getElementById('main');
    const m = mapeamentoAtual;

    main.innerHTML = `
      <div class="onboarding-header"><div><h2>${escapeHtml(empresaNome(m.codigo_empresa))}</h2></div></div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Execução</div>
        <div class="mapa-secao-body">
          <div><label>Periodicidade</label>
            <select data-campo="periodicidade">
              <option value="">Selecione...</option>
              <option value="mensal" ${m.periodicidade === 'mensal' ? 'selected' : ''}>Mensal</option>
              <option value="trimestral" ${m.periodicidade === 'trimestral' ? 'selected' : ''}>Trimestral</option>
              <option value="anual" ${m.periodicidade === 'anual' ? 'selected' : ''}>Anual</option>
            </select>
          </div>
          <div><label>Regime Tributário</label>
            <select data-campo="regime_tributario">
              <option value="">Selecione...</option>
              ${Object.entries(REGIME_LABELS).map(([v, l]) => `<option value="${v}" ${m.regime_tributario === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div><label>Responsável pela Execução</label><input type="text" data-campo="responsavel_execucao" value="${escapeHtml(m.responsavel_execucao || '')}"></div>
          <div><label>Último Mês Fechado</label><input type="month" data-campo="ultimo_mes_fechado" value="${m.ultimo_mes_fechado ? String(m.ultimo_mes_fechado).slice(0, 7) : ''}"></div>
          <div><label>Contato — Nome</label><input type="text" data-campo="contato_nome" value="${escapeHtml(m.contato_nome || '')}"></div>
          <div><label>Contato — Telefone</label><input type="text" data-campo="contato_telefone" value="${escapeHtml(m.contato_telefone || '')}"></div>
          <div><label>Contato — E-mail</label><input type="email" data-campo="contato_email" value="${escapeHtml(m.contato_email || '')}"></div>
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Situação de Fechamento</div>
        <div class="mapa-secao-body">
          ${renderSituacaoAno('2025', m)}
          ${renderSituacaoAno('2026', m)}
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Operação / Financeiro</div>
        <div class="mapa-secao-body">
          <div><label>Financeiro Interno ou BPO</label>
            <select data-campo="financeiro_interno_bpo">
              <option value="">Selecione...</option>
              <option value="interno" ${m.financeiro_interno_bpo === 'interno' ? 'selected' : ''}>Interno</option>
              <option value="bpo_scont" ${m.financeiro_interno_bpo === 'bpo_scont' ? 'selected' : ''}>BPO Scont</option>
              <option value="bpo_terceiro" ${m.financeiro_interno_bpo === 'bpo_terceiro' ? 'selected' : ''}>BPO Terceiro</option>
              <option value="nao_possui" ${m.financeiro_interno_bpo === 'nao_possui' ? 'selected' : ''}>Não possui</option>
            </select>
          </div>
          <div><label class="full" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" data-campo="acesso_bancario_leitura" ${m.acesso_bancario_leitura ? 'checked' : ''}> Possui acesso bancário de leitura</label></div>
          <div class="full">${renderTagsInput('forma_envio_documentos', 'Forma de Envio dos Documentos', m.forma_envio_documentos, [])}</div>
          <div class="full">${renderTagsInput('bancos_utilizados', 'Bancos Utilizados', m.bancos_utilizados, BANCOS_SUGERIDOS)}</div>
          <div class="full">${renderTagsInput('sistemas_utilizados', 'Sistemas Utilizados', m.sistemas_utilizados, SISTEMAS_SUGERIDOS)}</div>
        </div>
      </div>

      <div class="mapa-secao">
        <div class="mapa-secao-header">Entregáveis & Particularidades</div>
        <div class="mapa-secao-body">
          <div class="full">${renderTagsInput('entregaveis_esperados', 'Entregáveis Esperados', m.entregaveis_esperados, ENTREGAVEIS_SUGERIDOS)}</div>
          <div class="full">${renderTagsInput('obrigacoes_acessorias', 'Obrigações Acessórias', m.obrigacoes_acessorias, OBRIGACOES_SUGERIDAS)}</div>
          <div class="full"><label>Particularidades Contábeis</label><textarea data-campo="particularidades_contabeis" rows="3">${escapeHtml(m.particularidades_contabeis || '')}</textarea></div>
          <div class="full"><label>Particularidades Fiscais</label><textarea data-campo="particularidades_fiscais" rows="3">${escapeHtml(m.particularidades_fiscais || '')}</textarea></div>
          <div class="full"><label>Particularidades Societárias</label><textarea data-campo="particularidades_societarias" rows="3">${escapeHtml(m.particularidades_societarias || '')}</textarea></div>
        </div>
      </div>

      <div id="secaoNivelAtencao"></div>
      <div id="secaoPendencias"></div>
      <div id="secaoRelacionadas"></div>
    `;

    main.querySelectorAll('[data-campo]').forEach((el) => {
      const evento = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'blur';
      el.addEventListener(evento, () => salvarCampo(el));
    });

    renderNivelAtencao();
    renderPendencias();
    renderRelacionadas();
  }

  function renderSituacaoAno(ano, m) {
    const status = m[`situacao_${ano}_status`];
    const obs = m[`situacao_${ano}_obs`];
    const opcoes = [
      ['regularizado', 'Regularizado'], ['em_regularizacao', 'Em Regularização'],
      ['pendente', 'Pendente'], ['critico', 'Crítico'],
    ];
    return `
      <div><label>Situação de ${ano}</label>
        <select data-campo="situacao_${ano}_status">
          <option value="">Selecione...</option>
          ${opcoes.map(([v, l]) => `<option value="${v}" ${status === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div><label>Observação ${ano}</label><input type="text" data-campo="situacao_${ano}_obs" value="${escapeHtml(obs || '')}"></div>
    `;
  }

  function renderTagsInput(campo, label, valores, sugestoes) {
    valores = valores || [];
    const tagsHtml = valores.map((v) => `<span class="mapa-tag">${escapeHtml(v)}<button type="button" data-remover-tag="${campo}" data-valor="${escapeHtml(v)}">×</button></span>`).join('');
    const datalistId = `dl_${campo}`;
    return `
      <label>${label}</label>
      <div class="mapa-tags" data-tags-container="${campo}">${tagsHtml}</div>
      <input type="text" list="${datalistId}" placeholder="Adicionar e pressionar Enter" data-tag-input="${campo}">
      <datalist id="${datalistId}">${sugestoes.map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist>
    `;
  }

  async function salvarCampo(el) {
    const campo = el.getAttribute('data-campo');
    let valor = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'month' && valor) valor = `${valor}-01`;
    if (el.tagName !== 'SELECT' && el.type !== 'checkbox' && el.type !== 'month' && valor === '') valor = null;

    mapeamentoAtual[campo] = valor;
    const { error } = await supabaseClient.from('contabil_mapeamento').update({ [campo]: valor }).eq('id', mapeamentoAtual.id);
    if (error) console.error(error);
    if (campo.startsWith('situacao_') || campo === 'ultimo_mes_fechado' || campo === 'periodicidade') {
      atualizarSugestaoNivel();
    }
  }

  async function salvarTags(campo, novaLista) {
    mapeamentoAtual[campo] = novaLista;
    const { error } = await supabaseClient.from('contabil_mapeamento').update({ [campo]: novaLista }).eq('id', mapeamentoAtual.id);
    if (error) console.error(error);
  }
```

- [ ] **Step 2: Wire tag-input events** — append inside `renderPerfil()`, right
  after the `main.querySelectorAll('[data-campo]')` block added in Step 1:

```js
    main.querySelectorAll('[data-tag-input]').forEach((input) => {
      input.addEventListener('keydown', async (ev) => {
        if (ev.key !== 'Enter' || !input.value.trim()) return;
        ev.preventDefault();
        const campo = input.getAttribute('data-tag-input');
        const novoValor = input.value.trim();
        const atual = mapeamentoAtual[campo] || [];
        if (!atual.includes(novoValor)) {
          await salvarTags(campo, [...atual, novoValor]);
          renderPerfil();
        }
        input.value = '';
      });
    });
    main.querySelectorAll('[data-remover-tag]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const campo = btn.getAttribute('data-remover-tag');
        const valor = btn.getAttribute('data-valor');
        const atual = (mapeamentoAtual[campo] || []).filter((v) => v !== valor);
        await salvarTags(campo, atual);
        renderPerfil();
      });
    });
```

- [ ] **Step 3: Manual check** — click an empresa in the sidebar, confirm the
  profile form renders with all four sections, edit a text field and tab away
  (blur), reload the page and confirm the value persisted. Add a tag to "Bancos
  Utilizados", confirm it appears as a removable pill and persists on reload.

- [ ] **Step 4: Commit**

```bash
git add "Projeto Onboarding Contabil/mapeamento.js"
git commit -m "feat(contabil): formulario de perfil do Mapeamento Estrategico (secoes 1-4)"
```

---

### Task 8: Nível de Atenção (seção 5) + sugestão automática

**Files:**
- Modify: `mapeamento.js` (add `renderNivelAtencao`, `atualizarSugestaoNivel`)

**Interfaces:**
- Consumes: `window.calcularNivelSugerido` (Task 5), `mapeamentoAtual`,
  `pendenciasPorMapeamento` (Task 6/9).
- Produces: `atualizarSugestaoNivel()` (also called from Task 9 when pendências
  change).

- [ ] **Step 1: Add to `mapeamento.js`**

```js
  function renderNivelAtencao() {
    const el = document.getElementById('secaoNivelAtencao');
    const m = mapeamentoAtual;
    const pendencias = pendenciasPorMapeamento[m.id] || [];
    const sugestao = window.calcularNivelSugerido(m, pendencias, new Date());

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Nível de Atenção</div>
        <div class="mapa-secao-body">
          <div><label>Nível Atual</label>
            <select data-campo="nivel_atencao" data-manual-nivel="1">
              ${NIVEIS.map((n) => `<option value="${n}" ${m.nivel_atencao === n ? 'selected' : ''}>${NIVEL_LABELS[n]}</option>`).join('')}
            </select>
          </div>
          <div><label>Sugestão do Sistema</label><span class="badge-nivel nivel-${sugestao}">Sugestão: ${NIVEL_LABELS[sugestao]}</span></div>
        </div>
      </div>
    `;

    el.querySelector('[data-manual-nivel]').addEventListener('change', async (ev) => {
      const novoNivel = ev.target.value;
      const travado = novoNivel !== sugestao;
      mapeamentoAtual.nivel_atencao = novoNivel;
      mapeamentoAtual.nivel_atencao_travado = travado;
      const { error } = await supabaseClient.from('contabil_mapeamento').update({ nivel_atencao: novoNivel, nivel_atencao_travado: travado }).eq('id', mapeamentoAtual.id);
      if (error) console.error(error);
      renderListaEmpresas();
    });
  }

  function atualizarSugestaoNivel() {
    if (!mapeamentoAtual || mapeamentoAtual.nivel_atencao_travado) { renderNivelAtencao(); return; }
    const pendencias = pendenciasPorMapeamento[mapeamentoAtual.id] || [];
    const sugestao = window.calcularNivelSugerido(mapeamentoAtual, pendencias, new Date());
    if (sugestao !== mapeamentoAtual.nivel_atencao) {
      mapeamentoAtual.nivel_atencao = sugestao;
      supabaseClient.from('contabil_mapeamento').update({ nivel_atencao: sugestao }).eq('id', mapeamentoAtual.id).then(({ error }) => { if (error) console.error(error); });
    }
    renderNivelAtencao();
    renderListaEmpresas();
  }
```

- [ ] **Step 2: Manual check** — open a profile with no data, confirm level shows
  "Baixo" with matching suggestion. Set "Último Mês Fechado" to 4 months ago,
  confirm the suggestion badge updates to "Alto"/"Crítico" and (since not manually
  overridden yet) the "Nível Atual" selector follows it. Manually change "Nível
  Atual" to a different value, confirm it stays fixed even after changing other
  fields (travado).

- [ ] **Step 3: Commit**

```bash
git add "Projeto Onboarding Contabil/mapeamento.js"
git commit -m "feat(contabil): nivel de atencao manual com sugestao automatica"
```

---

### Task 9: Pendências (seção 6) + Empresas Relacionadas (seção 7)

**Files:**
- Modify: `mapeamento.js` (add `renderPendencias`, `renderRelacionadas`)

**Interfaces:**
- Consumes: `contabil_mapeamento_pendencias`, `contabil_mapeamento_relacionadas`
  tables (Task 1); calls `atualizarSugestaoNivel()` (Task 8) after pendência
  changes.

- [ ] **Step 1: Add to `mapeamento.js`**

```js
  function renderPendencias() {
    const el = document.getElementById('secaoPendencias');
    const m = mapeamentoAtual;
    const pendencias = (pendenciasPorMapeamento[m.id] || []).slice().sort((a, b) => (a.status === b.status ? 0 : a.status === 'aberta' ? -1 : 1));
    const hoje = new Date();

    const itensHtml = pendencias.map((p) => {
      const vencida = p.status === 'aberta' && p.prazo && new Date(p.prazo) < hoje;
      return `
        <div class="mapa-pendencia-item ${vencida ? 'vencida' : ''} ${p.status === 'resolvida' ? 'resolvida' : ''}">
          <span class="desc">${escapeHtml(p.descricao)} ${p.responsavel ? `— <em>${escapeHtml(p.responsavel)}</em>` : ''} ${p.prazo ? `(prazo: ${new Date(p.prazo).toLocaleDateString('pt-BR')})` : ''}</span>
          ${p.status === 'aberta' ? `<button type="button" data-resolver="${p.id}">Resolver</button>` : ''}
        </div>
      `;
    }).join('') || '<p class="nav-empty">Nenhuma pendência registrada.</p>';

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Pendências</div>
        <div class="mapa-secao-body">
          <div class="full">${itensHtml}</div>
          <div><label>Descrição</label><input type="text" id="novaPendenciaDesc"></div>
          <div><label>Responsável</label><input type="text" id="novaPendenciaResp"></div>
          <div><label>Prazo</label><input type="date" id="novaPendenciaPrazo"></div>
          <div style="align-self:end;"><button type="button" id="btnAddPendencia" class="btn-novo">+ Adicionar Pendência</button></div>
        </div>
      </div>
    `;

    el.querySelectorAll('[data-resolver]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-resolver');
        const { error } = await supabaseClient.from('contabil_mapeamento_pendencias').update({ status: 'resolvida', resolvido_em: new Date().toISOString() }).eq('id', id);
        if (error) { console.error(error); return; }
        const item = (pendenciasPorMapeamento[m.id] || []).find((p) => p.id === id);
        if (item) { item.status = 'resolvida'; item.resolvido_em = new Date().toISOString(); }
        atualizarSugestaoNivel();
        renderPendencias();
      });
    });

    el.querySelector('#btnAddPendencia').addEventListener('click', async () => {
      const descricao = document.getElementById('novaPendenciaDesc').value.trim();
      if (!descricao) return;
      const responsavel = document.getElementById('novaPendenciaResp').value.trim() || null;
      const prazo = document.getElementById('novaPendenciaPrazo').value || null;
      const { data, error } = await supabaseClient
        .from('contabil_mapeamento_pendencias')
        .insert({ mapeamento_id: m.id, descricao, responsavel, prazo, status: 'aberta' })
        .select()
        .single();
      if (error) { console.error(error); return; }
      (pendenciasPorMapeamento[m.id] = pendenciasPorMapeamento[m.id] || []).push(data);
      atualizarSugestaoNivel();
      renderPendencias();
    });
  }

  let relacionadasPorEmpresa = {}; // cache simples { codigo_empresa: [codigo_empresa_relacionada, ...] }

  async function renderRelacionadas() {
    const el = document.getElementById('secaoRelacionadas');
    const m = mapeamentoAtual;

    const { data, error } = await supabaseClient
      .from('contabil_mapeamento_relacionadas')
      .select('codigo_empresa_relacionada')
      .eq('codigo_empresa', m.codigo_empresa);
    if (error) console.error(error);
    const relacionadas = (data || []).map((r) => r.codigo_empresa_relacionada);
    relacionadasPorEmpresa[m.codigo_empresa] = relacionadas;

    const opcoesDisponiveis = empresas.filter((e) => e.codigo_empresa !== m.codigo_empresa && !relacionadas.includes(e.codigo_empresa));

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Empresas Relacionadas</div>
        <div class="mapa-secao-body">
          <div class="full">
            ${relacionadas.length
              ? relacionadas.map((cod) => `<span class="mapa-tag">${escapeHtml(empresaNome(cod))}<button type="button" data-desvincular="${cod}">×</button></span>`).join('')
              : '<p class="nav-empty">Nenhuma empresa relacionada.</p>'}
          </div>
          <div class="full">
            <select id="selectRelacionada">
              <option value="">Vincular empresa...</option>
              ${opcoesDisponiveis.map((e) => `<option value="${e.codigo_empresa}">${escapeHtml(e.nome_empresa)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;

    el.querySelectorAll('[data-desvincular]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const codRelacionada = btn.getAttribute('data-desvincular');
        await supabaseClient.from('contabil_mapeamento_relacionadas').delete().eq('codigo_empresa', m.codigo_empresa).eq('codigo_empresa_relacionada', codRelacionada);
        await supabaseClient.from('contabil_mapeamento_relacionadas').delete().eq('codigo_empresa', codRelacionada).eq('codigo_empresa_relacionada', m.codigo_empresa);
        renderRelacionadas();
      });
    });

    el.querySelector('#selectRelacionada').addEventListener('change', async (ev) => {
      const codRelacionada = ev.target.value;
      if (!codRelacionada) return;
      await supabaseClient.from('contabil_mapeamento_relacionadas').insert([
        { codigo_empresa: m.codigo_empresa, codigo_empresa_relacionada: codRelacionada },
        { codigo_empresa: codRelacionada, codigo_empresa_relacionada: m.codigo_empresa },
      ]);
      renderRelacionadas();
    });
  }
```

- [ ] **Step 2: Manual check** — add a pendência with a past due date, confirm it
  shows in red ("vencida") and the nível de atenção suggestion reacts. Click
  "Resolver", confirm it moves to strikethrough and the suggestion recalculates.
  Vincular duas empresas relacionadas, confirmar que aparecem uma na outra
  (abrir o perfil da segunda e ver a primeira listada), e que desvincular remove
  dos dois lados.

- [ ] **Step 3: Commit**

```bash
git add "Projeto Onboarding Contabil/mapeamento.js"
git commit -m "feat(contabil): pendencias e empresas relacionadas no Mapeamento Estrategico"
```

---

### Task 10: End-to-end manual QA + push

**Files:** none (verification only)

- [ ] **Step 1: Full flow through the browser** (per project convention: verify
  UI changes live before declaring done)
  - Portal → click "Departamento Contábil" → hub loads with 2 cards.
  - Hub → "Onboarding" → existing onboarding flow works unchanged, back button
    returns to hub.
  - Hub → "Mapeamento Estratégico" → dashboard loads with counts and table.
  - Click an empresa → profile loads, fill out fields across all 7 sections,
    reload the page, confirm everything persisted.
  - Change filters/search on the dashboard, confirm results narrow correctly.

- [ ] **Step 2: Run the unit test one more time**

Run: `node "Projeto Onboarding Contabil/test-mapeamento-nivel-atencao.js"`
Expected: `Todos os testes passaram.`

- [ ] **Step 3: Push**

```bash
git push
```
