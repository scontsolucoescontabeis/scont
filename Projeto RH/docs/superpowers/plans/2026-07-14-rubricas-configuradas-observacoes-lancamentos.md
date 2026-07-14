# Rubricas Configuradas + Observações + Tela de Configurações no Lançamentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No Passo 3 de Lançamentos (`lancamentos.html`/`lancamentos.js`), trocar a digitação livre do código de rubrica por um seletor alimentado pelas rubricas já configuradas no Controle de Frequência (`rh_config_rubricas_txt`) para as empresas do lote, exibir as observações cadastradas por empresa, e criar uma tela de Configurações (modal) dentro do Lançamentos com visualização das rubricas fixas/observações e CRUD de rubricas personalizadas.

**Architecture:** Reaproveita a tabela `rh_config_rubricas_txt` já usada pelo Controle de Frequência. Uma nova coluna `descricao_rubrica` (nula para os 8 eventos fixos e para `observacoes`) permite linhas de rubrica personalizada, identificadas por `evento` fora do conjunto fixo. `lancamentos.js` busca a config das empresas do lote sob demanda (sem cache entre levas) e resolve o código da rubrica por empregado usando a empresa dele, em vez de um código único fixo por coluna da grade.

**Tech Stack:** HTML/JS puro (sem bundler/framework), Supabase JS client v2, deploy estático (GitHub Pages). Não há framework de testes automatizados neste projeto para arquivos deste tipo (browser-only, dependente de DOM/Supabase) — a validação usada aqui é `node --check` para sintaxe e verificação manual no navegador, seguindo o padrão já existente no repositório (`test-ferias-parser.js` só cobre funções puras isoladas).

## Global Constraints

- Layout binário do TXT exportado (posições/paddings fixos) não muda.
- Sem alterações em `index.html`/`script.js` (Controle de Frequência) — ele continua só com os 8 eventos fixos + observações, sem capacidade de criar rubrica personalizada.
- Sem edição de rubricas fixas nem de observações a partir do Lançamentos — view-only para esses dois blocos na nova tela de Configurações.
- A migração de schema (`schema_rh_rubricas_personalizadas.sql`) precisa ser executada manualmente pelo usuário no SQL Editor do Supabase — não há CI/pipeline neste repo que aplique schema automaticamente (confirmado pelo padrão dos demais arquivos `schema_rh_*.sql`, todos com o comentário "Execute no SQL Editor do Supabase").

---

### Task 1: Migração de schema — `descricao_rubrica`

**Files:**
- Create: `schema_rh_rubricas_personalizadas.sql`
- Modify: `schema_rh.sql:246-253` (comentário da tabela `rh_config_rubricas_txt`)

**Interfaces:**
- Produces: coluna `rh_config_rubricas_txt.descricao_rubrica TEXT` (nullable), usada pelas Tasks 3–5.

- [ ] **Step 1: Criar o arquivo de migração**

Criar `schema_rh_rubricas_personalizadas.sql` com o conteúdo:

```sql
-- Migração: coluna descricao_rubrica em rh_config_rubricas_txt
-- Permite cadastrar rubricas personalizadas (fora dos 8 eventos fixos)
-- pela ferramenta de Lançamentos, mantendo o Controle de Frequência
-- inalterado (ele só usa os 8 eventos fixos + observacoes, sem descricao).
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_config_rubricas_txt
  ADD COLUMN IF NOT EXISTS descricao_rubrica TEXT;
```

- [ ] **Step 2: Atualizar o comentário da tabela em `schema_rh.sql`**

Ler `schema_rh.sql` linhas 246-253 (bloco de comentário acima de `CREATE TABLE IF NOT EXISTS public.rh_config_rubricas_txt`) e trocar:

```sql
-- ============================================================
-- 8. TABELA: rh_config_rubricas_txt
--    Presets de rubricas TXT por empresa (6 eventos fixos) +
--    config geral por empresa (jornada, observacoes, regras de
--    horas extras/turnos): jornada_diaria, jornada_sexta_ativa,
--    jornada_sexta, jornada_sabado_ativa, jornada_sabado,
--    sabado_sempre_extra, observacoes, rule_extra_100_opcional,
--    terceiro_turno, nao_compensar_extras
-- ============================================================
```

por:

```sql
-- ============================================================
-- 8. TABELA: rh_config_rubricas_txt
--    Presets de rubricas TXT por empresa (8 eventos fixos) +
--    config geral por empresa (jornada, observacoes, regras de
--    horas extras/turnos): jornada_diaria, jornada_sexta_ativa,
--    jornada_sexta, jornada_sabado_ativa, jornada_sabado,
--    sabado_sempre_extra, observacoes, rule_extra_100_opcional,
--    terceiro_turno, nao_compensar_extras
--    Coluna real descricao_rubrica: usada só por rubricas
--    personalizadas cadastradas pela ferramenta de Lançamentos
--    (evento fora do conjunto fixo, ex: "custom_<uuid>").
-- ============================================================
```

- [ ] **Step 3: Commit**

```bash
git add schema_rh_rubricas_personalizadas.sql schema_rh.sql
git commit -m "feat(rh): adiciona coluna descricao_rubrica para rubricas personalizadas do Lancamentos"
```

