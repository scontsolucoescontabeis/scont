# Diário Contábil — Mapeamento sai do hub, busca de empresa, Relatórios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o card do Mapeamento Estratégico do hub, trocar o seletor de
empresa do Diário por um combobox com busca, e adicionar uma tela de
Relatórios multi-empresa com filtros e colunas selecionáveis.

**Architecture:** Continua vanilla JS + Supabase, sem build. A tela de
Relatórios vive num arquivo novo `diario-relatorios.js` (evita inchar ainda
mais `diario.js`), que lê os dados já carregados por `diario.js` através de
`window.__diarioContext` (populado uma vez, ao fim de `carregarDadosDiario()`).

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS client v2, jsPDF + AutoTable.

## Global Constraints

- Sem build/bundler — tudo carregado via `<script>`.
- `mapeamento.html`/`mapeamento.js` não mudam nesta rodada — só perdem o link
  direto no hub.
- Nenhuma SQL nova — todas as tabelas usadas já existem
  (`contabil_mapeamento`, `contabil_mapeamento_bancos`,
  `contabil_diario_status_mensal`, `contabil_diario_lancamentos`).
- Filtro de "Período" na tela de Relatórios não exclui empresas da lista —
  só escopa as colunas derivadas de lançamentos ("Quantidade de Lançamentos"
  e "Último Lançamento").
- Combobox de empresa é só clique do mouse na lista suspensa — sem navegação
  por setas do teclado (fora de escopo, ver spec).

---

### Task 1: Remover o card do Mapeamento Estratégico do hub

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remover o card**

Em `index.html`, remover o bloco:

```html
        <a class="tool-card" href="mapeamento.html">
          <div class="tool-card-icon">🗺️</div>
          <h3>Mapeamento Estratégico</h3>
          <p>Perfil operacional, fiscal e de risco de cada empresa da carteira.</p>
        </a>
```

Restando só os cards de Onboarding e Diário Contábil dentro de
`.tool-cards`.

- [ ] **Step 2: Verificação manual**

Abrir `index.html`, confirmar que só aparecem 2 cards (Onboarding, Diário
Contábil) e que `mapeamento.html` continua acessível diretamente pela URL
(não foi deletado, só perdeu o link do hub).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor(contabil): remove card do Mapeamento Estrategico do hub"
```

---

### Task 2: Combobox de busca de empresa no Diário

**Files:**
- Modify: `diario.html` (troca o `<select>` pelo combobox)
- Modify: `diario.js` (troca toda lógica que lia/escrevia `#seletorEmpresa`)
- Modify: `styles.css` (novas classes `.combobox-lista`/`.combobox-item`)

**Interfaces:**
- Produces: `#buscaEmpresa` (input) substitui `#seletorEmpresa` (select) como
  único ponto de seleção de empresa no Diário.

- [ ] **Step 1: Trocar o HTML do seletor**

Em `diario.html`, substituir:

```html
    <div class="seletor-empresa-wrap">
      <label for="seletorEmpresa">Empresa</label>
      <select id="seletorEmpresa">
        <option value="">Selecionar empresa...</option>
      </select>
    </div>
```

por:

```html
    <div class="seletor-empresa-wrap" id="wrapBuscaEmpresa">
      <label for="buscaEmpresa">Empresa</label>
      <input type="text" id="buscaEmpresa" placeholder="Buscar empresa..." autocomplete="off">
      <div id="listaBuscaEmpresa" class="combobox-lista"></div>
    </div>
```

- [ ] **Step 2: Trocar a lógica em `diario.js`**

Em `iniciar()` (diario.js:34-41), substituir:

```javascript
    document.getElementById('btnDashboard').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('seletorEmpresa').value = '';
      renderDashboardDiario();
    });
    document.getElementById('seletorEmpresa').addEventListener('change', (ev) => {
      if (ev.target.value) selecionarEmpresaDiario(ev.target.value);
    });
```

por:

