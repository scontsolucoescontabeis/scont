# Benefícios VA/VT — Filtro de Empregados + Modo Manual Folgas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Substituir o select único de empregados por painel de checkboxes com multi-seleção; (2) inverter modo manual de Escalas para marcar folgas em vez de dias trabalhados.

**Architecture:** Dois ajustes independentes em `Projeto Beneficios/`. Task 1 é puramente em `script.js` + `index.html` (modo manual). Task 2 adiciona painel dropdown em `index.html`, lógica de filtro em `script.js` e estilos em `styles.css`.

**Tech Stack:** Vanilla JS ES2020, HTML/CSS — sem dependências novas.

---

## File Map

```
Projeto Beneficios/
├── index.html    ← Task 1: labels modo manual | Task 2: substituir select por painel checkbox
├── script.js     ← Task 1: diasFolga + calcManual + renderCalendario + toggleDiaManual
│                    Task 2: filtroEmps no state + empregadosFiltrados + buildGrade + setupFiltroPainel
└── styles.css    ← Task 2: estilos .filtro-wrap/.filtro-btn/.filtro-painel/.filtro-item
```

---

## Task 1: Modo Manual — Marcar Folgas (Escalas)

**Files:**
- Modify: `Projeto Beneficios/script.js` — state, calcManual, renderCalendario, toggleDiaManual, setupEscalasListeners
- Modify: `Projeto Beneficios/index.html` — labels e legenda do modo manual

### Passo 1 — Renomear `diasManuais` → `diasFolga` no state

Em `script.js` linha ~23, trocar:
```js
    diasManuais:      new Set(),
```
Por:
```js
    diasFolga:        new Set(),
```

### Passo 2 — Inverter `calcManual`

Localizar a função `calcManual` (atualmente linhas ~472-480) e substituir pelo código abaixo.  
A lógica antiga iterava `diasManuais` (dias trabalhados). A nova itera **todos os dias do mês** e exclui folgas e feriados.

```js
function calcManual(feriadosMes) {
  const todosDias = getDiasMes(S.escalas.mesRef);
  const trabalhados = new Set();
  let feriadosDescontados = 0;
  todosDias.forEach(d => {
    const ds = toLocalDateStr(d);
    if (isFeriado(ds, feriadosMes)) { feriadosDescontados++; return; }
    if (S.escalas.diasFolga.has(ds)) return;
    trabalhados.add(ds);
  });
  return { trabalhados, feriadosDescontados };
}
```

### Passo 3 — Inverter visual do modo manual em `renderCalendario`

Localizar o bloco `if (S.escalas.modo === 'manual')` dentro de `renderCalendario` (atualmente linhas ~527-535) e substituir pelo trecho abaixo.  
Antes: dia em `diasManuais` = verde. Depois: dia **não** em `diasFolga` = verde; dia em `diasFolga` = branco/cinza.

```js
    if (S.escalas.modo === 'manual') {
      if (eFer) {
        el.className = 'cal-day holiday';
        const fDesc = S.escalas.feriados.find(f => f.data === ddMm)?.descricao || 'Feriado';
        el.title = escHtml(fDesc);
      } else {
        const eFolga = S.escalas.diasFolga.has(dateStr);
        const base   = eFolga ? (dow === 0 || dow === 6 ? 'weekend' : '') : 'work';
        el.className = `cal-day manual-toggle${base ? ' ' + base : ''}`;
        el.addEventListener('click', () => toggleDiaManual(dateStr));
      }
```

### Passo 4 — Atualizar `toggleDiaManual`

Localizar a função `toggleDiaManual` (atualmente linhas ~550-554) e substituir:

```js
function toggleDiaManual(dateStr) {
  if (S.escalas.diasFolga.has(dateStr)) S.escalas.diasFolga.delete(dateStr);
  else S.escalas.diasFolga.add(dateStr);
  calcularEAtualizar();
}
```

### Passo 5 — Limpar `diasFolga` ao trocar mês

Em `setupEscalasListeners`, localizar o listener de `escMesRef` (atualmente linhas ~303-307):
```js
  $('escMesRef').addEventListener('change', () => {
    S.escalas.mesRef = $('escMesRef').value;
    renderFeriados();
    calcularEAtualizar();
  });
```
Adicionar o reset logo após a atribuição de `mesRef`:
```js
  $('escMesRef').addEventListener('change', () => {
    S.escalas.mesRef = $('escMesRef').value;
    S.escalas.diasFolga.clear();
    renderFeriados();
    calcularEAtualizar();
  });
```

### Passo 6 — Atualizar labels no HTML

Em `index.html` localizar o card do modo manual (linhas ~250-253):
```html
          <div id="modoManual" class="card hidden">
            <h3 class="card-title">🖱️ Selecione os dias manualmente</h3>
            <p class="hint-text" style="margin-bottom:10px">Clique nos dias para marcar como trabalhado</p>
          </div>
```
Substituir por:
```html
          <div id="modoManual" class="card hidden">
            <h3 class="card-title">🖱️ Marque as folgas</h3>
            <p class="hint-text" style="margin-bottom:10px">Clique nos dias de folga para marcá-los (todos começam como trabalhados)</p>
          </div>
```