---

### Task 2: Estado e busca de config por lote (`lancamentos.js`)

**Files:**
- Modify: `lancamentos.js:10-21` (bloco de estado), `lancamentos.js:89-119` (`carregarEmpresas`), `lancamentos.js:227-252` (`avancarParaParametros`)

**Interfaces:**
- Consumes: nenhuma (base para as demais tasks).
- Produces:
  - `EVENTOS_FIXOS_RUBRICA: Array<{ev, label, tipoValor}>`
  - `empresasCadastradas: Array<{codigo_empresa, nome_empresa}>`
  - `configRubricasPorEmpresa: { [codEmpresa]: { [evento]: {codigo, tipo, descricao} } }`
  - `async function carregarConfigRubricasLote(codigosEmpresa: string[]): Promise<void>`
  - `function empresasDoLote(): string[]`
  - `function nomeEmpresaPorCodigo(codigoEmpresa: string): string`
  - `avancarParaParametros()` vira `async`, popula `configRubricasPorEmpresa` antes de terminar.

- [ ] **Step 1: Adicionar constantes e estado novo**

Em `lancamentos.js`, logo depois da linha 21 (`let valoresGrid = {};`), adicionar:

```js

// Eventos fixos de rubrica (mesmos do Controle de Frequência)
const EVENTOS_FIXOS_RUBRICA = [
    { ev: 'horasTrab',  label: 'Horas Trabalhadas',  tipoValor: 'horas'     },
    { ev: 'he50',       label: 'Horas Extras 50%',   tipoValor: 'horas'     },
    { ev: 'he100',      label: 'Horas Extras 100%',  tipoValor: 'horas'     },
    { ev: 'noturno',    label: 'Adicional Noturno',  tipoValor: 'horas'     },
    { ev: 'atraso',     label: 'Atraso',              tipoValor: 'horas'     },
    { ev: 'falta',      label: 'Falta (dias)',       tipoValor: 'dias'      },
    { ev: 'descontoVT', label: 'Desconto VT',        tipoValor: 'monetario' },
    { ev: 'descontoVA', label: 'Desconto VA',        tipoValor: 'monetario' },
];

// Empresas cadastradas (preenchido em carregarEmpresas), reaproveitado pela grade e pelo modal de Configurações
let empresasCadastradas = [];

// Config de rubricas/observações por empresa do lote atual (Passo 3), sem cache entre levas
let configRubricasPorEmpresa = {};

// Rubricas disponíveis no seletor do Passo 3 (recalculado a cada avancarParaParametros)
let eventosRubricaDisponiveis = [];
```

- [ ] **Step 2: Guardar `empresasCadastradas` em `carregarEmpresas()`**

Em `lancamentos.js:99` (`if (error) throw error;` dentro de `carregarEmpresas`), adicionar logo abaixo:

```js
        if (error) throw error;

        empresasCadastradas = data || [];

        container.innerHTML = '';
```

(substitui a linha `container.innerHTML = '';` original — o restante da função continua igual.)

- [ ] **Step 3: Adicionar `carregarConfigRubricasLote`, `empresasDoLote`, `nomeEmpresaPorCodigo`**

Logo depois do fechamento de `avancarParaParametros` (antes do comentário `// --- ✅ NOVO: SISTEMA DE ACÚMULO DE PARAMETRIZAÇÕES ---` em `lancamentos.js:254`), adicionar:

```js
function empresasDoLote() {
    const codigos = new Set();
    empregadosSelecionadosAtual.forEach(empKey => codigos.add(empKey.split('|')[0]));
    return Array.from(codigos);
}

function nomeEmpresaPorCodigo(codigoEmpresa) {
    const emp = empresasCadastradas.find(e => e.codigo_empresa === codigoEmpresa);
    return emp ? emp.nome_empresa : codigoEmpresa;
}

async function carregarConfigRubricasLote(codigosEmpresa) {
    configRubricasPorEmpresa = {};
    if (!codigosEmpresa || codigosEmpresa.length === 0) return;

    const { data, error } = await supabaseClient
        .from('rh_config_rubricas_txt')
        .select('codigo_empresa, evento, codigo_rubrica, tipo_valor, descricao_rubrica')
        .in('codigo_empresa', codigosEmpresa);

    if (error) {
        console.error('Erro ao buscar config de rubricas do lote:', error);
        mostrarMensagem('Erro', 'Falha ao buscar rubricas configuradas: ' + error.message);
        return;
    }

    (data || []).forEach(row => {
        if (!configRubricasPorEmpresa[row.codigo_empresa]) configRubricasPorEmpresa[row.codigo_empresa] = {};
        configRubricasPorEmpresa[row.codigo_empresa][row.evento] = {
            codigo: row.codigo_rubrica,
            tipo: row.tipo_valor,
            descricao: row.descricao_rubrica
        };
    });
}
```

- [ ] **Step 4: Tornar `avancarParaParametros` assíncrona e disparar a busca**

Substituir a função inteira (`lancamentos.js:227-252`) por:

