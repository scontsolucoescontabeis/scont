# Gerar Folhas de Ponto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Gerar Folhas de Ponto" tool to the Controle de Frequência app that generates, per selected empresa, one PDF containing a blank Folha Individual de Ponto page per active employee, reusing the escala/jornada/período de apuração data already in the system.

**Architecture:** A new pure calculation module (`folha-ponto-calculo.js`, mirrors the style of `escala-calculo.js`) resolves per-day expected schedule text from `rh_jornada_trabalho` rows and the escala's day classification. `index.html` gets a new sidebar item + screen (`folhaPontoScreen`) cloning the Grupos/Empresas selector pattern already used by `escalaScreen`. `script.js` gets the screen wiring, a Supabase data-fetch function, and a jsPDF+autoTable PDF builder (one call per empregado page), bundled with JSZip when more than one empresa is selected.

**Tech Stack:** Vanilla JS, Supabase JS client, jsPDF + jspdf-autotable (already loaded in `index.html`), JSZip (already loaded), Node `assert` for the pure-module tests (matches `test-escala-calculo.js` convention — no test framework/package.json in this repo).

## Global Constraints

- No new SQL/migrations — reuse `rh_empregados`, `rh_empresas`, `rh_escala_trabalho`, `rh_ferias_calculadas`, `rh_escala_excecoes`, `rh_config_rubricas_txt`, `rh_jornada_trabalho` exactly as they exist today.
- Employee filter matches `gerarEscala`: `situacao === 'Trabalhando'` AND `tipo_empregado === 'Empregado'`.
- Field mapping: Função ← `desc_cargo`; Departamento ← `desc_dpto`; Bairro (label) ← `rh_empresas.municipio`.
- No "Horário:" fixed header line — schedule appears per-row as "Horário Previsto", sourced from `rh_jornada_trabalho`, not from `state.jornada`/`jornadaSexta`/`jornadaSabado` (those are the Folha de Ponto's own daily-hours-quota fields, unrelated).
- PDF: jsPDF + autoTable, A4 landscape, one page per empregado.
- Dia `folga` (não férias) → linha sombreada, colunas em branco. Dia `ferias` → texto "FÉRIAS" nas colunas preenchíveis, sem sombreado.
- Download: 1 empresa → PDF direto; >1 empresa → zip com 1 PDF por empresa (mesmo padrão de `baixarModelosGrupo`).
- Spec: `docs/superpowers/specs/2026-07-31-gerar-folhas-de-ponto-design.md`.

---

### Task 1: Pure calculation module — horário previsto por dia

**Files:**
- Create: `folha-ponto-calculo.js`
- Test: `test-folha-ponto-calculo.js`

**Interfaces:**
- Consumes: nothing (pure module, no dependency on `escala-calculo.js` at runtime — takes already-computed `dias` arrays as plain data)
- Produces:
  - `_DIA_ABREV_PARA_CHAVE` — object mapping `'Dom'|'Seg'|'Ter'|'Qua'|'Qui'|'Sex'|'Sab'` → `'domingo'|'segunda'|...`
  - `agruparJornadaPorDiaSemana(linhasJornada)` — `(Array<{dia_semana, entrada, intervalo_inicio, intervalo_fim, saida}>) => { [dia_semana]: registro }`
  - `formatarHorarioJornadaDia(registro)` — `(registro|null) => string` (`'—'` when null; `'HH:MM-HH:MM'` when no interval; `'HH:MM-HH:MM / HH:MM-HH:MM'` when interval present)
  - `montarLinhasFolhaPonto(dias, jornadaPorDiaSemana)` — `(Array<{data, diaSemana, tipo, ferias, excecao}>, object) => Array<{data, diaSemana, tipo, ferias, excecao, horarioPrevisto}>` — dias `folga` (não trabalho) sempre recebem `horarioPrevisto: '—'`; dias `trabalho` sem registro de jornada para aquele dia da semana também recebem `'—'`.

- [ ] **Step 1: Write the failing tests**

Create `test-folha-ponto-calculo.js`:

```js
const assert = require('node:assert');
const {
    _DIA_ABREV_PARA_CHAVE, agruparJornadaPorDiaSemana,
    formatarHorarioJornadaDia, montarLinhasFolhaPonto
} = require('./folha-ponto-calculo.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

teste('_DIA_ABREV_PARA_CHAVE mapeia todas as abreviações', () => {
    assert.strictEqual(_DIA_ABREV_PARA_CHAVE.Seg, 'segunda');
    assert.strictEqual(_DIA_ABREV_PARA_CHAVE.Sab, 'sabado');
    assert.strictEqual(_DIA_ABREV_PARA_CHAVE.Dom, 'domingo');
});

teste('agruparJornadaPorDiaSemana indexa registros pelo dia_semana', () => {
    const linhas = [
        { dia_semana: 'segunda', entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '17:00' },
        { dia_semana: 'sexta', entrada: '08:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', saida: '16:48' },
    ];
    const mapa = agruparJornadaPorDiaSemana(linhas);
    assert.strictEqual(mapa.segunda.saida, '17:00');
    assert.strictEqual(mapa.sexta.intervalo_fim, '13:00');
    assert.strictEqual(mapa.terca, undefined);
});

teste('agruparJornadaPorDiaSemana lida com lista vazia/nula', () => {
    assert.deepStrictEqual(agruparJornadaPorDiaSemana([]), {});
    assert.deepStrictEqual(agruparJornadaPorDiaSemana(null), {});
});

teste('formatarHorarioJornadaDia: sem registro retorna travessão', () => {
    assert.strictEqual(formatarHorarioJornadaDia(null), '—');
});

teste('formatarHorarioJornadaDia: sem intervalo', () => {
    assert.strictEqual(
        formatarHorarioJornadaDia({ entrada: '06:00', intervalo_inicio: null, intervalo_fim: null, saida: '15:48' }),
        '06:00-15:48'
    );
});

teste('formatarHorarioJornadaDia: com intervalo', () => {
    assert.strictEqual(
        formatarHorarioJornadaDia({ entrada: '08:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', saida: '17:48' }),
        '08:00-12:00 / 13:00-17:48'
    );
});

teste('montarLinhasFolhaPonto: dia de trabalho com jornada cadastrada mostra horário', () => {
    const dias = [{ data: '03/08/2026', diaSemana: 'Seg', tipo: 'trabalho', ferias: false, excecao: false }];
    const jornada = { segunda: { entrada: '08:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', saida: '17:48' } };
    const linhas = montarLinhasFolhaPonto(dias, jornada);
    assert.strictEqual(linhas[0].horarioPrevisto, '08:00-12:00 / 13:00-17:48');
    assert.strictEqual(linhas[0].data, '03/08/2026');
});

teste('montarLinhasFolhaPonto: dia de folga sempre travessão mesmo com jornada cadastrada naquele dia da semana', () => {
    const dias = [{ data: '08/08/2026', diaSemana: 'Sab', tipo: 'folga', ferias: false, excecao: false }];
    const jornada = { sabado: { entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '12:00' } };
    const linhas = montarLinhasFolhaPonto(dias, jornada);
    assert.strictEqual(linhas[0].horarioPrevisto, '—');
});

teste('montarLinhasFolhaPonto: dia de trabalho sem jornada cadastrada para aquele dia da semana', () => {
    const dias = [{ data: '04/08/2026', diaSemana: 'Ter', tipo: 'trabalho', ferias: false, excecao: false }];
    const linhas = montarLinhasFolhaPonto(dias, {});
    assert.strictEqual(linhas[0].horarioPrevisto, '—');
});

teste('montarLinhasFolhaPonto: preserva ferias e excecao no retorno', () => {
    const dias = [{ data: '10/08/2026', diaSemana: 'Seg', tipo: 'folga', ferias: true, excecao: false }];
    const linhas = montarLinhasFolhaPonto(dias, {});
    assert.strictEqual(linhas[0].ferias, true);
});

console.log(`\n${testesExecutados} teste(s) executado(s) com sucesso.`);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test-folha-ponto-calculo.js`
Expected: FAIL — `Cannot find module './folha-ponto-calculo.js'`

- [ ] **Step 3: Write the implementation**

Create `folha-ponto-calculo.js`:

```js
/**
 * Cálculo do "Horário Previsto" por dia na Folha de Ponto gerada.
 * Módulo puro: sem DOM, sem Supabase. Combina os dias já classificados por
 * calcularResumoMes (escala-calculo.js) com o horário de rh_jornada_trabalho
 * (por dia da semana) para decidir o texto exibido em cada linha da folha.
 */

const _DIA_ABREV_PARA_CHAVE = {
    Dom: 'domingo', Seg: 'segunda', Ter: 'terca', Qua: 'quarta',
    Qui: 'quinta', Sex: 'sexta', Sab: 'sabado'
};

// linhasJornada: linhas de rh_jornada_trabalho de UM empregado (todas as dia_semana).
function agruparJornadaPorDiaSemana(linhasJornada) {
    const porDia = {};
    (linhasJornada || []).forEach(l => { porDia[l.dia_semana] = l; });
    return porDia;
}

function formatarHorarioJornadaDia(registro) {
    if (!registro) return '—';
    if (registro.intervalo_inicio && registro.intervalo_fim) {
        return `${registro.entrada}-${registro.intervalo_inicio} / ${registro.intervalo_fim}-${registro.saida}`;
    }
    return `${registro.entrada}-${registro.saida}`;
}

// dias: saída de calcularResumoMes(...).dias — [{data, diaSemana, tipo, ferias, excecao}]
// jornadaPorDiaSemana: saída de agruparJornadaPorDiaSemana(...)
function montarLinhasFolhaPonto(dias, jornadaPorDiaSemana) {
    return (dias || []).map(d => {
        const chaveDia = _DIA_ABREV_PARA_CHAVE[d.diaSemana] || null;
        const horarioPrevisto = (d.tipo === 'trabalho' && chaveDia)
            ? formatarHorarioJornadaDia((jornadaPorDiaSemana || {})[chaveDia])
            : '—';
        return { ...d, horarioPrevisto };
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _DIA_ABREV_PARA_CHAVE,
        agruparJornadaPorDiaSemana,
        formatarHorarioJornadaDia,
        montarLinhasFolhaPonto
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test-folha-ponto-calculo.js`
Expected: 9 teste(s) executado(s) com sucesso, no FAIL lines.

- [ ] **Step 5: Commit**

```bash
git add folha-ponto-calculo.js test-folha-ponto-calculo.js
git commit -m "feat(rh): modulo puro de horario previsto para Gerar Folhas de Ponto"
```

---

### Task 2: HTML — sidebar item e tela `folhaPontoScreen`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: none (markup only)
- Produces: DOM ids consumed by Task 3/4/5 —
  `folhaPontoScreen`, `folhaPontoCompetencia`, `folhaPontoBuscaGrupo`, `folhaPontoListaGrupos`,
  `folhaPontoBuscaEmpresa`, `folhaPontoListaEmpresas`, `folhaPontoEmpresasSelecionadasInfo`,
  `folhaPontoResultadoContainer`, `folhaPontoResultadoInfo`, `folhaPontoListaEmpregados`,
  `folhaPontoBtnBaixar`, classes `folhaPonto-grupo-check`, `folhaPonto-emp-check`.
  Global functions referenced from markup (implemented in Task 3/4):
  `_filtrarListaGruposFolhaPonto()`, `_selecionarTodasEmpresasFolhaPonto(bool)`,
  `_filtrarListaEmpresasFolhaPonto()`, `gerarPreviaFolhaPonto()`, `baixarPdfsFolhaPonto()`.

- [ ] **Step 1: Add the sidebar button**

In `index.html`, inside `<nav class="sidebar-nav">`, right after the "Gerar Escala" button (currently ends at line 60 with `</button>`) and before the "Conversor de Folha" `<a>`:

```html
        <button class="sidebar-item" onclick="mostrarTela('folhaPontoScreen')">
            <span class="sidebar-item-icon">🖨️</span> Gerar Folhas de Ponto
        </button>
```

- [ ] **Step 2: Add the screen markup**

Right after the closing `</div>` of `<!-- TELA DE GERAR ESCALA -->` (`escalaScreen`, currently ends right before the line `    </div>` / `</div><!-- /main-content -->`), insert:

```html
        <!-- TELA DE GERAR FOLHAS DE PONTO -->
        <div id="folhaPontoScreen" style="display: none;">
            <div style="margin-bottom:20px;">
                <h2 style="color: var(--primary-color); margin:0;">🖨️ Gerar Folhas de Ponto</h2>
                <p style="color: var(--text-secondary); font-size:13px; margin-top:6px;">
                    Gera a Folha Individual de Ponto em branco (uma página por empregado, pronta para
                    assinatura) da competência ou do período de apuração customizado da empresa. Dias de
                    folga (pela escala configurada em "Gerar Escala") aparecem sombreados; dias de férias
                    já vêm marcados como "FÉRIAS". O horário previsto de cada dia trabalhado vem da jornada
                    cadastrada em Administração RH.
                </p>
            </div>

            <div style="border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:16px;">
                <div class="form-group" style="max-width:220px;">
                    <label for="folhaPontoCompetencia">Competência (MM/AAAA)</label>
                    <input type="text" id="folhaPontoCompetencia" placeholder="MM/AAAA" maxlength="7"
                        oninput="this.value = formatarCompetencia(this.value);">
                </div>

                <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
                    <label style="font-weight:600; font-size:13px; color: var(--text-primary); margin:0;">Grupos de Empresas (opcional)</label>
                    <input type="text" id="folhaPontoBuscaGrupo" placeholder="🔍 Buscar grupo..." style="flex:1; min-width:160px;"
                        oninput="_filtrarListaGruposFolhaPonto()">
                </div>
                <div id="folhaPontoListaGrupos" style="max-height:120px; overflow-y:auto; border:1px solid var(--border-color); border-radius:8px; padding:8px 12px; margin-bottom:16px; display:flex; flex-direction:column; gap:4px;"></div>

                <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
                    <label style="font-weight:600; font-size:13px; color: var(--text-primary); margin:0;">Empresas</label>
                    <button type="button" class="btn btn-secondary btn-small" onclick="_selecionarTodasEmpresasFolhaPonto(true)">Todas</button>
                    <button type="button" class="btn btn-secondary btn-small" onclick="_selecionarTodasEmpresasFolhaPonto(false)">Nenhuma</button>
                    <input type="text" id="folhaPontoBuscaEmpresa" placeholder="🔍 Buscar empresa..." style="flex:1; min-width:180px;"
                        oninput="_filtrarListaEmpresasFolhaPonto()">
                </div>
                <div id="folhaPontoListaEmpresas" style="max-height:180px; overflow-y:auto; border:1px solid var(--border-color); border-radius:8px; padding:8px 12px; display:flex; flex-direction:column; gap:4px;"></div>
                <p id="folhaPontoEmpresasSelecionadasInfo" style="font-size:12px; color: var(--text-secondary); margin:8px 0 0;">Nenhuma empresa selecionada.</p>

                <button type="button" class="btn btn-primary" style="margin-top:16px;" onclick="gerarPreviaFolhaPonto()">🔎 Gerar Prévia</button>
            </div>

            <div id="folhaPontoResultadoContainer" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                    <span id="folhaPontoResultadoInfo" style="font-size:13px; color: var(--text-secondary);"></span>
                    <button type="button" class="btn btn-primary" id="folhaPontoBtnBaixar" onclick="baixarPdfsFolhaPonto()">📥 Baixar PDF(s)</button>
                </div>
                <div id="folhaPontoListaEmpregados"></div>
            </div>
        </div>
```

- [ ] **Step 3: Add the two new `<script>` includes**

In `index.html`, right before `<script src="escala-calculo.js"></script>` add:

```html
    <script src="folha-ponto-calculo.js"></script>
```

(keep `escala-calculo.js` and `script.js` after it, same order as today).

- [ ] **Step 4: Manual check**

Open `index.html` in a browser (or run the project's normal local server), click "Gerar Folhas de Ponto" in the sidebar — the screen should show (empty lists are fine, Task 3 wires the data). No console errors about missing elements other than the not-yet-defined `_filtrarListaGruposFolhaPonto` etc. (expected until Task 3).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(rh): tela Gerar Folhas de Ponto (markup)"
```

---

### Task 3: script.js — tela, seletor de grupos/empresas

**Files:**
- Modify: `script.js`

**Interfaces:**
- Consumes: DOM ids from Task 2; `state.empresas` (`{codigo_empresa, nome_empresa, status_situacao}[]`, already populated by `carregarEmpresas()`); `supabaseClient` global.
- Produces:
  - `_iniciarTelaFolhaPonto()` — called by `mostrarTela('folhaPontoScreen')`
  - `_filtrarListaGruposFolhaPonto()`, `_selecionarTodasEmpresasFolhaPonto(marcar)`, `_filtrarListaEmpresasFolhaPonto()` — referenced by Task 2 markup
  - `_gruposFolhaPontoCache` (array `{id, nome_grupo, qtdEmpresas}`), `_itensGruposFolhaPontoCache` (map `grupo_id -> Set<codigo_empresa>`) — module-level `let`s, read by Task 4's `gerarPreviaFolhaPonto` only indirectly (it reads the checked checkboxes in the DOM, not these caches directly)

- [ ] **Step 1: Register the new screen in `mostrarTela`**

In `script.js`, function `mostrarTela` (around line 5146): add `folhaPontoScreen` to the hide-list, the init dispatch, and the "sem header padrão" list:

```js
function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('gruposScreen').style.display = 'none';
    document.getElementById('beneficiosScreen').style.display = 'none';
    document.getElementById('escalaScreen').style.display = 'none';
    document.getElementById('folhaPontoScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';
    if (telaId === 'gruposScreen') carregarGrupos();
    if (telaId === 'beneficiosScreen') _iniciarTelaBeneficios();
    if (telaId === 'escalaScreen') _iniciarTelaEscala();
    if (telaId === 'folhaPontoScreen') _iniciarTelaFolhaPonto();

    const telasSemHeaderPadrao = ['selectionScreen', 'gruposScreen', 'beneficiosScreen', 'escalaScreen', 'folhaPontoScreen'];
    ...
```

(leave everything else in the function untouched)

- [ ] **Step 2: Add the screen init + grupo/empresa selector functions**

Right after the closing `}` of `_atualizarResumoEmpresasSelecionadasEscala()` (around line 4699, right before the `_parsearCamposEscala` comment), add a new section:

```js
// ===== GERAR FOLHAS DE PONTO =====

function _iniciarTelaFolhaPonto() {
    document.getElementById('folhaPontoResultadoContainer').style.display = 'none';
    document.getElementById('folhaPontoListaEmpregados').innerHTML = '';
    document.getElementById('folhaPontoBuscaEmpresa').value = '';
    _renderizarListaEmpresasFolhaPonto(state.empresas);
    _atualizarResumoEmpresasSelecionadasFolhaPonto();
    _carregarGruposParaFolhaPonto();
}

let _gruposFolhaPontoCache = [];
let _itensGruposFolhaPontoCache = {};

async function _carregarGruposParaFolhaPonto() {
    try {
        const [{ data: grupos, error: errG }, { data: itens, error: errI }] = await Promise.all([
            supabaseClient.from('rh_grupos_empresas').select('id, nome_grupo').order('nome_grupo', { ascending: true }),
            supabaseClient.from('rh_grupos_empresas_itens').select('grupo_id, codigo_empresa'),
        ]);
        if (errG) throw errG;
        if (errI) throw errI;

        _itensGruposFolhaPontoCache = {};
        (itens || []).forEach(it => {
            (_itensGruposFolhaPontoCache[it.grupo_id] ??= new Set()).add(it.codigo_empresa);
        });
        _gruposFolhaPontoCache = (grupos || []).map(g => ({
            id: g.id,
            nome_grupo: g.nome_grupo,
            qtdEmpresas: _itensGruposFolhaPontoCache[g.id]?.size || 0,
        }));

        document.getElementById('folhaPontoBuscaGrupo').value = '';
        _renderizarListaGruposFolhaPonto(_gruposFolhaPontoCache);
    } catch (erro) {
        console.error('Erro ao carregar grupos de empresas:', erro);
    }
}

function _renderizarListaGruposFolhaPonto(grupos) {
    const container = document.getElementById('folhaPontoListaGrupos');
    if (!container) return;
    if (!grupos || grupos.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">Nenhum grupo encontrado.</span>';
        return;
    }
    container.innerHTML = grupos.map(g => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
            <input type="checkbox" class="folhaPonto-grupo-check" value="${g.id}" onchange="_aplicarGruposFolhaPonto()">
            ${g.nome_grupo} <span style="color: var(--text-secondary);">(${g.qtdEmpresas})</span>
        </label>
    `).join('');
}

function _filtrarListaGruposFolhaPonto() {
    const termo = (document.getElementById('folhaPontoBuscaGrupo').value || '').toLowerCase().trim();
    const marcados = new Set(Array.from(document.querySelectorAll('.folhaPonto-grupo-check:checked')).map(cb => cb.value));
    const lista = termo
        ? _gruposFolhaPontoCache.filter(g => g.nome_grupo.toLowerCase().includes(termo))
        : _gruposFolhaPontoCache;
    _renderizarListaGruposFolhaPonto(lista);
    marcados.forEach(id => {
        const cb = document.querySelector(`.folhaPonto-grupo-check[value="${id}"]`);
        if (cb) cb.checked = true;
    });
}

function _aplicarGruposFolhaPonto() {
    const idsMarcados = Array.from(document.querySelectorAll('.folhaPonto-grupo-check:checked')).map(cb => cb.value);
    if (idsMarcados.length === 0) return;

    const codigosParaMarcar = new Set(
        Array.from(document.querySelectorAll('.folhaPonto-emp-check:checked')).map(cb => cb.value)
    );
    idsMarcados.forEach(id => {
        (_itensGruposFolhaPontoCache[id] || new Set()).forEach(codigo => codigosParaMarcar.add(codigo));
    });

    document.getElementById('folhaPontoBuscaEmpresa').value = '';
    _renderizarListaEmpresasFolhaPonto(state.empresas);
    document.querySelectorAll('.folhaPonto-emp-check').forEach(cb => {
        cb.checked = codigosParaMarcar.has(cb.value);
    });
    _atualizarResumoEmpresasSelecionadasFolhaPonto();
}

function _renderizarListaEmpresasFolhaPonto(empresas) {
    const container = document.getElementById('folhaPontoListaEmpresas');
    if (!empresas || empresas.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">Nenhuma empresa encontrada.</span>';
        return;
    }
    container.innerHTML = empresas.map(e => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
            <input type="checkbox" class="folhaPonto-emp-check" value="${e.codigo_empresa}" onchange="_atualizarResumoEmpresasSelecionadasFolhaPonto()">
            <span style="font-family:monospace; color:var(--primary-color); font-weight:600;">${e.codigo_empresa}</span> ${e.nome_empresa}
        </label>
    `).join('');
}

function _filtrarListaEmpresasFolhaPonto() {
    const termo = (document.getElementById('folhaPontoBuscaEmpresa').value || '').toLowerCase().trim();
    const marcados = new Set(Array.from(document.querySelectorAll('.folhaPonto-emp-check:checked')).map(cb => cb.value));
    const lista = termo
        ? state.empresas.filter(e => e.nome_empresa.toLowerCase().includes(termo) || e.codigo_empresa.toLowerCase().includes(termo))
        : state.empresas;
    _renderizarListaEmpresasFolhaPonto(lista);
    marcados.forEach(codigo => {
        const cb = document.querySelector(`.folhaPonto-emp-check[value="${codigo}"]`);
        if (cb) cb.checked = true;
    });
}

function _selecionarTodasEmpresasFolhaPonto(marcar) {
    document.querySelectorAll('.folhaPonto-emp-check').forEach(cb => { cb.checked = marcar; });
    _atualizarResumoEmpresasSelecionadasFolhaPonto();
}

function _atualizarResumoEmpresasSelecionadasFolhaPonto() {
    const info = document.getElementById('folhaPontoEmpresasSelecionadasInfo');
    if (!info) return;
    const marcados = Array.from(document.querySelectorAll('.folhaPonto-emp-check:checked'));
    if (marcados.length === 0) {
        info.textContent = 'Nenhuma empresa selecionada.';
        return;
    }
    const nomes = marcados.map(cb => {
        const emp = state.empresas.find(e => e.codigo_empresa === cb.value);
        return `${cb.value} - ${emp?.nome_empresa || cb.value}`;
    });
    info.textContent = `${marcados.length} empresa(s) selecionada(s): ${nomes.join(', ')}`;
}
```

- [ ] **Step 3: Manual check**

Reload `index.html`, open "Gerar Folhas de Ponto" — the Empresas list should populate (same companies as Gerar Escala), group filter/search should work, "Todas"/"Nenhuma" should toggle checkboxes and update the summary text.

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "feat(rh): tela e seletor de empresas/grupos de Gerar Folhas de Ponto"
```

---

### Task 4: script.js — busca de dados e prévia (`gerarPreviaFolhaPonto`)

**Files:**
- Modify: `script.js`

**Interfaces:**
- Consumes: `calcularResumoMes`, `_parsearCamposEscala` (already in `script.js`/`escala-calculo.js`), `_buscarConfigRubricas`, `_resolverPeriodoApuracao` (`script.js`), `agruparJornadaPorDiaSemana`, `montarLinhasFolhaPonto` (`folha-ponto-calculo.js`, Task 1), `validarCompetencia`, `formatarCompetencia` (`script.js`), `mostrarMensagem`, `fecharModalMensagem` (`script.js`).
- Produces:
  - `async function gerarPreviaFolhaPonto()` — reads `#folhaPontoCompetencia` + checked `.folhaPonto-emp-check`, populates `state._folhaPontoDados` (see shape below) and calls `_renderizarListaFolhaPonto()`
  - `state._folhaPontoDados`: `{ competencia: string, empresas: Array<{ codigo_empresa, nome_empresa, cnpj, endereco, municipio, cidade, uf, cep, periodoTexto: string, empregados: Array<{ codigo_empregado, nome_empregado, desc_cargo, desc_dpto, linhas: Array<{data, diaSemana, tipo, ferias, excecao, horarioPrevisto}> }> }> }` — consumed by Task 5's PDF builder
  - `_renderizarListaFolhaPonto()` — fills `#folhaPontoListaEmpregados` / `#folhaPontoResultadoInfo` / shows `#folhaPontoResultadoContainer`

- [ ] **Step 1: Add a period-label helper**

Right after `_textoPeriodoApuracao` (around line 2032 in `script.js`), add:

```js
// Rótulo de período para o cabeçalho da Folha de Ponto: "MM/AAAA" no padrão, ou o
// intervalo completo quando a empresa usa período de apuração customizado.
function _labelPeriodoFolhaPonto(competencia, diaInicio, diaFim) {
    if (!Number.isInteger(diaInicio) || !Number.isInteger(diaFim)) return competencia;
    const dias = gerarDiasDoMes(competencia, diaInicio, diaFim);
    if (dias.length === 0) return competencia;
    return `${dias[0].data} a ${dias.at(-1).data}`;
}
```

- [ ] **Step 2: Add `gerarPreviaFolhaPonto` and the renderer**

At the end of the "GERAR FOLHAS DE PONTO" section added in Task 3 (after `_atualizarResumoEmpresasSelecionadasFolhaPonto`), add:

```js
async function gerarPreviaFolhaPonto() {
    const comp = document.getElementById('folhaPontoCompetencia').value;
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe uma competência válida (MM/AAAA).'); return; }
    const codigosEmpresas = Array.from(document.querySelectorAll('.folhaPonto-emp-check:checked')).map(cb => cb.value);
    if (codigosEmpresas.length === 0) { mostrarMensagem('Aviso', 'Selecione pelo menos uma empresa.'); return; }

    mostrarMensagem('Aguarde', 'Montando as folhas de ponto...');
    try {
        const [
            { data: empresasData, error: errEmp },
            { data: empregadosData, error: errFunc },
            { data: escalasData, error: errEsc },
            { data: feriasData, error: errFer },
            { data: excecoesData, error: errExc },
            { data: jornadaData, error: errJor },
        ] = await Promise.all([
            supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, cnpj, endereco, municipio, cidade, uf, cep').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_empregados').select('codigo_empresa, codigo_empregado, nome_empregado, situacao, tipo_empregado, desc_cargo, desc_dpto').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_escala_trabalho').select('*').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_ferias_calculadas').select('codigo_empresa, codigo_empregado, ferias_inicio, ferias_fim').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_escala_excecoes').select('codigo_empresa, codigo_empregado, data').in('codigo_empresa', codigosEmpresas),
            supabaseClient.from('rh_jornada_trabalho').select('codigo_empresa, codigo_empregado, dia_semana, entrada, intervalo_inicio, intervalo_fim, saida').in('codigo_empresa', codigosEmpresas),
        ]);
        if (errEmp) throw errEmp;
        if (errFunc) throw errFunc;
        if (errEsc) throw errEsc;
        if (errFer) throw errFer;
        if (errExc) throw errExc;
        if (errJor) throw errJor;

        const escalasMapa = {};
        (escalasData || []).forEach(e => { escalasMapa[`${e.codigo_empresa}_${e.codigo_empregado}`] = _parsearCamposEscala(e); });

        const feriasMapa = {};
        (feriasData || []).forEach(f => {
            const chave = `${f.codigo_empresa}_${f.codigo_empregado}`;
            (feriasMapa[chave] ??= []).push({ inicio: f.ferias_inicio, fim: f.ferias_fim });
        });

        const excecoesMapa = {};
        (excecoesData || []).forEach(e => {
            const chave = `${e.codigo_empresa}_${e.codigo_empregado}`;
            (excecoesMapa[chave] ??= []).push(e.data);
        });

        const jornadaMapa = {};
        (jornadaData || []).forEach(j => {
            const chave = `${j.codigo_empresa}_${j.codigo_empregado}`;
            (jornadaMapa[chave] ??= []).push(j);
        });

        const empregadosFiltrados = (empregadosData || []).filter(e =>
            (e.situacao || '').trim() === 'Trabalhando' && (e.tipo_empregado || '').trim() === 'Empregado'
        );

        const empresasComEmpregados = [];
        const avisos = [];

        for (const codigoEmpresa of codigosEmpresas) {
            const empresaInfo = (empresasData || []).find(e => e.codigo_empresa === codigoEmpresa);
            const nomeEmpresa = empresaInfo?.nome_empresa || state.empresas.find(e => e.codigo_empresa === codigoEmpresa)?.nome_empresa || codigoEmpresa;
            const empregadosEmpresa = empregadosFiltrados.filter(e => e.codigo_empresa === codigoEmpresa);

            if (empregadosEmpresa.length === 0) {
                avisos.push(`${codigoEmpresa} - ${nomeEmpresa}: sem empregado (situação "Trabalhando") encontrado.`);
                continue;
            }

            const cfg = await _buscarConfigRubricas(codigoEmpresa);
            const { diaInicio, diaFim } = _resolverPeriodoApuracao(cfg);
            const periodoTexto = _labelPeriodoFolhaPonto(comp, diaInicio, diaFim);

            const empregados = empregadosEmpresa.map(emp => {
                const chave = `${emp.codigo_empresa}_${emp.codigo_empregado}`;
                const escala = escalasMapa[chave] || null;
                const periodosFerias = feriasMapa[chave];
                const excecoesFolga = excecoesMapa[chave] || [];
                const resumo = calcularResumoMes(escala, comp, periodosFerias, diaInicio, diaFim, excecoesFolga);
                const jornadaPorDiaSemana = agruparJornadaPorDiaSemana(jornadaMapa[chave] || []);
                return {
                    codigo_empregado: emp.codigo_empregado,
                    nome_empregado: emp.nome_empregado,
                    desc_cargo: emp.desc_cargo || '',
                    desc_dpto: emp.desc_dpto || '',
                    linhas: montarLinhasFolhaPonto(resumo.dias, jornadaPorDiaSemana),
                };
            }).sort((a, b) => a.nome_empregado.localeCompare(b.nome_empregado));

            empresasComEmpregados.push({
                codigo_empresa: codigoEmpresa,
                nome_empresa: nomeEmpresa,
                cnpj: empresaInfo?.cnpj || '',
                endereco: empresaInfo?.endereco || '',
                municipio: empresaInfo?.municipio || '',
                cidade: empresaInfo?.cidade || '',
                uf: empresaInfo?.uf || '',
                cep: empresaInfo?.cep || '',
                periodoTexto,
                empregados,
            });
        }

        fecharModalMensagem();

        if (empresasComEmpregados.length === 0) {
            document.getElementById('folhaPontoResultadoContainer').style.display = 'none';
            mostrarMensagem('Aviso', 'Nenhum empregado encontrado para as empresas selecionadas.\n' + avisos.join('\n'));
            return;
        }

        state._folhaPontoDados = { competencia: comp, empresas: empresasComEmpregados };
        _renderizarListaFolhaPonto(avisos);
    } catch (erro) {
        console.error('Erro ao montar folhas de ponto:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao montar as folhas de ponto: ' + erro.message);
    }
}

function _renderizarListaFolhaPonto(avisos) {
    const dados = state._folhaPontoDados;
    const totalEmpregados = dados.empresas.reduce((soma, e) => soma + e.empregados.length, 0);
    const info = document.getElementById('folhaPontoResultadoInfo');
    info.textContent = `${dados.empresas.length} empresa(s), ${totalEmpregados} empregado(s)` +
        (avisos && avisos.length ? ` — ${avisos.length} empresa(s) pulada(s)` : '');

    const container = document.getElementById('folhaPontoListaEmpregados');
    container.innerHTML = dados.empresas.map(emp => `
        <div style="border:1px solid var(--border-color); border-radius:8px; margin-bottom:10px; padding:12px 14px;">
            <strong>${emp.codigo_empresa} - ${emp.nome_empresa}</strong>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                ${emp.empregados.length} empregado(s) · Período: ${emp.periodoTexto}
            </div>
        </div>
    `).join('') + (avisos && avisos.length ? `
        <div style="font-size:12px; color:#B8860B; margin-top:6px;">
            ⚠️ ${avisos.join('<br>')}
        </div>
    ` : '');

    document.getElementById('folhaPontoResultadoContainer').style.display = 'block';
}
```

- [ ] **Step 3: Manual check**

Reload `index.html`, go to "Gerar Folhas de Ponto", pick a competência (e.g. `08/2026`) and one empresa with known employees (e.g. `227`), click "Gerar Prévia". Confirm the summary card shows the right employee count and período text, matching what "Gerar Escala" shows for the same empresa/competência.

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "feat(rh): busca de dados e previa de Gerar Folhas de Ponto"
```

---

### Task 5: script.js — geração do PDF e download

**Files:**
- Modify: `script.js`

**Interfaces:**
- Consumes: `state._folhaPontoDados` (Task 4 shape), `window.jspdf.jsPDF`, `doc.autoTable` (jspdf-autotable, already loaded), `JSZip` (already loaded).
- Produces: `function _construirPdfEmpresaFolhaPonto(empresaDados, competencia)` → returns a `jsPDF` doc instance; `async function baixarPdfsFolhaPonto()` referenced by Task 2 markup.

- [ ] **Step 1: Add the per-empresa PDF builder**

Right after `_renderizarListaFolhaPonto` (end of Task 4's additions), add:

```js
// Constrói o PDF de uma empresa (uma página por empregado) e devolve a instância jsPDF
// pronta para .save() ou .output('blob').
function _construirPdfEmpresaFolhaPonto(empresaDados) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const MARGEM = 8;
    const pageW = doc.internal.pageSize.getWidth();

    empresaDados.empregados.forEach((emp, idx) => {
        if (idx > 0) doc.addPage();

        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('FOLHA INDIVIDUAL DE PONTO', MARGEM, MARGEM + 4);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`Período: ${empresaDados.periodoTexto}`, pageW - MARGEM, MARGEM + 4, { align: 'right' });

        const linhaCabecalho = (y, esquerda, direita) => {
            doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
            doc.text(esquerda, MARGEM, y);
            if (direita) doc.text(direita, pageW / 2 + 4, y);
        };
        let y = MARGEM + 10;
        linhaCabecalho(y, `Empresa: ${empresaDados.codigo_empresa} - ${empresaDados.nome_empresa}`, `CNPJ: ${empresaDados.cnpj || ''}`);
        y += 5;
        linhaCabecalho(y, `Endereço: ${empresaDados.endereco || ''}`, `Bairro: ${empresaDados.municipio || ''}`);
        y += 5;
        linhaCabecalho(y, `Cidade: ${empresaDados.cidade || ''}`, `UF: ${empresaDados.uf || ''}   CEP: ${empresaDados.cep || ''}`);
        y += 5;
        linhaCabecalho(y, `Nome: ${emp.codigo_empregado} - ${emp.nome_empregado}`, `Departamento: ${emp.desc_dpto || ''}`);
        y += 5;
        linhaCabecalho(y, `Função: ${emp.desc_cargo || ''}`, '');
        y += 4;

        const body = emp.linhas.map(l => {
            if (l.ferias) {
                return [`${l.data.slice(0, 2)} ${l.diaSemana}`, l.horarioPrevisto, 'FÉRIAS', 'FÉRIAS', 'FÉRIAS', 'FÉRIAS', 'FÉRIAS', 'FÉRIAS', 'FÉRIAS', ''];
            }
            return [`${l.data.slice(0, 2)} ${l.diaSemana}`, l.horarioPrevisto, '', '', '', '', '', '', '', ''];
        });

        doc.autoTable({
            head: [['Dia', 'Horário Previsto', 'Entrada', 'Saída', 'Interv. Entrada', 'Interv. Saída', 'H.Extra Entrada', 'H.Extra Saída', 'N° Horas', 'Assinatura']],
            body,
            startY: y,
            margin: { left: MARGEM, right: MARGEM },
            styles: { fontSize: 7, cellPadding: 1.3, valign: 'middle', halign: 'center' },
            headStyles: { fillColor: [139, 58, 58], textColor: 255, fontStyle: 'bold', fontSize: 7 },
            columnStyles: { 0: { halign: 'left', cellWidth: 16 }, 9: { cellWidth: 30 } },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                const linha = emp.linhas[data.row.index];
                if (linha && linha.tipo === 'folga' && !linha.ferias) {
                    data.cell.styles.fillColor = [230, 230, 230];
                }
            },
        });

        const finalY = doc.lastAutoTable.finalY + 6;
        doc.setFontSize(7); doc.setFont('helvetica', 'italic');
        doc.text('Obs.: Substitui o Quadro de Horário de Trabalho, de acordo com o disposto na Portaria Ministerial nº 3162 de 08/09/1982', MARGEM, finalY);
        doc.setFont('helvetica', 'normal');
        doc.text('Reconheço a exatidão destas anotações. Data: ___/___/______', MARGEM, finalY + 5);
        doc.text('_______________________________', MARGEM, finalY + 18);
        doc.text('Visto chefia', MARGEM + 12, finalY + 22);
        doc.text('_______________________________', pageW / 2 + 10, finalY + 18);
        doc.text('Visto funcionário', pageW / 2 + 22, finalY + 22);
    });

    return doc;
}