Ainda em `index.html`, localizar a legenda do calendário (linha ~259):
```html
            <p class="hint-text" style="margin-top:8px">🟢 Trabalhado &nbsp; ⬜ Fim de semana &nbsp; 🔴 Feriado descontado</p>
```
Substituir por:
```html
            <p class="hint-text" style="margin-top:8px" id="calLegenda">🟢 Trabalhado &nbsp; ⬜ Fim de semana &nbsp; 🔴 Feriado descontado</p>
```

E em `script.js`, ao final de `calcularEAtualizar`, adicionar atualização da legenda conforme modo:
```js
  const legenda = $('calLegenda');
  if (legenda) {
    legenda.innerHTML = S.escalas.modo === 'manual'
      ? '🟢 Trabalhado &nbsp; ⬜ Folga marcada &nbsp; 🔴 Feriado descontado'
      : '🟢 Trabalhado &nbsp; ⬜ Fim de semana &nbsp; 🔴 Feriado descontado';
  }
```

### Passo 7 — Commit Task 1

```bash
git add "Projeto Beneficios/index.html" "Projeto Beneficios/script.js"
git commit -m "feat: modo manual Escalas — marcar folgas em vez de dias trabalhados"
```

Verificar: abrir Escalas → selecionar mês → aba Manual → todos os dias aparecem verdes → clicar num dia → fica branco/cinza → total diminui → clicar de novo → volta verde.

---

## Task 2: Filtro de Empregados — Painel Checkbox (Lançamentos)

**Files:**
- Modify: `Projeto Beneficios/index.html` — substituir select por painel dropdown
- Modify: `Projeto Beneficios/script.js` — state filtroEmps, helpers, buildGrade, listeners
- Modify: `Projeto Beneficios/styles.css` — estilos do painel

### Passo 1 — Substituir select no HTML

Em `index.html`, localizar (linhas ~91-96):
```html
        <div class="fg">
          <label for="lancEmpregados">Empregados</label>
          <select id="lancEmpregados">
            <option value="todos">Todos os empregados</option>
          </select>
        </div>
```
Substituir por:
```html
        <div class="fg" style="position:relative">
          <label>Empregados</label>
          <div class="filtro-wrap">
            <button type="button" id="btnFiltroEmp" class="filtro-btn">👥 Todos os empregados ▾</button>
            <div id="filtroPainel" class="filtro-painel hidden">
              <label class="filtro-item filtro-todos">
                <input type="checkbox" id="filtroTodos" checked> <span>Todos os empregados</span>
              </label>
              <div class="filtro-separador"></div>
              <div id="filtroLista"></div>
            </div>
          </div>
        </div>
```

### Passo 2 — Adicionar `filtroEmps` ao state

Em `script.js`, localizar o objeto `S.lancamento` (linhas ~13-16):
```js
  lancamento: {
    empresa: '', compPgto: '', mesRef: '',
    tipoProc: '11', linhas: []
  },
```
Adicionar `filtroEmps`:
```js
  lancamento: {
    empresa: '', compPgto: '', mesRef: '',
    tipoProc: '11', linhas: [],
    filtroEmps: new Set()
  },
```

### Passo 3 — Adicionar `empregadosFiltrados` e `atualizarBtnFiltro`

Adicionar após a função `loadFeriadosEmpresa` (ou em qualquer ponto antes de `buildGrade`):
```js
function empregadosFiltrados() {
  if (S.lancamento.filtroEmps.size === 0) return S.empregados;
  return S.empregados.filter(e => S.lancamento.filtroEmps.has(e.codigo_empregado));
}

function atualizarBtnFiltro() {
  const n = S.lancamento.filtroEmps.size;
  $('btnFiltroEmp').textContent = n === 0
    ? '👥 Todos os empregados ▾'
    : `👥 ${n} selecionado(s) ▾`;
}
```

### Passo 4 — Adicionar `renderFiltroPainel`

Adicionar após `atualizarBtnFiltro`:
```js
function renderFiltroPainel() {
  const lista = $('filtroLista');
  if (!lista) return;
  lista.innerHTML = '';
  const nenhumFiltro = S.lancamento.filtroEmps.size === 0;

  const todosCheck = $('filtroTodos');
  todosCheck.checked       = nenhumFiltro;
  todosCheck.indeterminate = false;

  S.empregados.forEach(emp => {
    const checked = nenhumFiltro || S.lancamento.filtroEmps.has(emp.codigo_empregado);
    const label = document.createElement('label');
    label.className = 'filtro-item';
    label.innerHTML =
      `<input type="checkbox" data-cod="${escHtml(emp.codigo_empregado)}" ${checked ? 'checked' : ''}>` +
      ` <span>${escHtml(emp.codigo_empregado)} — ${escHtml(emp.nome_empregado)}</span>`;
    lista.appendChild(label);
  });

  atualizarBtnFiltro();
}
```