```js
async function avancarParaParametros() {
    const checkboxesEmpregados = document.querySelectorAll('#listaEmpregados input[type="checkbox"]:checked');

    if (checkboxesEmpregados.length === 0) {
        mostrarMensagem('Atenção', 'Selecione pelo menos um empregado para continuar.');
        return;
    }

    empregadosSelecionadosAtual = Array.from(checkboxesEmpregados).map(cb => cb.value);

    empregadosInfoAtual = {};
    checkboxesEmpregados.forEach(cb => {
        const label = document.querySelector(`label[for="${cb.id}"]`);
        empregadosInfoAtual[cb.value] = label ? label.textContent.trim().replace(/\s+/g, ' ') : cb.value;
    });

    rubricasGrid = [];
    valoresGrid = {};

    ativarStep('step3');

    const gradeContainer = document.getElementById('gradeContainer');
    gradeContainer.innerHTML = '<div class="grade-empty-msg">Carregando rubricas configuradas...</div>';

    await carregarConfigRubricasLote(empresasDoLote());

    renderGrade();
}
```

(As chamadas a `renderSeletorEventoRubrica()` e `renderObservacoesLote()` serão adicionadas dentro desta função na Task 3, quando essas funções existirem — por enquanto a Task 2 só precisa deixar `configRubricasPorEmpresa` populado e `renderGrade()` funcionando como antes.)

- [ ] **Step 5: Verificar sintaxe**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 6: Commit**

```bash
git add lancamentos.js
git commit -m "feat(lancamentos): busca config de rubricas por empresa do lote"
```

---

### Task 3: Seletor de rubrica + observações no Passo 3

**Files:**
- Modify: `lancamentos.html:152-199` (bloco "Tipo do Processo" + "Adicionar Rubrica à Grade" + "Grade de Valores")
- Modify: `lancamentos.js` (funções `adicionarRubricaGrade`, `removerRubricaGrade`, `renderGrade`, `avancarParaParametros`; novas funções `renderSeletorEventoRubrica`, `onEventoRubricaChange`, `renderObservacoesLote`)

**Interfaces:**
- Consumes: `EVENTOS_FIXOS_RUBRICA`, `configRubricasPorEmpresa`, `empresasDoLote()`, `nomeEmpresaPorCodigo()`, `infoTipoValor()` (Task 2 / já existente)
- Produces:
  - `rubricasGrid[i]` passa a ter o formato `{ id, evento, label, tipoValor, codigosPorEmpresa? , codigo? }` (`codigosPorEmpresa` para rubrica configurada, `codigo` fixo para "Outra rubrica")
  - `eventosRubricaDisponiveis: Array<{evento, label, tipoValor, codigosPorEmpresa}>` (consumida por `adicionarRubricaGrade`, usada pela Task 4 indiretamente via `rubricasGrid`)

- [ ] **Step 1: Substituir o HTML do Passo 3**

Em `lancamentos.html`, o bloco `<div class="form-group" style="max-width: 260px;"> <label for="lanTipoProcesso">...` (linha 152) até o fechamento de `<div id="gradeContainer" ...>` (linha 196-199) precisa de duas mudanças:

**1a.** Logo depois de `<div class="step-title">...</div>` (linha 150) e antes do form-group de `lanTipoProcesso` (linha 152), inserir:

```html
            <div id="obsEmpresasLote" style="display: none; background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; padding: 12px 15px; margin-bottom: 15px; font-size: 13px; color: #6d4c00;"></div>
```

**1b.** Substituir o bloco "Adicionar Rubrica à Grade" inteiro (linhas 166-191) por:

```html
            <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin-top: 15px;">
                <label style="font-weight: 600; font-size: 13px; display: block; margin-bottom: 10px;">Adicionar Rubrica à Grade</label>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px;">
                    <div class="form-group" style="margin-bottom: 0; grid-column: 1 / -1;">
                        <label for="gradeRubricaEvento">Rubrica *</label>
                        <select id="gradeRubricaEvento" onchange="onEventoRubricaChange()">
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                    <div class="form-group" id="gradeRubricaManualFields" style="display: none; margin-bottom: 0;">
                        <label for="gradeRubricaCodigo">Código da Rubrica *</label>
                        <input type="text" id="gradeRubricaCodigo" placeholder="Ex: 1285" maxlength="9" oninput="this.value = this.value.replace(/\D/g, '')">
                    </div>
                    <div class="form-group" id="gradeRubricaManualTipo" style="display: none; margin-bottom: 0;">
                        <label for="gradeRubricaTipoValor">Tipo do Valor *</label>
                        <select id="gradeRubricaTipoValor" onchange="atualizarPlaceholderValorPadrao()">
                            <option value="horas">Horas (HH:MM)</option>
                            <option value="monetario">Monetário (R$ 0,00)</option>
                            <option value="dias">Dias (inteiro)</option>
                        </select>
                    </div>
                    <div class="form-group" id="gradeRubricaTipoDerivadoWrap" style="display: none; margin-bottom: 0;">
                        <label>Tipo do Valor</label>
                        <div id="gradeRubricaTipoDerivado" style="padding: 10px; font-size: 13px; color: var(--text-secondary);"></div>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="gradeRubricaValorPadrao">Valor Padrão (opcional)</label>
                        <input type="text" id="gradeRubricaValorPadrao" placeholder="Ex: 01:30">
                        <small id="gradeRubricaValorPadraoDica">Preenche a coluna toda; edite depois por empregado</small>
                    </div>
                </div>
                <button type="button" class="btn btn-secondary" onclick="adicionarRubricaGrade()" style="margin-top: 15px;">
                    ➕ Adicionar Rubrica à Grade
                </button>
                <div id="chipsRubricas" style="margin-top: 12px;"></div>
            </div>
```