async function baixarPdfsFolhaPonto() {
    const dados = state._folhaPontoDados;
    if (!dados || dados.empresas.length === 0) return;
    const [mm, aaaa] = dados.competencia.split('/');

    if (dados.empresas.length === 1) {
        const empresaDados = dados.empresas[0];
        const doc = _construirPdfEmpresaFolhaPonto(empresaDados);
        doc.save(`FolhaDePonto_${empresaDados.codigo_empresa}_${mm}-${aaaa}.pdf`);
        return;
    }

    mostrarMensagem('Aguarde', 'Gerando arquivo zip com as folhas de ponto...');
    try {
        const zip = new JSZip();
        for (const empresaDados of dados.empresas) {
            const doc = _construirPdfEmpresaFolhaPonto(empresaDados);
            const blob = doc.output('blob');
            zip.file(`FolhaDePonto_${empresaDados.codigo_empresa}_${mm}-${aaaa}.pdf`, blob);
        }
        const blobZip = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blobZip);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FolhasDePonto_${mm}-${aaaa}.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fecharModalMensagem();
    } catch (erro) {
        console.error('Erro ao gerar zip de folhas de ponto:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao gerar o arquivo zip: ' + erro.message);
    }
}
```

- [ ] **Step 2: Manual check**

Reload `index.html`, "Gerar Folhas de Ponto" → escolha 1 empresa → "Gerar Prévia" → "Baixar PDF(s)": confirm a single PDF downloads directly, opens, shows one page per empregado with the header fields filled, "Horário Previsto" column populated on trabalho days and "—" on folga days, folga rows shaded, férias rows (if any employee has férias in that período) showing "FÉRIAS". Repeat selecting 2+ empresas and confirm a `.zip` downloads containing one PDF per empresa.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat(rh): geracao de PDF e download em Gerar Folhas de Ponto"
```

---

### Task 6: Push

- [ ] **Step 1: Verify Node tests still pass**

Run: `node test-folha-ponto-calculo.js && node test-escala-calculo.js && node test-jornada-parser.js && node test-ferias-parser.js && node test-folha-ponto-solides-parser.js`
Expected: all report success, no FAIL lines.

- [ ] **Step 2: Push the branch**

```bash
git push
```