### Passo 5 — Adicionar `setupFiltroPainel`

Adicionar após `renderFiltroPainel`:
```js
function setupFiltroPainel() {
  $('btnFiltroEmp').addEventListener('click', e => {
    e.stopPropagation();
    $('filtroPainel').classList.toggle('hidden');
  });

  document.addEventListener('click', e => {
    if (!$('filtroPainel').contains(e.target) && e.target !== $('btnFiltroEmp')) {
      $('filtroPainel').classList.add('hidden');
    }
  });

  $('filtroTodos').addEventListener('change', () => {
    if ($('filtroTodos').checked) {
      S.lancamento.filtroEmps.clear();
    } else {
      S.empregados.forEach(emp => S.lancamento.filtroEmps.add(emp.codigo_empregado));
    }
    renderFiltroPainel();
    buildGrade();
    renderGrade();
  });

  $('filtroLista').addEventListener('change', e => {
    const cb = e.target.closest('input[type=checkbox]');
    if (!cb) return;
    const cod = cb.dataset.cod;
    if (S.lancamento.filtroEmps.size === 0) {
      S.empregados.forEach(emp => S.lancamento.filtroEmps.add(emp.codigo_empregado));
    }
    if (cb.checked) S.lancamento.filtroEmps.add(cod);
    else            S.lancamento.filtroEmps.delete(cod);
    if (S.lancamento.filtroEmps.size === S.empregados.length) S.lancamento.filtroEmps.clear();

    const n = S.lancamento.filtroEmps.size;
    const todosCheck = $('filtroTodos');
    todosCheck.checked       = n === 0;
    todosCheck.indeterminate = n > 0 && n < S.empregados.length;

    atualizarBtnFiltro();
    buildGrade();
    renderGrade();
  });
}
```

### Passo 6 — Atualizar `buildGrade` para usar `empregadosFiltrados`

Localizar `buildGrade` (linhas ~687-708). Trocar:
```js
  S.lancamento.linhas = S.empregados.map(emp => {
```
Por:
```js
  S.lancamento.linhas = empregadosFiltrados().map(emp => {
```

### Passo 7 — Resetar filtro e renderizar painel na troca de empresa

No listener de `lancEmpresa` dentro de `setupLancamentosListeners`, após a linha:
```js
    await Promise.all([loadConfig(emp), loadEmpregados(emp), loadIndividuais(emp)]);
```
Adicionar:
```js
    S.lancamento.filtroEmps.clear();
    renderFiltroPainel();
```

### Passo 8 — Chamar `setupFiltroPainel` na inicialização

Em `setupLancamentosListeners`, adicionar ao final da função:
```js
  setupFiltroPainel();
```

### Passo 9 — Adicionar estilos em `styles.css`

Adicionar ao final de `styles.css`:
```css
/* ── Filtro de Empregados ── */
.filtro-wrap { position: relative; }
.filtro-btn { width: 100%; padding: 8px 10px; border: 1.5px solid #E0E6ED; border-radius: 6px; font-size: 13px; font-family: inherit; color: #2C3E50; background: #fff; cursor: pointer; text-align: left; transition: border-color .15s; }
.filtro-btn:hover, .filtro-btn:focus { border-color: #8B3A3A; outline: none; }
.filtro-painel { position: absolute; top: calc(100% + 4px); left: 0; right: 0; min-width: 260px; background: #fff; border: 1.5px solid #E0E6ED; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,.1); z-index: 100; max-height: 200px; overflow-y: auto; }
.filtro-item { display: flex; align-items: center; gap: 8px; padding: 7px 12px; font-size: 12px; cursor: pointer; user-select: none; }
.filtro-item:hover { background: #F8F9FA; }
.filtro-item input[type=checkbox] { flex-shrink: 0; accent-color: #8B3A3A; width: 14px; height: 14px; cursor: pointer; }
.filtro-todos { font-weight: 600; color: #8B3A3A; position: sticky; top: 0; background: #fff; }
.filtro-separador { height: 1px; background: #E0E6ED; margin: 2px 0; }
```

### Passo 10 — Commit Task 2

```bash
git add "Projeto Beneficios/index.html" "Projeto Beneficios/script.js" "Projeto Beneficios/styles.css"
git commit -m "feat: filtro de empregados (painel checkbox) — Lançamentos VA/VT"
```

Verificar:
- Selecionar empresa → painel mostra "Todos os empregados" + lista de checkboxes todos marcados
- Clicar no botão → painel abre/fecha
- Desmarcar 1 empregado → grade atualiza sem aquele empregado; botão mostra "N selecionado(s)"
- Clicar fora → painel fecha
- Desmarcar "Todos" → todos os individuais ficam marcados mas controlados individualmente
- Marcar todos individualmente → volta para "Todos os empregados"