- [ ] **Step 2: Adicionar `renderSeletorEventoRubrica`, `onEventoRubricaChange`, `renderObservacoesLote`**

Em `lancamentos.js`, logo depois de `atualizarPlaceholderValorPadrao()` (antes de `function validarFormatoValor`), adicionar:

```js
function renderSeletorEventoRubrica() {
    const select = document.getElementById('gradeRubricaEvento');
    const codigosEmpresasLote = empresasDoLote();
    eventosRubricaDisponiveis = [];

    EVENTOS_FIXOS_RUBRICA.forEach(evtDef => {
        const porEmpresa = {};
        codigosEmpresasLote.forEach(cod => {
            const cfg = configRubricasPorEmpresa[cod] && configRubricasPorEmpresa[cod][evtDef.ev];
            if (cfg && cfg.codigo) porEmpresa[cod] = cfg.codigo;
        });
        if (Object.keys(porEmpresa).length > 0) {
            eventosRubricaDisponiveis.push({ evento: evtDef.ev, label: evtDef.label, tipoValor: evtDef.tipoValor, codigosPorEmpresa: porEmpresa });
        }
    });

    const vistos = new Set();
    codigosEmpresasLote.forEach(cod => {
        const cfgEmpresa = configRubricasPorEmpresa[cod] || {};
        Object.keys(cfgEmpresa).forEach(evento => {
            const ehFixo = EVENTOS_FIXOS_RUBRICA.some(e => e.ev === evento);
            if (ehFixo || evento === 'observacoes' || vistos.has(evento)) return;
            vistos.add(evento);

            const porEmpresa = {};
            let tipoValor = 'horas';
            let label = evento;
            codigosEmpresasLote.forEach(cod2 => {
                const cfg = configRubricasPorEmpresa[cod2] && configRubricasPorEmpresa[cod2][evento];
                if (cfg && cfg.codigo) {
                    porEmpresa[cod2] = cfg.codigo;
                    tipoValor = cfg.tipo || tipoValor;
                    label = cfg.descricao || label;
                }
            });
            eventosRubricaDisponiveis.push({ evento, label, tipoValor, codigosPorEmpresa: porEmpresa });
        });
    });

    let html = '<option value="">Selecione...</option>';
    eventosRubricaDisponiveis.forEach(item => {
        const codigosUnicos = [...new Set(Object.values(item.codigosPorEmpresa))];
        const detalhe = codigosUnicos.length === 1
            ? codigosUnicos[0]
            : Object.entries(item.codigosPorEmpresa).map(([cod, codigo]) => `${nomeEmpresaPorCodigo(cod)}: ${codigo}`).join(', ');
        html += `<option value="${item.evento}">${item.label} (${detalhe})</option>`;
    });
    html += '<option value="__manual__">Outra rubrica (digitar código)</option>';

    select.innerHTML = html;
    onEventoRubricaChange();
}

function onEventoRubricaChange() {
    const select = document.getElementById('gradeRubricaEvento');
    const isManual = select.value === '__manual__';
    document.getElementById('gradeRubricaManualFields').style.display = isManual ? 'block' : 'none';
    document.getElementById('gradeRubricaManualTipo').style.display = isManual ? 'block' : 'none';
    document.getElementById('gradeRubricaTipoDerivadoWrap').style.display = (!isManual && select.value) ? 'block' : 'none';

    if (isManual) {
        atualizarPlaceholderValorPadrao();
        return;
    }
    if (!select.value) return;

    const item = eventosRubricaDisponiveis.find(e => e.evento === select.value);
    if (!item) return;

    const info = infoTipoValor(item.tipoValor);
    document.getElementById('gradeRubricaTipoDerivado').textContent = `${item.tipoValor} (${info.placeholder})`;
    document.getElementById('gradeRubricaValorPadrao').placeholder = info.placeholder;
    document.getElementById('gradeRubricaValorPadraoDica').textContent = info.dica;
}

function renderObservacoesLote() {
    const container = document.getElementById('obsEmpresasLote');
    const codigosEmpresasLote = empresasDoLote();

    const linhas = codigosEmpresasLote
        .map(cod => {
            const cfg = configRubricasPorEmpresa[cod] && configRubricasPorEmpresa[cod]['observacoes'];
            const texto = cfg && cfg.codigo ? cfg.codigo.trim() : '';
            return texto ? `<strong>${nomeEmpresaPorCodigo(cod)}:</strong> ${texto}` : null;
        })
        .filter(Boolean);

    if (linhas.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.innerHTML = linhas.map(l => `<div style="margin-bottom: 6px;">${l}</div>`).join('');
    container.style.display = 'block';
}
```

- [ ] **Step 3: Chamar os novos renders em `avancarParaParametros`**

Em `lancamentos.js`, na função `avancarParaParametros` criada na Task 2, trocar a linha final `renderGrade();` por:

```js
    renderSeletorEventoRubrica();
    renderObservacoesLote();
    renderGrade();
```

- [ ] **Step 4: Reescrever `adicionarRubricaGrade`**

Substituir a função inteira (atualmente em `lancamentos.js`, bloco `function adicionarRubricaGrade() { ... }`) por:

```js
function adicionarRubricaGrade() {
    const select = document.getElementById('gradeRubricaEvento');
    const valorPadrao = document.getElementById('gradeRubricaValorPadrao').value.trim();

    if (!select.value) {
        mostrarMensagem('Atenção', 'Selecione uma rubrica.');
        return;
    }

    if (empregadosSelecionadosAtual.length === 0) {
        mostrarMensagem('Atenção', 'Nenhum empregado selecionado. Volte ao passo 2.');
        return;
    }

    let novaColuna;

    if (select.value === '__manual__') {
        const codigo = document.getElementById('gradeRubricaCodigo').value.trim();
        const tipoValor = document.getElementById('gradeRubricaTipoValor').value;

        if (!codigo || !/^\d+$/.test(codigo)) {
            mostrarMensagem('Atenção', 'Informe um Código de Rubrica válido (apenas números).');
            return;
        }

        novaColuna = { id: Date.now(), evento: null, label: `Rubrica ${codigo}`, tipoValor, codigo };
    } else {
        const item = eventosRubricaDisponiveis.find(e => e.evento === select.value);
        if (!item) {
            mostrarMensagem('Atenção', 'Rubrica inválida. Selecione novamente.');
            return;
        }
        novaColuna = { id: Date.now(), evento: item.evento, label: item.label, tipoValor: item.tipoValor, codigosPorEmpresa: { ...item.codigosPorEmpresa } };
    }

    rubricasGrid.push(novaColuna);
    valoresGrid[novaColuna.id] = {};

    if (valorPadrao) {
        empregadosSelecionadosAtual.forEach(empKey => {
            valoresGrid[novaColuna.id][empKey] = valorPadrao;
        });
    }

    document.getElementById('gradeRubricaCodigo').value = '';
    document.getElementById('gradeRubricaValorPadrao').value = '';
    select.value = '';
    onEventoRubricaChange();

    renderGrade();
}
```

- [ ] **Step 5: Ajustar `removerRubricaGrade` e `renderGrade` para usar `label`**

Em `removerRubricaGrade`, trocar:

```js
    if (temValores && !confirm(`A rubrica ${rubrica.codigo} já tem valores preenchidos. Remover mesmo assim?`)) {
```

por:

```js
    if (temValores && !confirm(`A rubrica ${rubrica.label} já tem valores preenchidos. Remover mesmo assim?`)) {
```

Em `renderGrade`, trocar:

```js
    chipsContainer.innerHTML = rubricasGrid.map(r => `
        <span class="chip-rubrica">
            Rubrica ${r.codigo} (${r.tipoValor})
            <span class="chip-remove" onclick="removerRubricaGrade(${r.id})">×</span>
        </span>
    `).join('');
```

por:

```js
    chipsContainer.innerHTML = rubricasGrid.map(r => `
        <span class="chip-rubrica">
            ${r.label} (${r.tipoValor})
            <span class="chip-remove" onclick="removerRubricaGrade(${r.id})">×</span>
        </span>
    `).join('');
```

E trocar:

```js
        html += `<th>Rubrica ${r.codigo}<br><small>${infoTipoValor(r.tipoValor).placeholder}</small></th>`;
```

por:

```js
        html += `<th>${r.label}<br><small>${infoTipoValor(r.tipoValor).placeholder}</small></th>`;
```

- [ ] **Step 6: Verificar sintaxe**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 7: Commit**

```bash
git add lancamentos.html lancamentos.js
git commit -m "feat(lancamentos): seletor de rubrica configurada + observacoes por empresa no Passo 3"
```

---

### Task 4: Geração de TXT e validação por empresa

**Files:**
- Modify: `lancamentos.js` (`gerarConteudoTXT`, `gerarParametrizacoes`)

**Interfaces:**
- Consumes: `rubricasGrid[i]` no formato definido na Task 3 (`codigosPorEmpresa` ou `codigo`)
- Produces: `function resolverCodigoRubrica(coluna, codEmpresa): string | undefined`, nova assinatura `gerarConteudoTXT(comp, tipoProcesso, coluna, itens)`

- [ ] **Step 1: Adicionar `resolverCodigoRubrica` e reescrever `gerarConteudoTXT`**

Substituir a função `gerarConteudoTXT` inteira por:

```js
function resolverCodigoRubrica(coluna, codEmpresa) {
    if (coluna.codigo) return coluna.codigo;
    return coluna.codigosPorEmpresa ? coluna.codigosPorEmpresa[codEmpresa] : undefined;
}

function gerarConteudoTXT(comp, tipoProcesso, coluna, itens) {
    const fixo = "10";
    const compParts = comp.split('/');
    const compFormatada = compParts[1] + compParts[0]; // AAAA + MM
    const tipoProcFormatado = String(tipoProcesso).padStart(2, '0');

    let conteudo = '';
    itens.forEach(item => {
        const [codEmpresa, codEmpregado] = item.empregado.split('|');
        const codigoRubrica = resolverCodigoRubrica(coluna, codEmpresa);
        const rubFormatada = String(codigoRubrica).padStart(9, '0');
        const codEmpregadoFormatado = String(codEmpregado).padStart(10, '0');
        const codEmpresaFormatada = String(codEmpresa).padStart(10, '0');
        const valorInt = encodeValorParaTipo(item.valor, coluna.tipoValor);
        const valFormatado = String(valorInt).padStart(9, '0');
        conteudo += `${fixo}${codEmpregadoFormatado}${compFormatada}${rubFormatada}${tipoProcFormatado}${valFormatado}${codEmpresaFormatada}\n`;
    });

    return conteudo;
}
```

- [ ] **Step 2: Validar código configurado por empregado em `gerarParametrizacoes`**

Dentro do laço `for (const empKey of Object.keys(valoresColuna)) { ... }` em `gerarParametrizacoes`, logo após o bloco de `validarFormatoValor` (que já faz `return` em caso de erro) e antes de `itens.push(...)`, inserir:

```js
            const [codEmpresaItem] = empKey.split('|');
            if (!resolverCodigoRubrica(r, codEmpresaItem)) {
                const nomeEmp = empregadosInfoAtual[empKey] || empKey;
                mostrarMensagem('Atenção', `Empregado "${nomeEmp}" (empresa ${codEmpresaItem}): a rubrica "${r.label}" não está configurada para essa empresa.`);
                return;
            }
```

- [ ] **Step 3: Ajustar a chamada de `gerarConteudoTXT` e o registro da parametrização**

Trocar:

```js
        const conteudoTXT = gerarConteudoTXT(comp, tipoProcesso, r.codigo, r.tipoValor, itens);

        novasParametrizacoes.push({
            id: Date.now() + Math.random(),
            competencia: comp,
            tipoProcesso: tipoProcesso,
            rubrica: r.codigo,
            tipoValor: r.tipoValor,
            itens: itens,
            conteudoTXT: conteudoTXT,
            dataHora: new Date().toLocaleString('pt-BR')
        });
```

por:

```js
        const conteudoTXT = gerarConteudoTXT(comp, tipoProcesso, r, itens);

        novasParametrizacoes.push({
            id: Date.now() + Math.random(),
            competencia: comp,
            tipoProcesso: tipoProcesso,
            rubrica: r.label,
            tipoValor: r.tipoValor,
            itens: itens,
            conteudoTXT: conteudoTXT,
            dataHora: new Date().toLocaleString('pt-BR')
        });
```

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 5: Commit**

```bash
git add lancamentos.js
git commit -m "feat(lancamentos): resolve codigo de rubrica por empregado/empresa na geracao do TXT"
```

---

### Task 5: Tela de Configurações (modal) no Lançamentos

**Files:**
- Modify: `lancamentos.html` (botão no header, novo modal `configLancamentosModal`)
- Modify: `lancamentos.js` (novas funções de CRUD e render do modal)

**Interfaces:**
- Consumes: `empresasCadastradas`, `EVENTOS_FIXOS_RUBRICA`, `nomeEmpresaPorCodigo()`, `configRubricasPorEmpresa` (invalidação pontual)
- Produces: nenhuma interface consumida por outras tasks (é a última peça do fluxo).

- [ ] **Step 1: Adicionar o botão de Configurações no header**

Em `lancamentos.html`, trocar o bloco `header-actions` (linhas 99-101):

```html
            <div class="header-actions">
                <button type="button" class="btn btn-small" onclick="window.location.href='../portal.html'" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3);">← Voltar ao Portal</button>
            </div>
```

por:

```html
            <div class="header-actions">
                <button type="button" class="btn btn-small" onclick="abrirModalConfigLancamentos()" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3);">⚙️ Configurações</button>
                <button type="button" class="btn btn-small" onclick="window.location.href='../portal.html'" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3);">← Voltar ao Portal</button>
            </div>
```

- [ ] **Step 2: Adicionar o modal de Configurações**

Em `lancamentos.html`, logo antes de `<script src="lancamentos.js"></script>` (depois do fechamento do modal `messageModal`), inserir:

```html
    <!-- MODAL DE CONFIGURAÇÕES DO LANÇAMENTO -->
    <div id="configLancamentosModal" class="modal">
        <div class="modal-content" style="max-width: 720px;">
            <div class="modal-header">
                <h3>⚙️ Configurações de Rubricas</h3>
                <button type="button" class="modal-close" onclick="fecharModalConfigLancamentos()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="cfgLancEmpresaBusca">Empresa</label>
                    <input type="text" id="cfgLancEmpresaBusca" class="search-input" placeholder="🔍 Buscar por código ou nome da empresa..." onkeyup="filtrarEmpresaConfigLancamentos()" autocomplete="off">
                    <div class="checkbox-list-container" id="cfgLancListaEmpresas" style="max-height: 180px;"></div>
                </div>

                <div id="cfgLancConteudo" style="display: none;">
                    <h4 style="margin: 15px 0 8px; font-size: 14px; color: var(--primary-color);">Rubricas do Controle de Frequência (somente leitura)</h4>
                    <table class="detalhes-table" id="cfgLancTabelaFixas">
                        <thead><tr><th>Evento</th><th>Código</th><th>Tipo</th></tr></thead>
                        <tbody></tbody>
                    </table>

                    <h4 style="margin: 15px 0 8px; font-size: 14px; color: var(--primary-color);">Observações (somente leitura)</h4>
                    <div id="cfgLancObservacoes" style="background: var(--background-color); border-radius: 6px; padding: 10px; font-size: 13px; color: var(--text-primary);"></div>

                    <h4 style="margin: 15px 0 8px; font-size: 14px; color: var(--primary-color);">Rubricas Personalizadas (Lançamentos)</h4>
                    <div style="display: grid; grid-template-columns: 1fr 2fr 1fr auto; gap: 10px; align-items: end;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="cfgLancNovoCodigo">Código</label>
                            <input type="text" id="cfgLancNovoCodigo" maxlength="9" oninput="this.value = this.value.replace(/\D/g, '')">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="cfgLancNovaDescricao">Descrição</label>
                            <input type="text" id="cfgLancNovaDescricao">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="cfgLancNovoTipo">Tipo</label>
                            <select id="cfgLancNovoTipo">
                                <option value="horas">Horas</option>
                                <option value="monetario">Monetário</option>
                                <option value="dias">Dias</option>
                            </select>
                        </div>
                        <button type="button" class="btn btn-secondary btn-small" onclick="adicionarRubricaPersonalizada()">➕ Adicionar</button>
                    </div>
                    <table class="detalhes-table" id="cfgLancTabelaPersonalizadas" style="margin-top: 10px;">
                        <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th></th></tr></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="fecharModalConfigLancamentos()">Fechar</button>
            </div>
        </div>
    </div>
```

- [ ] **Step 3: Adicionar as funções do modal em `lancamentos.js`**

No final de `lancamentos.js` (depois de `baixarTXT`), adicionar:

```js

// --- ✅ NOVO: TELA DE CONFIGURAÇÕES DO LANÇAMENTO ---

let _cfgLancEmpresaAtual = null;

function abrirModalConfigLancamentos() {
    document.getElementById('cfgLancEmpresaBusca').value = '';
    document.getElementById('cfgLancConteudo').style.display = 'none';
    _cfgLancEmpresaAtual = null;
    renderListaEmpresasConfigLancamentos(empresasCadastradas);
    document.getElementById('configLancamentosModal').classList.add('active');
}

function fecharModalConfigLancamentos() {
    document.getElementById('configLancamentosModal').classList.remove('active');
}

function renderListaEmpresasConfigLancamentos(lista) {
    const container = document.getElementById('cfgLancListaEmpresas');
    container.innerHTML = lista.map(emp => `
        <div class="checkbox-item" style="cursor: pointer;" onclick="selecionarEmpresaConfigLancamentos('${emp.codigo_empresa}')">
            <label style="cursor: pointer; margin: 0;">${emp.codigo_empresa} - ${emp.nome_empresa}</label>
        </div>
    `).join('');
}

function filtrarEmpresaConfigLancamentos() {
    const termo = document.getElementById('cfgLancEmpresaBusca').value.toLowerCase();
    const filtradas = empresasCadastradas.filter(emp =>
        `${emp.codigo_empresa} ${emp.nome_empresa}`.toLowerCase().includes(termo)
    );
    renderListaEmpresasConfigLancamentos(filtradas);
}

async function _buscarLinhasConfigRubricas(codigoEmpresa) {
    const { data, error } = await supabaseClient
        .from('rh_config_rubricas_txt')
        .select('id, evento, codigo_rubrica, tipo_valor, descricao_rubrica')
        .eq('codigo_empresa', codigoEmpresa);

    if (error) {
        mostrarMensagem('Erro', 'Falha ao buscar configuração da empresa: ' + error.message);
        return [];
    }
    return data || [];
}

async function selecionarEmpresaConfigLancamentos(codigoEmpresa) {
    _cfgLancEmpresaAtual = codigoEmpresa;
    document.getElementById('cfgLancEmpresaBusca').value = `${codigoEmpresa} - ${nomeEmpresaPorCodigo(codigoEmpresa)}`;

    const linhas = await _buscarLinhasConfigRubricas(codigoEmpresa);
    renderConfigLancamentos(linhas);
    document.getElementById('cfgLancConteudo').style.display = 'block';
}

function renderConfigLancamentos(linhas) {
    const porEvento = {};
    linhas.forEach(l => { porEvento[l.evento] = l; });

    const tbodyFixas = document.querySelector('#cfgLancTabelaFixas tbody');
    tbodyFixas.innerHTML = EVENTOS_FIXOS_RUBRICA.map(evtDef => {
        const linha = porEvento[evtDef.ev];
        return `<tr><td>${evtDef.label}</td><td>${linha && linha.codigo_rubrica ? linha.codigo_rubrica : '—'}</td><td>${linha && linha.codigo_rubrica ? linha.tipo_valor : '—'}</td></tr>`;
    }).join('');

    const obs = porEvento['observacoes'];
    const textoObs = obs && obs.codigo_rubrica ? obs.codigo_rubrica.trim() : '';
    document.getElementById('cfgLancObservacoes').textContent = textoObs || 'Nenhuma observação cadastrada.';

    const eventosFixosSet = new Set(EVENTOS_FIXOS_RUBRICA.map(e => e.ev));
    const personalizadas = linhas.filter(l => l.evento !== 'observacoes' && !eventosFixosSet.has(l.evento));

    const tbodyPersonalizadas = document.querySelector('#cfgLancTabelaPersonalizadas tbody');
    if (personalizadas.length === 0) {
        tbodyPersonalizadas.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Nenhuma rubrica personalizada cadastrada.</td></tr>';
    } else {
        tbodyPersonalizadas.innerHTML = personalizadas.map(l => `
            <tr>
                <td>${l.codigo_rubrica}</td>
                <td>${l.descricao_rubrica || ''}</td>
                <td>${l.tipo_valor}</td>
                <td><span class="btn-remove" onclick="removerRubricaPersonalizada('${l.id}')">🗑️</span></td>
            </tr>
        `).join('');
    }
}

async function adicionarRubricaPersonalizada() {
    if (!_cfgLancEmpresaAtual) {
        mostrarMensagem('Atenção', 'Selecione uma empresa primeiro.');
        return;
    }

    const codigo = document.getElementById('cfgLancNovoCodigo').value.trim();
    const descricao = document.getElementById('cfgLancNovaDescricao').value.trim();
    const tipo = document.getElementById('cfgLancNovoTipo').value;

    if (!codigo || !/^\d+$/.test(codigo)) {
        mostrarMensagem('Atenção', 'Informe um código de rubrica válido (apenas números).');
        return;
    }
    if (!descricao) {
        mostrarMensagem('Atenção', 'Informe uma descrição para a rubrica.');
        return;
    }

    const evento = 'custom_' + crypto.randomUUID();

    const { error } = await supabaseClient
        .from('rh_config_rubricas_txt')
        .insert([{ codigo_empresa: _cfgLancEmpresaAtual, evento, codigo_rubrica: codigo, tipo_valor: tipo, descricao_rubrica: descricao }]);

    if (error) {
        mostrarMensagem('Erro', 'Falha ao salvar rubrica personalizada: ' + error.message);
        return;
    }

    document.getElementById('cfgLancNovoCodigo').value = '';
    document.getElementById('cfgLancNovaDescricao').value = '';
    document.getElementById('cfgLancNovoTipo').value = 'horas';

    delete configRubricasPorEmpresa[_cfgLancEmpresaAtual];

    const linhas = await _buscarLinhasConfigRubricas(_cfgLancEmpresaAtual);
    renderConfigLancamentos(linhas);
}

async function removerRubricaPersonalizada(id) {
    if (!confirm('Remover esta rubrica personalizada?')) return;

    const { error } = await supabaseClient.from('rh_config_rubricas_txt').delete().eq('id', id);
    if (error) {
        mostrarMensagem('Erro', 'Falha ao remover rubrica personalizada: ' + error.message);
        return;
    }

    delete configRubricasPorEmpresa[_cfgLancEmpresaAtual];

    const linhas = await _buscarLinhasConfigRubricas(_cfgLancEmpresaAtual);
    renderConfigLancamentos(linhas);
}
```

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 5: Commit**

