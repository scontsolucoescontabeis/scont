# Diário Contábil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "Diário Contábil" sub-ferramenta (dashboard + grade mensal +
lançamentos) and replace o campo de tags "Bancos Utilizados" do Mapeamento
Estratégico por uma tabela de acessos bancários.

**Architecture:** Vanilla JS + Supabase (sem framework/bundler), seguindo
exatamente o padrão já usado em `mapeamento.html`/`mapeamento.js` (auth guard,
sidebar com seletor de empresa, seções em cards, `data-campo`/`salvarCampo`
para salvar ao sair do campo). Lógica pura e testável isolada em módulos
`*.js` carregados via `<script>` global (padrão de
`mapeamento-nivel-atencao.js`), com testes `node`+`assert` (padrão de
`test-mapeamento-nivel-atencao.js` — sem framework de testes no projeto).

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS client v2, jsPDF + AutoTable
(relatório).

## Global Constraints

- Sem framework de build/bundler — arquivos carregados direto via `<script>`.
- Testes de lógica pura em Node puro (`assert`), sem framework — mesmo padrão
  de `test-mapeamento-nivel-atencao.js`.
- RLS de todas as tabelas novas: leitura/escrita restrita a `authenticated`,
  mesmo padrão de `_sql/schema_contabil_mapeamento.sql`.
- Nenhuma migração do histórico do Excel (2021–2026) — fora de escopo.
- Lançamentos do Diário são só-inclusão (sem UPDATE/DELETE pela UI).
- Senha bancária: texto puro no banco, mascarada só na tela (sem criptografia).
- Cores da grade/mini-grade reaproveitam as variáveis CSS de nível já
  existentes — não criar paleta nova.

---

### Task 1: SQL — tabela de acessos bancários (`contabil_mapeamento_bancos`)

**Files:**
- Create: `../_sql/schema_contabil_bancos.sql`

**Interfaces:**
- Produces: tabela `public.contabil_mapeamento_bancos` com colunas `id, mapeamento_id, banco, agencia, conta_corrente, operador_login, senha, observacoes, created_at`, consumida pelas Tasks 5–7.

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- BANCOS UTILIZADOS -> tabela de acessos bancários por empresa
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contabil_mapeamento_bancos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapeamento_id     UUID NOT NULL REFERENCES public.contabil_mapeamento (id) ON DELETE CASCADE,
    banco             TEXT NOT NULL,
    agencia           TEXT,
    conta_corrente    TEXT,
    operador_login    TEXT,
    senha             TEXT,
    observacoes       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_bancos_mapeamento ON public.contabil_mapeamento_bancos (mapeamento_id);

ALTER TABLE public.contabil_mapeamento_bancos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_bancos: leitura autenticado" ON public.contabil_mapeamento_bancos;
DROP POLICY IF EXISTS "contabil_bancos: escrita autenticado"  ON public.contabil_mapeamento_bancos;

CREATE POLICY "contabil_bancos: leitura autenticado"
    ON public.contabil_mapeamento_bancos FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_bancos: escrita autenticado"
    ON public.contabil_mapeamento_bancos FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- Migra os dados existentes de bancos_utilizados (text[]) para a tabela nova,
-- um registro por banco, antes de remover a coluna antiga.
INSERT INTO public.contabil_mapeamento_bancos (mapeamento_id, banco)
SELECT m.id, banco
FROM public.contabil_mapeamento m,
     UNNEST(m.bancos_utilizados) AS banco
WHERE m.bancos_utilizados IS NOT NULL AND array_length(m.bancos_utilizados, 1) > 0;

ALTER TABLE public.contabil_mapeamento DROP COLUMN IF EXISTS bancos_utilizados;
```

- [ ] **Step 2: Nenhum teste automatizado aplicável (é uma migration SQL manual).** Deixar registrado no corpo do PR/commit que o SQL precisa ser rodado manualmente no editor SQL do Supabase (mesmo fluxo das migrations anteriores do projeto — ver memória de projeto: "SQL pendente de rodar").

- [ ] **Step 3: Commit**

```bash
git add "_sql/schema_contabil_bancos.sql"
git commit -m "feat(contabil): tabela de acessos bancarios por empresa"
```

---

### Task 2: SQL — tabelas do Diário (`contabil_diario_lancamentos`, `contabil_diario_status_mensal`)

**Files:**
- Create: `../_sql/schema_contabil_diario.sql`

**Interfaces:**
- Produces: `public.contabil_diario_lancamentos(id, codigo_empresa, data, texto, criado_por_nome, criado_por_email, created_at)` e `public.contabil_diario_status_mensal(id, codigo_empresa, ano, mes, status, updated_at)`, consumidas por `diario.js` (Tasks 8–12).

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- DIÁRIO CONTÁBIL
-- ============================================================

-- 1. Lançamentos (só-inclusão)
CREATE TABLE IF NOT EXISTS public.contabil_diario_lancamentos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    data              DATE NOT NULL,
    texto             TEXT NOT NULL,
    criado_por_nome   TEXT,
    criado_por_email  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_diario_lanc_empresa ON public.contabil_diario_lancamentos (codigo_empresa);

ALTER TABLE public.contabil_diario_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_diario_lanc: leitura autenticado" ON public.contabil_diario_lancamentos;
DROP POLICY IF EXISTS "contabil_diario_lanc: escrita autenticado" ON public.contabil_diario_lancamentos;

CREATE POLICY "contabil_diario_lanc: leitura autenticado"
    ON public.contabil_diario_lancamentos FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_diario_lanc: escrita autenticado"
    ON public.contabil_diario_lancamentos FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- 2. Status mensal (grade de fechamento)
CREATE TABLE IF NOT EXISTS public.contabil_diario_status_mensal (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    ano               INT NOT NULL,
    mes               INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    status            TEXT NOT NULL CHECK (status IN ('sem_documentacao', 'pendencias', 'concluido')),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (codigo_empresa, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_contabil_diario_status_empresa     ON public.contabil_diario_status_mensal (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_contabil_diario_status_empresa_ano ON public.contabil_diario_status_mensal (codigo_empresa, ano);

ALTER TABLE public.contabil_diario_status_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_diario_status: leitura autenticado" ON public.contabil_diario_status_mensal;
DROP POLICY IF EXISTS "contabil_diario_status: escrita autenticado" ON public.contabil_diario_status_mensal;

CREATE POLICY "contabil_diario_status: leitura autenticado"
    ON public.contabil_diario_status_mensal FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_diario_status: escrita autenticado"
    ON public.contabil_diario_status_mensal FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- 3. Novo card no hub (revisar antes de rodar em produção)
UPDATE public.ferramentas
   SET nome = nome
 WHERE nome = 'Departamento Contábil';
-- (o card "Diário Contábil" é um link estático dentro do hub, não uma linha
--  nova em `ferramentas` — este UPDATE é um no-op de checagem, mantido só
--  para localizar a tabela caso o hub precise de metadado novo no futuro)
```