```javascript
    document.getElementById('btnDashboard').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      renderDashboardDiario();
    });
    inicializarBuscaEmpresa();
```

Substituir a chamada `renderSeletorEmpresasDiario();` (diario.js:44, dentro
de `iniciar()`) — remover essa linha (a função inteira deixa de existir,
Step 3).

Adicionar `window.__diarioContext = {...}` ao final de
`carregarDadosDiario()` (depois do bloco que popula `statusMensalPorEmpresa`,
diario.js:88-92):

```javascript
    window.__diarioContext = {
      supabaseClient,
      empresas,
      mapeamentos,
      bancosPorMapeamento,
      statusMensalPorEmpresa,
      NIVEL_LABELS, REGIME_LABELS, SITUACAO_LABELS, FINANCEIRO_LABELS, PERIODICIDADE_LABELS,
      mapeamentoDe,
      escapeHtml,
    };
```

- [ ] **Step 3: Remover `renderSeletorEmpresasDiario` e adicionar a busca**

Remover a função `renderSeletorEmpresasDiario()` inteira (diario.js:124-130).

No lugar (mesma posição no arquivo), adicionar:

```javascript
  function inicializarBuscaEmpresa() {
    const input = document.getElementById('buscaEmpresa');
    const lista = document.getElementById('listaBuscaEmpresa');

    input.addEventListener('input', () => {
      const termo = input.value.trim().toLowerCase();
      if (!termo) { lista.innerHTML = ''; lista.classList.remove('aberta'); return; }
      const resultados = empresas.filter((e) => e.nome_empresa.toLowerCase().includes(termo)).slice(0, 20);
      if (!resultados.length) {
        lista.innerHTML = '<div class="combobox-item combobox-vazio">Nenhuma empresa encontrada.</div>';
      } else {
        lista.innerHTML = resultados.map((e) => `<div class="combobox-item" data-codigo="${escapeHtml(e.codigo_empresa)}">${escapeHtml(e.nome_empresa)}</div>`).join('');
      }
      lista.classList.add('aberta');
    });

    lista.addEventListener('click', (ev) => {
      const item = ev.target.closest('.combobox-item[data-codigo]');
      if (!item) return;
      lista.innerHTML = '';
      lista.classList.remove('aberta');
      selecionarEmpresaDiario(item.getAttribute('data-codigo'));
    });

    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('#wrapBuscaEmpresa')) {
        lista.innerHTML = '';
        lista.classList.remove('aberta');
      }
    });

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { lista.innerHTML = ''; lista.classList.remove('aberta'); }
    });
  }
```

- [ ] **Step 4: Atualizar `selecionarEmpresaDiario` para preencher o campo de texto**

Em `selecionarEmpresaDiario` (diario.js:175-180), substituir:

```javascript
  function selecionarEmpresaDiario(codigoEmpresa) {
    empresaAtualCodigo = codigoEmpresa;
    document.getElementById('seletorEmpresa').value = codigoEmpresa;
    anoGradeAtual = new Date().getFullYear();
    renderPaginaEmpresa();
  }
```

por:

```javascript
  function selecionarEmpresaDiario(codigoEmpresa) {
    empresaAtualCodigo = codigoEmpresa;
    document.getElementById('buscaEmpresa').value = empresaNome(codigoEmpresa);
    anoGradeAtual = new Date().getFullYear();
    renderPaginaEmpresa();
  }
```

(`empresaNome` já existe no arquivo, linha ~119 — sem mudança nela.)

- [ ] **Step 5: CSS do combobox**

Em `styles.css`, após as regras `.seletor-empresa-wrap` (buscar bloco
existente, próximo à linha 539), adicionar:

```css
.seletor-empresa-wrap{ position:relative; }
.combobox-lista{ display:none; position:absolute; top:100%; left:0; right:0; z-index:20; max-height:260px; overflow-y:auto; background:#fff; border:1px solid var(--line); border-radius:8px; margin-top:4px; box-shadow:var(--shadow-soft); }
.combobox-lista.aberta{ display:block; }
.combobox-item{ padding:8px 12px; font-size:13px; color:var(--text); cursor:pointer; }
.combobox-item:hover{ background:var(--surface-2); }
.combobox-item.combobox-vazio{ color:var(--muted); cursor:default; }
.combobox-item.combobox-vazio:hover{ background:none; }
```

(Se `.seletor-empresa-wrap` já tiver uma regra de `position` diferente,
ajustar em vez de duplicar — o objetivo é só garantir `position:relative`
para a lista suspensa se posicionar corretamente.)

- [ ] **Step 6: Verificação manual**

Abrir `diario.html`, digitar parte do nome de uma empresa no campo de busca,
confirmar que a lista aparece filtrada, clicar num resultado e confirmar que
abre a página da empresa com o nome preenchido no campo. Clicar fora fecha a
lista. Clicar em "📊 Visão Geral" limpa o campo.

- [ ] **Step 7: Commit**

```bash
git add diario.html diario.js styles.css
git commit -m "feat(contabil): combobox de busca de empresa no Diario Contabil"
```

---

### Task 3: Sidebar do Diário ganha o botão "Relatórios" + esqueleto de `diario-relatorios.js`

**Files:**
- Modify: `diario.html` (botão novo + `<script src="diario-relatorios.js">`)
- Create: `diario-relatorios.js`

**Interfaces:**
- Consumes: `window.__diarioContext` (Task 2, Step 2).
- Produces: `window.DiarioRelatorios.render(main)`, chamado pelo botão
  "📄 Relatórios".

- [ ] **Step 1: Adicionar o botão no sidebar**

Em `diario.html`, logo após `<button class="btn-novo" id="btnDashboard">📊 Visão Geral</button>`, adicionar:

```html
    <button class="btn-novo" id="btnRelatorios">📄 Relatórios</button>
```

E, antes de `<script src="diario.js"></script>`, adicionar:

```html
<script src="diario-relatorios.js"></script>
```

(precisa vir depois de `diario.js` na ordem de carregamento, já que só usa
`window.__diarioContext` dentro de uma função chamada por clique, não no
load — mas por clareza, manter a ordem `contabil-diario-util.js` →
`diario.js` → `diario-relatorios.js`.)

- [ ] **Step 2: Ligar o botão em `diario.js`**

Em `iniciar()`, junto ao listener de `btnDashboard`, adicionar:

```javascript
    document.getElementById('btnRelatorios').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      window.DiarioRelatorios.render(document.getElementById('main'));
    });
```

- [ ] **Step 3: Criar o esqueleto de `diario-relatorios.js`**

```javascript
(function () {
  'use strict';

  const STATUS_GRADE_LABELS = { sem_documentacao: 'Sem Documentação', pendencias: 'Pendências', concluido: 'Concluído' };

  function render(main) {
    const ctx = window.__diarioContext;
    main.innerHTML = '<p class="mapa-empty">Carregando Relatórios...</p>';
    if (!ctx) { main.innerHTML = '<p class="mapa-empty">Dados ainda não carregados.</p>'; return; }
    renderFiltros(main, ctx);
  }

  window.DiarioRelatorios = { render };
})();
```

- [ ] **Step 4: Verificação manual**

Clicar em "📄 Relatórios" no sidebar do Diário e confirmar que a tela troca
para "Carregando Relatórios..." sem erros no console (a Task 4 completa a
implementação).

- [ ] **Step 5: Commit**

```bash
git add diario.html diario.js diario-relatorios.js
git commit -m "feat(contabil): esqueleto da tela de Relatorios do Diario Contabil"
```

---

### Task 4: Filtros e busca de empresas na tela de Relatórios

**Files:**
- Modify: `diario-relatorios.js` (implementa `renderFiltros`)
- Modify: `styles.css` (classes do formulário de filtros, se necessário — reaproveitar `.mapa-secao`/`.mapa-secao-body` já existentes)