```bash
git add lancamentos.html lancamentos.js
git commit -m "feat(lancamentos): tela de Configuracoes com visualizacao de rubricas/observacoes e CRUD de rubricas personalizadas"
```

---

### Task 6: Verificação final e push

**Files:** nenhum (só validação e push)

- [ ] **Step 1: Checar sintaxe final de todo o arquivo JS**

Run: `node --check lancamentos.js`
Expected: sem saída (sucesso).

- [ ] **Step 2: Checar IDs duplicados no HTML (sanity check simples)**

Run: `grep -oE 'id="[^"]+"' lancamentos.html | sort | uniq -d`
Expected: sem saída (nenhum ID duplicado).

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Registrar pendência manual pro usuário**

Nenhum comando — só lembrar no resumo final que `schema_rh_rubricas_personalizadas.sql` precisa ser executado manualmente no SQL Editor do Supabase antes da funcionalidade funcionar em produção (a tela de Configurações e o seletor de rubrica dependem da coluna `descricao_rubrica` existir).

---

## Self-Review

**Cobertura da spec:**
- Seletor de rubrica configurada (Passo 3) → Task 3.
- Resolução de código por empregado/empresa no TXT → Task 4.
- Observações por empresa (Passo 3) → Task 3, Step 2/3.
- Tela de Configurações (view rubricas fixas + observações, CRUD de personalizadas) → Task 5.
- Migração de schema (`descricao_rubrica`) → Task 1.
- Fallback "Outra rubrica" (digitar código manualmente) → Task 3, Step 4.

**Placeholders:** nenhum "TBD"/"similar to" — todo passo tem código completo.

**Consistência de tipos:** `rubricasGrid[i]` usa sempre `{id, evento, label, tipoValor, codigosPorEmpresa?, codigo?}` nas Tasks 3 e 4; `gerarConteudoTXT(comp, tipoProcesso, coluna, itens)` e `resolverCodigoRubrica(coluna, codEmpresa)` usam a mesma forma de `coluna` (`r`) em `gerarParametrizacoes`.