- [ ] **Step 2: Nenhum teste automatizado aplicável.** Registrar que o SQL precisa ser rodado manualmente no Supabase.

- [ ] **Step 3: Commit**

```bash
git add "_sql/schema_contabil_diario.sql"
git commit -m "feat(contabil): schema SQL do Diario Contabil"
```

---

### Task 3: Módulo de lógica pura `contabil-diario-util.js` + testes

**Files:**
- Create: `contabil-diario-util.js`
- Create: `test-contabil-diario-util.js`

**Interfaces:**
- Produces: `window.ContabilDiarioUtil = { proximoStatus(status), ultimosNMeses(ano, mes, n), MESES_LABELS }`, consumido por `diario.js` (Tasks 9 e 11).

- [ ] **Step 1: Escrever o módulo**

```javascript
(function (root) {
  'use strict';

  const CICLO = ['sem_documentacao', 'pendencias', 'concluido'];

  const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  // Próximo status no ciclo sem_documentacao -> pendencias -> concluido -> sem_documentacao
  function proximoStatus(status) {
    const idx = CICLO.indexOf(status);
    return CICLO[(idx + 1) % CICLO.length] || CICLO[0];
  }

  // Lista os últimos N meses (ano, mes) terminando em (ano, mes) inclusive,
  // em ordem cronológica crescente. mes é 1-12.
  function ultimosNMeses(ano, mes, n) {
    const resultado = [];
    let a = ano, m = mes;
    for (let i = 0; i < n; i++) {
      resultado.unshift({ ano: a, mes: m });
      m -= 1;
      if (m < 1) { m = 12; a -= 1; }
    }
    return resultado;
  }

  const api = { proximoStatus, ultimosNMeses, MESES_LABELS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ContabilDiarioUtil = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 2: Escrever os testes**

```javascript
const assert = require('assert');
const { proximoStatus, ultimosNMeses, MESES_LABELS } = require('./contabil-diario-util.js');

assert.strictEqual(proximoStatus('sem_documentacao'), 'pendencias');
console.log('OK: sem_documentacao -> pendencias');

assert.strictEqual(proximoStatus('pendencias'), 'concluido');
console.log('OK: pendencias -> concluido');

assert.strictEqual(proximoStatus('concluido'), 'sem_documentacao');
console.log('OK: concluido -> sem_documentacao (ciclo fecha)');

assert.strictEqual(proximoStatus(undefined), 'sem_documentacao');
console.log('OK: status desconhecido/vazio -> sem_documentacao');

assert.deepStrictEqual(
  ultimosNMeses(2026, 3, 6),
  [
    { ano: 2025, mes: 10 },
    { ano: 2025, mes: 11 },
    { ano: 2025, mes: 12 },
    { ano: 2026, mes: 1 },
    { ano: 2026, mes: 2 },
    { ano: 2026, mes: 3 },
  ]
);
console.log('OK: ultimosNMeses cruza virada de ano corretamente');

assert.deepStrictEqual(
  ultimosNMeses(2026, 7, 1),
  [{ ano: 2026, mes: 7 }]
);
console.log('OK: ultimosNMeses com n=1 retorna só o mês atual');

assert.strictEqual(MESES_LABELS.length, 12);
assert.strictEqual(MESES_LABELS[0], 'JAN');
assert.strictEqual(MESES_LABELS[11], 'DEZ');
console.log('OK: MESES_LABELS tem 12 meses, JAN a DEZ');

console.log('Todos os testes passaram.');
```

- [ ] **Step 3: Rodar os testes**

Run: `node test-contabil-diario-util.js`
Expected: todas as linhas `OK:` seguidas de `Todos os testes passaram.`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add contabil-diario-util.js test-contabil-diario-util.js
git commit -m "feat(contabil): utilitario puro do Diario Contabil (ciclo de status e janela de meses)"
```

---

### Task 4: Mapeamento — substituir tags "Bancos Utilizados" pela tabela de acessos bancários

**Files:**
- Modify: `mapeamento.js` (função `renderPerfil` linha ~267, adicionar `renderBancos`/handlers, `carregarDados`)
- Modify: `styles.css` (novas classes `.mapa-bancos-table`)

**Interfaces:**
- Consumes: `contabil_mapeamento_bancos` (Task 1), `escapeHtml`, `mapeamentoAtual`, `supabaseClient` (já existentes em `mapeamento.js`).
- Produces: array em memória `bancosPorMapeamento[mapeamento_id]`, usado por `gerarRelatorioPDF` (Task 5).

- [ ] **Step 1: Carregar bancos junto com os demais dados**

Em `mapeamento.js`, na declaração de variáveis de módulo (linha ~21, junto a
`let pendenciasPorMapeamento = {};`), adicionar:

```javascript
  let bancosPorMapeamento = {}; // { mapeamento_id: [bancos] }
```