**Interfaces:**
- Produces: `renderResultados(main, ctx, empresasFiltradas)` (chamada ao clicar em "Buscar", implementada na Task 5).

- [ ] **Step 1: Implementar `renderFiltros`**

```javascript
  function anoAtualStr() {
    return String(new Date().getFullYear());
  }

  function bancosDistintos(ctx) {
    const nomes = new Set();
    Object.values(ctx.bancosPorMapeamento).forEach((lista) => {
      lista.forEach((b) => nomes.add(b.banco));
    });
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function checkboxGrupo(nomeGrupo, opcoes) {
    return opcoes.map(({ value, label }) => `
      <label class="mapa-checkbox-item">
        <input type="checkbox" name="${nomeGrupo}" value="${value}"> ${label}
      </label>
    `).join('');
  }

  function renderFiltros(main, ctx) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    main.innerHTML = `
      <div class="onboarding-header"><div><h2>Relatórios</h2></div></div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Filtros</div>
        <div class="mapa-secao-body">
          <div class="full">
            <label>Nível de Atenção</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroNivel', Object.entries(ctx.NIVEL_LABELS).map(([value, label]) => ({ value, label })))}</div>
          </div>
          <div class="full">
            <label>Situação do Ano Corrente (${anoAtualStr()})</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroSituacaoAno', Object.entries(ctx.SITUACAO_LABELS).map(([value, label]) => ({ value, label })))}</div>
          </div>
          <div>
            <label>Status da Grade Mensal</label>
            <select id="filtroStatusGrade">
              <option value="">(não filtrar)</option>
              ${Object.entries(STATUS_GRADE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Mês/Ano da Grade</label>
            <div style="display:flex; gap:6px;">
              <select id="filtroGradeMes">
                ${window.ContabilDiarioUtil.MESES_LABELS.map((l, idx) => `<option value="${idx + 1}" ${idx + 1 === mesAtual ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
              <input type="number" id="filtroGradeAno" value="${anoAtual}" style="width:90px;">
            </div>
          </div>
          <div class="full">
            <label>Banco</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroBanco', bancosDistintos(ctx).map((b) => ({ value: b, label: b })))}</div>
          </div>
          <div class="full">
            <label>Regime Tributário</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroRegime', Object.entries(ctx.REGIME_LABELS).map(([value, label]) => ({ value, label })))}</div>
          </div>
          <div class="full">
            <label>Financeiro Interno/BPO</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroFinanceiro', Object.entries(ctx.FINANCEIRO_LABELS).map(([value, label]) => ({ value, label })))}</div>
          </div>
          <div><label>Lançamentos — de</label><input type="date" id="filtroPeriodoDe"></div>
          <div><label>Lançamentos — até</label><input type="date" id="filtroPeriodoAte"></div>
          <div class="full"><button type="button" class="btn-novo" id="btnBuscarRelatorio">Buscar</button></div>
        </div>
      </div>
      <div id="secaoResultadosRelatorio"></div>
    `;

    document.getElementById('btnBuscarRelatorio').addEventListener('click', () => {
      const filtros = lerFiltros();
      const encontradas = aplicarFiltros(ctx, filtros);
      renderResultados(document.getElementById('secaoResultadosRelatorio'), ctx, encontradas, filtros);
    });
  }

  function valoresMarcados(nomeGrupo) {
    return Array.from(document.querySelectorAll(`input[name="${nomeGrupo}"]:checked`)).map((el) => el.value);
  }

  function lerFiltros() {
    return {
      niveis: valoresMarcados('filtroNivel'),
      situacoesAno: valoresMarcados('filtroSituacaoAno'),
      statusGrade: document.getElementById('filtroStatusGrade').value || null,
      gradeMes: Number(document.getElementById('filtroGradeMes').value),
      gradeAno: Number(document.getElementById('filtroGradeAno').value),
      bancos: valoresMarcados('filtroBanco'),
      regimes: valoresMarcados('filtroRegime'),
      financeiros: valoresMarcados('filtroFinanceiro'),
      periodoDe: document.getElementById('filtroPeriodoDe').value || null,
      periodoAte: document.getElementById('filtroPeriodoAte').value || null,
    };
  }

  function aplicarFiltros(ctx, filtros) {
    return ctx.empresas.filter((e) => {
      const m = ctx.mapeamentoDe(e.codigo_empresa);
      const nivel = m ? (m.nivel_atencao || 'baixo') : 'baixo';
      if (filtros.niveis.length && !filtros.niveis.includes(nivel)) return false;

      if (filtros.situacoesAno.length) {
        const statusAno = m ? m[`situacao_${anoAtualStr()}_status`] : null;
        if (!statusAno || !filtros.situacoesAno.includes(statusAno)) return false;
      }

      if (filtros.statusGrade) {
        const bucket = ctx.statusMensalPorEmpresa[e.codigo_empresa];
        const statusMes = (bucket && bucket[`${filtros.gradeAno}-${filtros.gradeMes}`]) || 'sem_documentacao';
        if (statusMes !== filtros.statusGrade) return false;
      }

      if (filtros.bancos.length) {
        const bancosEmpresa = m ? (ctx.bancosPorMapeamento[m.id] || []).map((b) => b.banco) : [];
        if (!filtros.bancos.some((b) => bancosEmpresa.includes(b))) return false;
      }

      if (filtros.regimes.length) {
        if (!m || !filtros.regimes.includes(m.regime_tributario)) return false;
      }

      if (filtros.financeiros.length) {
        if (!m || !filtros.financeiros.includes(m.financeiro_interno_bpo)) return false;
      }

      return true;
    });
  }
```

Adicionar `checkbox-grupo` CSS (styles.css):

```css
.mapa-checkbox-grupo{ display:flex; flex-wrap:wrap; gap:10px; }
.mapa-checkbox-item{ display:flex; align-items:center; gap:5px; font-size:12.5px; color:var(--text); font-weight:normal; margin:0; }
.mapa-checkbox-item input{ width:auto; }
```

- [ ] **Step 2: Verificação manual**

Na tela de Relatórios, marcar um filtro (ex.: Nível "Crítico") e clicar
"Buscar" — sem a Task 5 implementada ainda, isso vai chamar
`renderResultados` que não existe; para testar isoladamente esta task,
adicionar temporariamente um `console.log(encontradas)` no lugar da chamada,
conferir no console que a lista bate com o filtro, e então prosseguir para a
Task 5 (que implementa `renderResultados` de verdade e substitui esse log).

- [ ] **Step 3: Commit**

```bash
git add diario-relatorios.js styles.css
git commit -m "feat(contabil): filtros da tela de Relatorios do Diario Contabil"
```

---

### Task 5: Seleção de empresas, seleção de colunas e geração do PDF

**Files:**
- Modify: `diario-relatorios.js` (implementa `renderResultados` e a geração do PDF)
- Modify: `diario.html` (adiciona jsPDF/AutoTable, que hoje só estão em `mapeamento.html`)

**Interfaces:**
- Consumes: `ctx.supabaseClient`, `contabil_diario_lancamentos`.

- [ ] **Step 1: Adicionar jsPDF/AutoTable a `diario.html`**

Em `diario.html`, no `<head>`, adicionar (mesmas versões de `mapeamento.html`):

```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
```

- [ ] **Step 2: Definir as colunas do relatório**

Em `diario-relatorios.js`, adicionar (antes de `renderFiltros`):

```javascript
  const COLUNAS = [
    { key: 'empresa', grupo: 'fixa', label: 'Empresa', padrao: true, fixa: true },
    { key: 'regime', grupo: 'mapeamento', label: 'Regime Tributário', padrao: true },
    { key: 'periodicidade', grupo: 'mapeamento', label: 'Periodicidade', padrao: false },
    { key: 'responsavel', grupo: 'mapeamento', label: 'Responsável pela Execução', padrao: true },
    { key: 'contato', grupo: 'mapeamento', label: 'Contato', padrao: false },
    { key: 'financeiro', grupo: 'mapeamento', label: 'Financeiro Interno/BPO', padrao: false },
    { key: 'bancos', grupo: 'mapeamento', label: 'Bancos Utilizados', padrao: false },
    { key: 'sistemas', grupo: 'mapeamento', label: 'Sistemas Utilizados', padrao: false },
    { key: 'situacaoAno', grupo: 'mapeamento', label: 'Situação do Ano Corrente', padrao: false },
    { key: 'nivel', grupo: 'mapeamento', label: 'Nível de Atenção', padrao: true },
    { key: 'entregaveis', grupo: 'mapeamento', label: 'Entregáveis Esperados', padrao: false },
    { key: 'obrigacoes', grupo: 'mapeamento', label: 'Obrigações Acessórias', padrao: false },
    { key: 'particularidadesContabeis', grupo: 'mapeamento', label: 'Particularidades Contábeis', padrao: false },
    { key: 'particularidadesFiscais', grupo: 'mapeamento', label: 'Particularidades Fiscais', padrao: false },
    { key: 'particularidadesSocietarias', grupo: 'mapeamento', label: 'Particularidades Societárias', padrao: false },
    { key: 'statusGrade', grupo: 'diario', label: 'Status da Grade Mensal', padrao: false },
    { key: 'qtdLancamentos', grupo: 'diario', label: 'Qtd. Lançamentos no Período', padrao: false },
    { key: 'ultimoLancamento', grupo: 'diario', label: 'Último Lançamento', padrao: false },
  ];
```

- [ ] **Step 3: Implementar `renderResultados`**

```javascript
  function renderResultados(el, ctx, encontradas, filtros) {
    if (!encontradas.length) {
      el.innerHTML = '<div class="mapa-secao"><div class="mapa-secao-body"><p class="mapa-empty full">Nenhuma empresa encontrada com esses filtros.</p></div></div>';
      return;
    }

    const empresasHtml = encontradas.map((e) => `
      <label class="mapa-checkbox-item">
        <input type="checkbox" data-empresa-codigo="${ctx.escapeHtml(e.codigo_empresa)}" checked> ${ctx.escapeHtml(e.nome_empresa)}
      </label>
    `).join('');

    const colunasHtml = COLUNAS.map((c) => `
      <label class="mapa-checkbox-item">
        <input type="checkbox" data-coluna-key="${c.key}" ${c.padrao || c.fixa ? 'checked' : ''} ${c.fixa ? 'disabled' : ''}> ${c.label}
      </label>
    `).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Empresas Encontradas (${encontradas.length})</div>
        <div class="mapa-secao-body">
          <div class="full mapa-checkbox-grupo">${empresasHtml}</div>
        </div>
      </div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Colunas do Relatório</div>
        <div class="mapa-secao-body">
          <div class="full mapa-checkbox-grupo">${colunasHtml}</div>
        </div>
      </div>
      <div class="mapa-secao">
        <div class="mapa-secao-body">
          <div class="full"><button type="button" class="btn btn-primary" id="btnGerarRelatorioPdf">📄 Gerar PDF</button></div>
        </div>
      </div>
    `;

    el.querySelector('#btnGerarRelatorioPdf').addEventListener('click', async () => {
      const codigosSelecionados = Array.from(el.querySelectorAll('[data-empresa-codigo]:checked')).map((i) => i.getAttribute('data-empresa-codigo'));
      const colunasSelecionadas = COLUNAS.filter((c) => el.querySelector(`[data-coluna-key="${c.key}"]`).checked);
      if (!codigosSelecionados.length) return;
      await gerarPdfRelatorio(ctx, codigosSelecionados, colunasSelecionadas, filtros);
    });
  }
```

- [ ] **Step 4: Buscar lançamentos (se necessário) e montar o PDF**

```javascript
  function truncar(texto, max) {
    if (!texto) return '';
    return texto.length > max ? texto.slice(0, max) + '…' : texto;
  }

  async function buscarInfoLancamentos(ctx, codigos, periodoDe, periodoAte) {
    let query = ctx.supabaseClient
      .from('contabil_diario_lancamentos')
      .select('codigo_empresa, data, texto, criado_por_nome, criado_por_email, created_at')
      .in('codigo_empresa', codigos)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });
    if (periodoDe) query = query.gte('data', periodoDe);
    if (periodoAte) query = query.lte('data', periodoAte);
    const { data, error } = await query;
    if (error) { console.error(error); return {}; }

    const porEmpresa = {};
    (data || []).forEach((l) => {
      const bucket = (porEmpresa[l.codigo_empresa] = porEmpresa[l.codigo_empresa] || { qtd: 0, ultimo: null });
      bucket.qtd += 1;
      if (!bucket.ultimo) bucket.ultimo = l;
    });
    return porEmpresa;
  }

  async function gerarPdfRelatorio(ctx, codigos, colunas, filtros) {
    const precisaLancamentos = colunas.some((c) => c.key === 'qtdLancamentos' || c.key === 'ultimoLancamento');
    const infoLancamentos = precisaLancamentos
      ? await buscarInfoLancamentos(ctx, codigos, filtros.periodoDe, filtros.periodoAte)
      : {};

    const linhas = codigos.map((codigo) => {
      const e = ctx.empresas.find((x) => x.codigo_empresa === codigo);
      const m = ctx.mapeamentoDe(codigo);
      const bancos = m ? (ctx.bancosPorMapeamento[m.id] || []).map((b) => b.banco) : [];
      const lanc = infoLancamentos[codigo];

      return colunas.map((c) => {
        switch (c.key) {
          case 'empresa': return e ? e.nome_empresa : codigo;
          case 'regime': return m && m.regime_tributario ? (ctx.REGIME_LABELS[m.regime_tributario] || m.regime_tributario) : '—';
          case 'periodicidade': return m && m.periodicidade ? (ctx.PERIODICIDADE_LABELS[m.periodicidade] || m.periodicidade) : '—';
          case 'responsavel': return m && m.responsavel_execucao ? m.responsavel_execucao : '—';
          case 'contato': return m ? [m.contato_nome, m.contato_telefone, m.contato_email].filter(Boolean).join(' • ') || '—' : '—';
          case 'financeiro': return m && m.financeiro_interno_bpo ? (ctx.FINANCEIRO_LABELS[m.financeiro_interno_bpo] || m.financeiro_interno_bpo) : '—';
          case 'bancos': return bancos.length ? bancos.join(', ') : '—';
          case 'sistemas': return m && (m.sistemas_utilizados || []).length ? m.sistemas_utilizados.join(', ') : '—';
          case 'situacaoAno': {
            const status = m ? m[`situacao_${anoAtualStr()}_status`] : null;
            return status ? (ctx.SITUACAO_LABELS[status] || status) : '—';
          }
          case 'nivel': return ctx.NIVEL_LABELS[m ? (m.nivel_atencao || 'baixo') : 'baixo'];
          case 'entregaveis': return m && (m.entregaveis_esperados || []).length ? m.entregaveis_esperados.join(', ') : '—';
          case 'obrigacoes': return m && (m.obrigacoes_acessorias || []).length ? m.obrigacoes_acessorias.join(', ') : '—';
          case 'particularidadesContabeis': return m && m.particularidades_contabeis ? m.particularidades_contabeis : '—';
          case 'particularidadesFiscais': return m && m.particularidades_fiscais ? m.particularidades_fiscais : '—';
          case 'particularidadesSocietarias': return m && m.particularidades_societarias ? m.particularidades_societarias : '—';
          case 'statusGrade': {
            const bucket = ctx.statusMensalPorEmpresa[codigo];
            const status = (bucket && bucket[`${filtros.gradeAno}-${filtros.gradeMes}`]) || 'sem_documentacao';
            return STATUS_GRADE_LABELS[status];
          }
          case 'qtdLancamentos': return lanc ? String(lanc.qtd) : '0';
          case 'ultimoLancamento': {
            if (!lanc || !lanc.ultimo) return '—';
            const data = parseDataLocalRelatorio(lanc.ultimo.data).toLocaleDateString('pt-BR');
            const autor = lanc.ultimo.criado_por_nome || lanc.ultimo.criado_por_email || 'desconhecido';
            return `${data} — ${truncar(lanc.ultimo.texto, 80)} (${autor})`;
          }
          default: return '—';
        }
      });
    });

    const { jsPDF } = window.jspdf;
    const orientacao = colunas.length >= 5 ? 'landscape' : 'portrait';
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientacao });
    const MARGEM = 10;
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(139, 58, 58);
    doc.roundedRect(MARGEM, MARGEM, pageW - MARGEM * 2, 16, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('Relatório — Departamento Contábil', MARGEM + 4, MARGEM + 10);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), pageW - MARGEM - 4, MARGEM + 10, { align: 'right' });

    doc.autoTable({
      head: [colunas.map((c) => c.label)],
      body: linhas,
      startY: MARGEM + 22,
      margin: { left: MARGEM, right: MARGEM },
      styles: { fontSize: 7.5, cellPadding: 1.6, textColor: [44, 62, 80] },
      headStyles: { fillColor: [139, 58, 58], textColor: 255 },
      theme: 'striped',
    });

    doc.save(`relatorio-departamento-contabil-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
```

Adicionar, no topo do arquivo (fora de qualquer função, junto às constantes),
uma cópia mínima de `parseDataLocal` (mesma lógica já usada em
`mapeamento-nivel-atencao.js`/`diario.js`, evitando acoplar este arquivo aos
outros dois):

```javascript
  function parseDataLocalRelatorio(str) {
    const [ano, mes, dia] = String(str).split('-').map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1);
  }
```

- [ ] **Step 5: Verificação manual**

Na tela de Relatórios: buscar sem nenhum filtro (deve trazer todas as
empresas ativas), desmarcar uma empresa da lista, marcar 2-3 colunas extras
(ex.: Bancos Utilizados, Status da Grade Mensal), clicar "Gerar PDF" e
conferir que o PDF baixado tem 1 linha por empresa marcada, com as colunas
certas e orientação (retrato/paisagem) de acordo com a quantidade de
colunas. Testar também com filtro de Banco e de Situação do Ano preenchidos.

- [ ] **Step 6: Commit**

```bash
git add diario-relatorios.js diario.html
git commit -m "feat(contabil): selecao de empresas/colunas e geracao de PDF na tela de Relatorios"
```

---

### Task 6: Revisão final, testes, push

- [ ] **Step 1: Checagem de sintaxe**

Run: `node --check index.html 2>/dev/null; node --check diario.js && node --check diario-relatorios.js && echo OK`

(index.html não é JS, ignorar; o importante é `diario.js` e
`diario-relatorios.js` sem erro de sintaxe.)

- [ ] **Step 2: Rodar os testes de lógica pura já existentes**

Run: `node test-mapeamento-nivel-atencao.js && node test-contabil-diario-util.js`
Expected: ambos terminam com "Todos os testes passaram.".

- [ ] **Step 3: Conferir `git status`/`git diff HEAD` antes de qualquer commit final**

Run: `git status --short -- "Projeto Onboarding Contabil/"`
Expected: nenhuma mudança fora do que foi commitado nas Tasks 1-5 (evitar o
problema já visto nesta sessão de outra sessão concorrente varrendo
mudanças — sempre `git add <arquivo>` explícito, nunca `-A`).

- [ ] **Step 4: Push**

```bash
git push
```