Em `carregarDados()` (mapeamento.js:49), depois do bloco que popula
`pendenciasPorMapeamento`, adicionar:

```javascript
    bancosPorMapeamento = {};
    if (ids.length) {
      const { data: bancos, error: errBancos } = await supabaseClient
        .from('contabil_mapeamento_bancos')
        .select('*')
        .in('mapeamento_id', ids);
      if (errBancos) console.error(errBancos);
      (bancos || []).forEach((b) => {
        (bancosPorMapeamento[b.mapeamento_id] = bancosPorMapeamento[b.mapeamento_id] || []).push(b);
      });
    }
```

- [ ] **Step 2: Remover o campo de tags e adicionar a seção de bancos**

Em `renderPerfil()` (mapeamento.js:267), trocar:

```javascript
          <div class="full">${renderTagsInput('bancos_utilizados', 'Bancos Utilizados', m.bancos_utilizados, BANCOS_SUGERIDOS)}</div>
```

por:

```javascript
          <div class="full" id="secaoBancos"></div>
```

E, no fim de `renderPerfil()`, junto às outras chamadas (`renderNivelAtencao(); renderPendencias(); renderRelacionadas();`), adicionar `renderBancos();`.

- [ ] **Step 3: Implementar `renderBancos()`**

```javascript
  function renderBancos() {
    const el = document.getElementById('secaoBancos');
    const m = mapeamentoAtual;
    const bancos = bancosPorMapeamento[m.id] || [];
    const datalistId = 'dl_bancos_utilizados';

    const linhasHtml = bancos.map((b) => `
      <tr data-banco-id="${b.id}">
        <td>${escapeHtml(b.banco)}</td>
        <td><input type="text" data-banco-campo="agencia" value="${escapeHtml(b.agencia || '')}"></td>
        <td><input type="text" data-banco-campo="conta_corrente" value="${escapeHtml(b.conta_corrente || '')}"></td>
        <td><input type="text" data-banco-campo="operador_login" value="${escapeHtml(b.operador_login || '')}"></td>
        <td class="mapa-banco-senha">
          <input type="password" data-banco-campo="senha" value="${escapeHtml(b.senha || '')}">
          <button type="button" class="mapa-banco-olho" data-toggle-senha>👁</button>
        </td>
        <td><input type="text" data-banco-campo="observacoes" value="${escapeHtml(b.observacoes || '')}"></td>
        <td><button type="button" class="mapa-remover-banco" data-remover-banco="${b.id}">×</button></td>
      </tr>
    `).join('');

    el.innerHTML = `
      <label>Bancos Utilizados</label>
      <input type="text" list="${datalistId}" placeholder="Adicionar banco e pressionar Enter" id="inputNovoBanco">
      <datalist id="${datalistId}">${BANCOS_SUGERIDOS.map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist>
      ${bancos.length ? `
        <table class="mapa-bancos-table">
          <thead><tr><th>Banco</th><th>Agência</th><th>Conta Corrente</th><th>Operador/Login</th><th>Senha</th><th>Observações</th><th></th></tr></thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      ` : '<p class="mapa-empty">Nenhum banco cadastrado.</p>'}
    `;

    el.querySelector('#inputNovoBanco').addEventListener('keydown', async (ev) => {
      if (ev.key !== 'Enter' || !ev.target.value.trim()) return;
      ev.preventDefault();
      const banco = ev.target.value.trim();
      const { data, error } = await supabaseClient
        .from('contabil_mapeamento_bancos')
        .insert({ mapeamento_id: m.id, banco })
        .select()
        .single();
      if (error) { console.error(error); return; }
      (bancosPorMapeamento[m.id] = bancosPorMapeamento[m.id] || []).push(data);
      renderBancos();
    });

    el.querySelectorAll('[data-toggle-senha]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    el.querySelectorAll('[data-banco-campo]').forEach((input) => {
      input.addEventListener('blur', async () => {
        const tr = input.closest('tr');
        const bancoId = tr.getAttribute('data-banco-id');
        const campo = input.getAttribute('data-banco-campo');
        const valor = input.value.trim() || null;
        const { error } = await supabaseClient.from('contabil_mapeamento_bancos').update({ [campo]: valor }).eq('id', bancoId);
        if (error) { console.error(error); return; }
        const banco = (bancosPorMapeamento[m.id] || []).find((b) => b.id === bancoId);
        if (banco) banco[campo] = valor;
      });
    });

    el.querySelectorAll('[data-remover-banco]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bancoId = btn.getAttribute('data-remover-banco');
        const { error } = await supabaseClient.from('contabil_mapeamento_bancos').delete().eq('id', bancoId);
        if (error) { console.error(error); return; }
        bancosPorMapeamento[m.id] = (bancosPorMapeamento[m.id] || []).filter((b) => b.id !== bancoId);
        renderBancos();
      });
    });
  }
```

Declarar `let bancosPorMapeamento = {};` junto às demais variáveis de módulo no topo do arquivo (perto de `pendenciasPorMapeamento`), e populá-la em `carregarDados()` conforme Step 1 (sem usar `window`).

- [ ] **Step 4: CSS da tabela de bancos**

Em `styles.css`, após as regras `.mapa-tags`/`.mapa-tag` (perto da linha 583), adicionar:

```css
.mapa-bancos-table{ width:100%; border-collapse:collapse; margin-top:8px; font-size:12.5px; }
.mapa-bancos-table th{ text-align:left; padding:6px 8px; background:var(--surface-2); font-weight:600; color:var(--muted); font-size:11px; text-transform:uppercase; }
.mapa-bancos-table td{ padding:4px 8px; border-top:1px solid var(--line-soft); vertical-align:middle; }
.mapa-bancos-table input{ width:100%; padding:5px 8px; border:1px solid var(--line); background:var(--surface-2); color:var(--text); border-radius:6px; font-size:12.5px; font-family:inherit; }
.mapa-banco-senha{ display:flex; align-items:center; gap:4px; }
.mapa-banco-olho{ background:none; border:none; cursor:pointer; font-size:13px; padding:2px; }
.mapa-remover-banco{ background:none; border:none; color:var(--muted); cursor:pointer; font-size:16px; line-height:1; padding:0 4px; }
.mapa-remover-banco:hover{ color:#c0392b; }
```

- [ ] **Step 5: Verificação manual (sem framework de teste de UI no projeto)**

Abrir `mapeamento.html` no navegador autenticado, selecionar uma empresa,
digitar um banco no campo, confirmar que a tabela aparece com uma linha,
preencher os campos, recarregar a página e confirmar que os valores
persistiram. Remover o banco e confirmar que a linha some.

- [ ] **Step 6: Commit**

```bash
git add mapeamento.js styles.css
git commit -m "feat(contabil): tabela de acessos bancarios substitui tags de bancos utilizados"
```

---

### Task 5: Mapeamento — relatório PDF passa a ler bancos da tabela nova

**Files:**
- Modify: `mapeamento.js` (`gerarRelatorioPDF`, linha ~603)

**Interfaces:**
- Consumes: `bancosPorMapeamento` (variável de módulo criada na Task 4).

- [ ] **Step 1: Trocar a origem do dado no PDF**

Em `gerarRelatorioPDF()`, trocar:

```javascript
      ['Bancos Utilizados', tags(m.bancos_utilizados)],
```

por:

```javascript
      ['Bancos Utilizados', tags((bancosPorMapeamento[m.id] || []).map((b) => b.banco))],
```

- [ ] **Step 2: Verificação manual**

Gerar o relatório PDF de uma empresa com pelo menos 2 bancos cadastrados e
confirmar que a linha "Bancos Utilizados" lista os nomes corretamente,
separados por vírgula.

- [ ] **Step 3: Commit**

```bash
git add mapeamento.js
git commit -m "fix(contabil): relatorio PDF le bancos utilizados da tabela de acessos bancarios"
```

---

### Task 6: Mapeamento — suporte a `?empresa=<codigo>` na URL

**Files:**
- Modify: `mapeamento.js` (`iniciar()`, linha ~29)

**Interfaces:**
- Consumes: `selecionarEmpresa(codigoEmpresa)` (já existente).
- Produces: comportamento de auto-seleção usado pelo link do Diário (Task 10).

- [ ] **Step 1: Ler o parâmetro e auto-selecionar**

Em `iniciar()`, logo depois de `await carregarDados(); renderDashboard(); renderSeletorEmpresas();`, adicionar:

```javascript
    const empresaNaUrl = new URLSearchParams(window.location.search).get('empresa');
    if (empresaNaUrl && empresas.some((e) => e.codigo_empresa === empresaNaUrl)) {
      selecionarEmpresa(empresaNaUrl);
    }
```

- [ ] **Step 2: Verificação manual**

Abrir `mapeamento.html?empresa=<codigo_de_uma_empresa_real>` e confirmar que
a tela já abre no perfil daquela empresa, não no dashboard.

- [ ] **Step 3: Commit**

```bash
git add mapeamento.js
git commit -m "feat(contabil): mapeamento aceita parametro ?empresa= na URL"
```

---

### Task 7: Hub — novo card "Diário Contábil"

**Files:**
- Modify: `index.html` (bloco `.tool-cards`, linha ~47)

**Interfaces:**
- Consumes: nenhuma (link estático).
- Produces: navegação para `diario.html` (criado na Task 8).

- [ ] **Step 1: Adicionar o card**

Em `index.html`, dentro de `.tool-cards`, depois do card "Mapeamento
Estratégico", adicionar:

```html
        <a class="tool-card" href="diario.html">
          <div class="tool-card-icon">📔</div>
          <h3>Diário Contábil</h3>
          <p>Andamento mensal, resumo e registros de cada empresa da carteira.</p>
        </a>
```

- [ ] **Step 2: Verificação manual**

Abrir `index.html`, confirmar que o 3º card aparece e que o clique navega
para `diario.html` (mesmo que a página ainda não exista até a Task 8 rodar
em sequência — se este passo rodar isoladamente, confirmar apenas que o
link/HTML está correto).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(contabil): card do Diario Contabil no hub"
```

---

### Task 8: `diario.html` — esqueleto da página

**Files:**
- Create: `diario.html`

**Interfaces:**
- Consumes: `styles.css`, `../supabase-config.js`, `../portal-auth-guard.js`, `contabil-diario-util.js` (Task 3), `diario.js` (Task 9).

- [ ] **Step 1: Criar o arquivo, espelhando `mapeamento.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Diário Contábil — Scont</title>
  <link rel="icon" type="image/x-icon" href="../assets/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="../assets/favicon-16x16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="../assets/apple-touch-icon.png" />
  <link rel="stylesheet" href="styles.css" />
  <script src="../supabase-config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../portal-auth-guard.js"></script>
</head>
<body>
<!-- AUTH OVERLAY -->
<div id="authOverlay" style="position:fixed;inset:0;background:#F0F2F5;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
  <div style="font-size:40px;">🔐</div>
  <p style="font-family:sans-serif;color:#8B3A3A;font-weight:600;font-size:15px;">Verificando acesso...</p>
</div>

<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">📔</div>
      <div>
        <h1>SCONT</h1>
        <p>Departamento Contábil</p>
      </div>
    </div>

    <button class="btn-novo" id="btnDashboard">📊 Visão Geral</button>

    <div class="seletor-empresa-wrap">
      <label for="seletorEmpresa">Empresa</label>
      <select id="seletorEmpresa">
        <option value="">Selecionar empresa...</option>
      </select>
    </div>

    <div class="sidebar-footer">
      <button class="btn-voltar" onclick="window.location.href='index.html'">
        🏠 <span>Central Contábil</span>
      </button>
    </div>
  </aside>

  <main class="main" id="main">
    <div class="empty-state">
      <div class="emoji">📔</div>
      <h2>Diário Contábil</h2>
      <p>Selecione uma empresa no seletor ao lado, ou veja a Visão Geral da carteira.</p>
    </div>
  </main>
</div>

<script src="contabil-diario-util.js"></script>
<script src="diario.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verificação manual**

Abrir `diario.html` direto no navegador (com sessão autenticada) e confirmar
que a auth overlay some e a tela vazia aparece (antes de `diario.js` estar
completo, isso só funciona depois da Task 9).

- [ ] **Step 3: Commit**

```bash
git add diario.html
git commit -m "feat(contabil): esqueleto da pagina diario.html"
```

---

### Task 9: `diario.js` — bootstrap, dados e dashboard

**Files:**
- Create: `diario.js`

**Interfaces:**
- Consumes: `window.PortalAuthGuard.init`, `window.parseDataLocal` (de `mapeamento-nivel-atencao.js`? **Não** — `diario.js` não carrega esse arquivo; reimplementar localmente uma cópia mínima de `parseDataLocal`, já que é uma função de 4 linhas e evita acoplar `diario.html` a um script de outra ferramenta), `window.ContabilDiarioUtil.ultimosNMeses`/`MESES_LABELS` (Task 3), tabelas Supabase `rh_empresas`, `contabil_mapeamento`, `contabil_mapeamento_pendencias`, `contabil_diario_status_mensal`.
- Produces: `renderDashboardDiario()`, `selecionarEmpresaDiario(codigo)`, variáveis de módulo `empresas`, `mapeamentos`, `pendenciasPorMapeamento`, `statusMensalPorEmpresa` — consumidas pelas Tasks 10–12 no mesmo arquivo.

- [ ] **Step 1: Escrever o bootstrap e o carregamento de dados**

```javascript
(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const NIVEL_LABELS = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico' };
  const REGIME_LABELS = { simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI' };
  const SITUACAO_LABELS = { regularizado: 'Regularizado', em_regularizacao: 'Em Regularização', pendente: 'Pendente', critico: 'Crítico' };
  const FINANCEIRO_LABELS = { interno: 'Interno', bpo_scont: 'BPO Scont', bpo_terceiro: 'BPO Terceiro', nao_possui: 'Não possui' };
  const PERIODICIDADE_LABELS = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual' };

  let empresas = [];
  let mapeamentos = [];
  let pendenciasPorMapeamento = {};
  let bancosPorMapeamento = {};
  let statusMensalPorEmpresa = {}; // { codigo_empresa: { 'ano-mes': status } }
  let lancamentosPorEmpresa = {};  // cache simples, populado sob demanda por empresa
  let empresaAtualCodigo = null;
  let anoGradeAtual = new Date().getFullYear();

  document.addEventListener('DOMContentLoaded', iniciar);

  function parseDataLocal(str) {
    if (str instanceof Date) return str;
    const [ano, mes, dia] = String(str).split('-').map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1);
  }

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();
    window.__contabilAuth = auth;

    document.getElementById('btnDashboard').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('seletorEmpresa').value = '';
      renderDashboardDiario();
    });
    document.getElementById('seletorEmpresa').addEventListener('change', (ev) => {
      if (ev.target.value) selecionarEmpresaDiario(ev.target.value);
    });

    await carregarDadosDiario();
    renderSeletorEmpresasDiario();

    const empresaNaUrl = new URLSearchParams(window.location.search).get('empresa');
    if (empresaNaUrl && empresas.some((e) => e.codigo_empresa === empresaNaUrl)) {
      selecionarEmpresaDiario(empresaNaUrl);
    } else {
      renderDashboardDiario();
    }
  }

  async function carregarDadosDiario() {
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
    bancosPorMapeamento = {};
    if (ids.length) {
      const [{ data: pendencias, error: errPend }, { data: bancos, error: errBancos }] = await Promise.all([
        supabaseClient.from('contabil_mapeamento_pendencias').select('*').in('mapeamento_id', ids),
        supabaseClient.from('contabil_mapeamento_bancos').select('*').in('mapeamento_id', ids),
      ]);
      if (errPend) console.error(errPend);
      if (errBancos) console.error(errBancos);
      (pendencias || []).forEach((p) => {
        (pendenciasPorMapeamento[p.mapeamento_id] = pendenciasPorMapeamento[p.mapeamento_id] || []).push(p);
      });
      (bancos || []).forEach((b) => {
        (bancosPorMapeamento[b.mapeamento_id] = bancosPorMapeamento[b.mapeamento_id] || []).push(b);
      });
    }

    const { data: statusMensal, error: errStatus } = await supabaseClient
      .from('contabil_diario_status_mensal')
      .select('*');
    if (errStatus) console.error(errStatus);
    statusMensalPorEmpresa = {};
    (statusMensal || []).forEach((s) => {
      const bucket = (statusMensalPorEmpresa[s.codigo_empresa] = statusMensalPorEmpresa[s.codigo_empresa] || {});
      bucket[`${s.ano}-${s.mes}`] = s.status;
    });
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

  function statusDoMes(codigoEmpresa, ano, mes) {
    const bucket = statusMensalPorEmpresa[codigoEmpresa];
    return (bucket && bucket[`${ano}-${mes}`]) || 'sem_documentacao';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderSeletorEmpresasDiario() {
    const select = document.getElementById('seletorEmpresa');
    const atual = select.value;
    select.innerHTML = '<option value="">Selecionar empresa...</option>' +
      empresas.map((e) => `<option value="${escapeHtml(e.codigo_empresa)}">${escapeHtml(e.nome_empresa)}</option>`).join('');
    select.value = atual;
  }
})();
```

- [ ] **Step 2: Implementar `renderDashboardDiario()` com a mini-grade dos últimos 6 meses**

Dentro do mesmo IIFE (antes do fechamento `})();`), adicionar:

```javascript
  function miniGradeHtml(codigoEmpresa) {
    const hoje = new Date();
    const meses = window.ContabilDiarioUtil.ultimosNMeses(hoje.getFullYear(), hoje.getMonth() + 1, 6);
    return `<span class="mapa-mini-grade">${meses.map(({ ano, mes }) => {
      const status = statusDoMes(codigoEmpresa, ano, mes);
      return `<span class="mini-quad status-${status}" title="${String(mes).padStart(2, '0')}/${ano}"></span>`;
    }).join('')}</span>`;
  }

  function renderDashboardDiario() {
    const main = document.getElementById('main');
    const linhas = empresas.map((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      const nivel = nivelDe(e.codigo_empresa);
      const abertas = m ? pendenciasAbertasDe(m.id).length : 0;
      return `
        <tr data-codigo="${escapeHtml(e.codigo_empresa)}">
          <td>${escapeHtml(e.nome_empresa)}</td>
          <td>${m && m.regime_tributario ? (REGIME_LABELS[m.regime_tributario] || m.regime_tributario) : '—'}</td>
          <td>${m && m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</td>
          <td><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></td>
          <td>${abertas}</td>
          <td>${miniGradeHtml(e.codigo_empresa)}</td>
        </tr>
      `;
    }).join('');

    main.innerHTML = `
      <table class="mapa-table">
        <thead><tr><th>Empresa</th><th>Regime</th><th>Responsável</th><th>Nível</th><th>Pendências</th><th>Últimos 6 meses</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6">Nenhuma empresa encontrada.</td></tr>'}</tbody>
      </table>
    `;

    main.querySelectorAll('tbody tr[data-codigo]').forEach((tr) => {
      tr.addEventListener('click', () => selecionarEmpresaDiario(tr.getAttribute('data-codigo')));
    });
  }
```

- [ ] **Step 3: CSS da mini-grade**

Em `styles.css`, após as regras de `.mapa-table`, adicionar:

```css
.mapa-mini-grade{ display:inline-flex; gap:2px; }
.mini-quad{ width:10px; height:10px; border-radius:2px; display:inline-block; background:var(--line-soft); }
.mini-quad.status-concluido{ background:var(--success); }
.mini-quad.status-pendencias{ background:var(--warning); }
.mini-quad.status-sem_documentacao{ background:var(--line-soft); }
```

(`--success` e `--warning` são as mesmas variáveis já usadas em
`.badge-nivel.nivel-baixo`/`.badge-nivel.nivel-medio` — reaproveitadas aqui,
sem criar paleta nova.)

- [ ] **Step 4: Verificação manual**

Abrir `diario.html`, confirmar que o dashboard lista as empresas com as
colunas certas e que a mini-grade aparece (cinza, já que a grade começa
vazia).

- [ ] **Step 5: Commit**

```bash
git add diario.js styles.css
git commit -m "feat(contabil): dashboard do Diario Contabil com mini-grade dos ultimos 6 meses"
```

---

### Task 10: `diario.js` — resumo do Mapeamento na página da empresa

**Files:**
- Modify: `diario.js` (adicionar `selecionarEmpresaDiario`, `renderPaginaEmpresa`, `renderResumoMapeamento`)

**Interfaces:**
- Consumes: `mapeamentoDe`, `bancosPorMapeamento`, `empresas` (Task 9).
- Produces: `#main` com `<div id="secaoGradeMensal">` e `<div id="secaoLancamentos">` (consumidos pelas Tasks 11 e 12).

- [ ] **Step 1: Implementar `selecionarEmpresaDiario` e `renderPaginaEmpresa`**

```javascript
  function selecionarEmpresaDiario(codigoEmpresa) {
    empresaAtualCodigo = codigoEmpresa;
    document.getElementById('seletorEmpresa').value = codigoEmpresa;
    anoGradeAtual = new Date().getFullYear();
    renderPaginaEmpresa();
  }

  function empresaNome(codigoEmpresa) {
    const e = empresas.find((x) => x.codigo_empresa === codigoEmpresa);
    return e ? e.nome_empresa : codigoEmpresa;
  }

  function renderPaginaEmpresa() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="onboarding-header">
        <div><h2>${escapeHtml(empresaNome(empresaAtualCodigo))}</h2></div>
      </div>
      <div id="secaoResumoMapeamento"></div>
      <div id="secaoGradeMensal"></div>
      <div id="secaoLancamentos"></div>
    `;
    renderResumoMapeamento();
    renderGradeMensal();
    renderLancamentos();
  }

  function renderResumoMapeamento() {
    const el = document.getElementById('secaoResumoMapeamento');
    const m = mapeamentoDe(empresaAtualCodigo);
    const linkEditar = `<a class="btn btn-primary" href="mapeamento.html?empresa=${encodeURIComponent(empresaAtualCodigo)}">✏️ Editar no Mapeamento Estratégico</a>`;

    if (!m) {
      el.innerHTML = `
        <div class="mapa-secao">
          <div class="mapa-secao-header">Resumo do Mapeamento Estratégico</div>
          <div class="mapa-secao-body">
            <p class="mapa-empty full">Nenhum mapeamento cadastrado ainda.</p>
            <div class="full">${linkEditar}</div>
          </div>
        </div>
      `;
      return;
    }

    const bancos = (bancosPorMapeamento[m.id] || []).map((b) => b.banco);
    const nivel = m.nivel_atencao || 'baixo';
    const anoAtual = String(new Date().getFullYear());
    const statusAno = m[`situacao_${anoAtual}_status`];

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Resumo do Mapeamento Estratégico</div>
        <div class="mapa-secao-body">
          <div><label>Regime Tributário</label><span>${m.regime_tributario ? REGIME_LABELS[m.regime_tributario] : '—'}</span></div>
          <div><label>Periodicidade</label><span>${m.periodicidade ? PERIODICIDADE_LABELS[m.periodicidade] : '—'}</span></div>
          <div><label>Responsável pela Execução</label><span>${m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</span></div>
          <div><label>Contato</label><span>${[m.contato_nome, m.contato_telefone, m.contato_email].filter(Boolean).map(escapeHtml).join(' • ') || '—'}</span></div>
          <div><label>Financeiro Interno/BPO</label><span>${m.financeiro_interno_bpo ? FINANCEIRO_LABELS[m.financeiro_interno_bpo] : '—'}</span></div>
          <div><label>Bancos Utilizados</label><span>${bancos.length ? bancos.map(escapeHtml).join(', ') : '—'}</span></div>
          <div><label>Sistemas Utilizados</label><span>${(m.sistemas_utilizados || []).length ? m.sistemas_utilizados.map(escapeHtml).join(', ') : '—'}</span></div>
          <div><label>Situação ${anoAtual}</label><span>${statusAno ? SITUACAO_LABELS[statusAno] : '—'}</span></div>
          <div><label>Nível de Atenção</label><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></div>
          <div class="full">${linkEditar}</div>
        </div>
      </div>
    `;
  }
```

- [ ] **Step 2: CSS do resumo (labels + valores lado a lado, reaproveitando `.mapa-secao`)**

Em `styles.css`, após `.mapa-secao-body label` (linha ~576), adicionar:

```css
.mapa-secao-body > div > span{ display:block; font-size:13px; color:var(--text); }
```

- [ ] **Step 3: Verificação manual**

Selecionar uma empresa com mapeamento já preenchido e confirmar que o resumo
mostra os dados certos e que o botão "Editar no Mapeamento Estratégico" abre
`mapeamento.html?empresa=...` já no perfil da empresa (valida também a
Task 6). Selecionar uma empresa sem mapeamento e confirmar a mensagem
"Nenhum mapeamento cadastrado ainda."

- [ ] **Step 4: Commit**

```bash
git add diario.js styles.css
git commit -m "feat(contabil): resumo do mapeamento estrategico na pagina do Diario"
```

---

### Task 11: `diario.js` — grade mensal (situação de fechamento)

**Files:**
- Modify: `diario.js` (adicionar `renderGradeMensal`)

**Interfaces:**
- Consumes: `window.ContabilDiarioUtil.proximoStatus`, `window.ContabilDiarioUtil.MESES_LABELS` (Task 3), `statusDoMes`, `statusMensalPorEmpresa`.

- [ ] **Step 1: Implementar `renderGradeMensal()`**

```javascript
  async function alternarStatusMes(codigoEmpresa, ano, mes) {
    const atual = statusDoMes(codigoEmpresa, ano, mes);
    const proximo = window.ContabilDiarioUtil.proximoStatus(atual);
    const bucket = (statusMensalPorEmpresa[codigoEmpresa] = statusMensalPorEmpresa[codigoEmpresa] || {});

    if (proximo === 'sem_documentacao') {
      const { error } = await supabaseClient
        .from('contabil_diario_status_mensal')
        .delete()
        .eq('codigo_empresa', codigoEmpresa).eq('ano', ano).eq('mes', mes);
      if (error) { console.error(error); return; }
      delete bucket[`${ano}-${mes}`];
    } else {
      const { error } = await supabaseClient
        .from('contabil_diario_status_mensal')
        .upsert({ codigo_empresa: codigoEmpresa, ano, mes, status: proximo, updated_at: new Date().toISOString() }, { onConflict: 'codigo_empresa,ano,mes' });
      if (error) { console.error(error); return; }
      bucket[`${ano}-${mes}`] = proximo;
    }
    renderGradeMensal();
  }

  function renderGradeMensal() {
    const el = document.getElementById('secaoGradeMensal');
    const meses = window.ContabilDiarioUtil.MESES_LABELS;

    const celulasHtml = meses.map((label, idx) => {
      const mes = idx + 1;
      const status = statusDoMes(empresaAtualCodigo, anoGradeAtual, mes);
      return `
        <div class="mapa-grade-cel status-${status}" data-mes="${mes}" title="${label}/${anoGradeAtual}">
          <span class="mapa-grade-mes">${label}</span>
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Situação de Fechamento — Grade Mensal</div>
        <div class="mapa-secao-body">
          <div class="full mapa-grade-nav">
            <button type="button" id="btnAnoAnterior">‹</button>
            <strong>${anoGradeAtual}</strong>
            <button type="button" id="btnAnoSeguinte">›</button>
          </div>
          <div class="full mapa-grade-linha">${celulasHtml}</div>
        </div>
      </div>
    `;

    el.querySelector('#btnAnoAnterior').addEventListener('click', () => { anoGradeAtual -= 1; renderGradeMensal(); });
    el.querySelector('#btnAnoSeguinte').addEventListener('click', () => { anoGradeAtual += 1; renderGradeMensal(); });
    el.querySelectorAll('.mapa-grade-cel').forEach((cel) => {
      cel.addEventListener('click', () => alternarStatusMes(empresaAtualCodigo, anoGradeAtual, Number(cel.getAttribute('data-mes'))));
    });
  }
```

- [ ] **Step 2: CSS da grade**

Em `styles.css`:

```css
.mapa-grade-nav{ display:flex; align-items:center; gap:12px; margin-bottom:8px; }
.mapa-grade-nav button{ background:var(--surface-2); border:1px solid var(--line); border-radius:6px; padding:4px 10px; cursor:pointer; font-size:14px; }
.mapa-grade-linha{ display:grid; grid-template-columns:repeat(12, 1fr); gap:6px; }
.mapa-grade-cel{ border-radius:8px; padding:10px 4px; text-align:center; cursor:pointer; background:var(--line-soft); font-size:11px; font-weight:600; color:var(--text); user-select:none; }
.mapa-grade-cel.status-concluido{ background:var(--success); color:#fff; }
.mapa-grade-cel.status-pendencias{ background:var(--warning); color:#fff; }
.mapa-grade-cel.status-sem_documentacao{ background:var(--line-soft); }
```

- [ ] **Step 3: Verificação manual**

Na página de uma empresa, clicar em um mês e confirmar que ele cicla pelas 3
cores; navegar para o ano anterior/seguinte com ‹ › e confirmar que a grade
troca; recarregar a página e confirmar que o status marcado persistiu.

- [ ] **Step 4: Commit**

```bash
git add diario.js styles.css
git commit -m "feat(contabil): grade mensal de situacao de fechamento no Diario"
```

---

### Task 12: `diario.js` — lançamentos do diário (só-inclusão)

**Files:**
- Modify: `diario.js` (adicionar `renderLancamentos`)

**Interfaces:**
- Consumes: `contabil_diario_lancamentos` (Task 2), `window.__contabilAuth` (setado em `iniciar()`, Task 9).

- [ ] **Step 1: Implementar `renderLancamentos()`**

```javascript
  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function renderLancamentos() {
    const el = document.getElementById('secaoLancamentos');
    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Lançamentos do Diário</div>
        <div class="mapa-secao-body">
          <div><label>Data</label><input type="date" id="novoLancamentoData" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="full"><label>Registro</label><textarea id="novoLancamentoTexto" rows="2" placeholder="Ex: Enviado SPED Fiscal de junho, pendente confirmação do cliente."></textarea></div>
          <div><button type="button" class="btn-novo" id="btnAddLancamento">+ Adicionar Lançamento</button></div>
          <div class="full" id="listaLancamentos"><p class="mapa-empty">Carregando...</p></div>
        </div>
      </div>
    `;

    el.querySelector('#btnAddLancamento').addEventListener('click', async () => {
      const data = document.getElementById('novoLancamentoData').value;
      const texto = document.getElementById('novoLancamentoTexto').value.trim();
      if (!data || !texto) return;
      const auth = window.__contabilAuth || {};
      const { error } = await supabaseClient.from('contabil_diario_lancamentos').insert({
        codigo_empresa: empresaAtualCodigo,
        data,
        texto,
        criado_por_nome: auth.userData?.nome || null,
        criado_por_email: auth.email || null,
      });
      if (error) { console.error(error); return; }
      document.getElementById('novoLancamentoTexto').value = '';
      carregarListaLancamentos();
    });

    carregarListaLancamentos();
  }

  async function carregarListaLancamentos() {
    const container = document.getElementById('listaLancamentos');
    const { data, error } = await supabaseClient
      .from('contabil_diario_lancamentos')
      .select('*')
      .eq('codigo_empresa', empresaAtualCodigo)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.error(error); container.innerHTML = '<p class="mapa-empty">Erro ao carregar lançamentos.</p>'; return; }

    if (!data || !data.length) {
      container.innerHTML = '<p class="mapa-empty">Nenhum lançamento registrado.</p>';
      return;
    }

    container.innerHTML = data.map((l) => `
      <div class="mapa-lancamento-item">
        <div class="mapa-lancamento-data">${parseDataLocal(l.data).toLocaleDateString('pt-BR')}</div>
        <div class="mapa-lancamento-texto">${escapeHtml(l.texto)}</div>
        <div class="mapa-lancamento-autor">— ${escapeHtml(l.criado_por_nome || l.criado_por_email || 'desconhecido')} (${formatarDataHora(l.created_at)})</div>
      </div>
    `).join('');
  }
```

- [ ] **Step 2: CSS dos lançamentos**

Em `styles.css`:

```css
.mapa-lancamento-item{ padding:10px 0; border-top:1px solid var(--line-soft); }
.mapa-lancamento-item:first-child{ border-top:none; }
.mapa-lancamento-data{ font-size:11px; font-weight:700; color:var(--brand); text-transform:uppercase; }
.mapa-lancamento-texto{ font-size:13px; color:var(--text); margin:2px 0 4px; white-space:pre-wrap; }
.mapa-lancamento-autor{ font-size:11px; color:var(--muted); }
```

- [ ] **Step 3: Verificação manual**

Adicionar 2 lançamentos em datas diferentes para a mesma empresa, confirmar
que aparecem em ordem decrescente por data, com nome do usuário logado e
timestamp de inserção corretos. Confirmar que não há botão de editar/excluir
na lista.

- [ ] **Step 4: Commit**

```bash
git add diario.js styles.css
git commit -m "feat(contabil): lancamentos do diario (so-inclusao) com autor e timestamp"
```

---

### Task 13: Revisão final e push

**Files:** nenhum novo — checagem de ponta a ponta.

- [ ] **Step 1: Rodar os testes de lógica pura**

Run: `node test-mapeamento-nivel-atencao.js && node test-contabil-diario-util.js`
Expected: ambos terminam com "Todos os testes passaram.", exit code 0.

- [ ] **Step 2: Checagem de sintaxe de todos os arquivos JS tocados/criados**

Run: `node --check mapeamento.js && node --check diario.js && node --check contabil-diario-util.js`
Expected: nenhuma saída (sintaxe válida).

- [ ] **Step 3: Conferir `git log` e `git status` do branch**

Run: `git log --oneline -15 && git status --short`
Expected: uma sequência de commits das Tasks 1–12, working tree limpo (fora
arquivos não relacionados a este plano).

- [ ] **Step 4: Push**

```bash
git push
```

Expected: push aceito no branch atual (`main`).

- [ ] **Step 5: Registrar pendência operacional**

Deixar explícito para o usuário, fora do código, que os dois arquivos SQL
(`_sql/schema_contabil_bancos.sql` e `_sql/schema_contabil_diario.sql`)
precisam ser rodados manualmente no editor SQL do Supabase antes de as telas
funcionarem em produção — mesmo fluxo de todas as migrations anteriores
deste projeto.
