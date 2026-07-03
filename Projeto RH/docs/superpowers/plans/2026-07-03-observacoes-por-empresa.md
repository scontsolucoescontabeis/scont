# Observações por Empresa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cadastrar uma observação de texto livre por empresa no modal de Configuração de Rubricas, e exibi-la como um banner fixo na tela de lançamento assim que a empresa é selecionada.

**Architecture:** Reaproveita a tabela EAV `rh_config_rubricas_txt` (mesma usada para jornada e rubricas) com um novo evento `'observacoes'` — sem migração de banco. Um textarea no modal grava/lê esse evento; um banner na tela de lançamento é populado a partir do mesmo config já buscado em `selecionarEmpresa()`.

**Tech Stack:** JavaScript vanilla, HTML inline, Supabase (Postgres) via `supabaseClient`. Sem build step, sem framework de testes.

## Global Constraints

- Novo evento EAV: `'observacoes'` (valor de texto livre em `codigo_rubrica`, `tipo_valor: 'texto'`).
- Campo de texto livre, sem `maxlength`.
- Banner na tela de lançamento é fixo (não precisa ser fechado), aparece só quando há observação, some quando não há.
- Nenhuma migração de banco necessária.
- **IMPORTANTE:** os números de linha citados abaixo refletem o estado do arquivo no momento em que este plano foi escrito. Use sempre o bloco de código exato (`old_string`) para localizar o trecho a editar — não confie apenas no número da linha.

---

## Arquivos Impactados

- Modify: `Projeto RH/index.html`
  - Modal "Configurar Rubricas por Empresa" (~linha 700-727): novo textarea "Observações"
  - Topo de `mainScreen` (~linha 129-131): novo banner (inicialmente oculto)
- Modify: `Projeto RH/script.js`
  - `salvarConfigRubricas()` (~linha 1860-1889): gravar o novo evento
  - `_preencherCamposConfigRubricas()` / `_limparCamposConfigRubricas()` (~linha 1765-1805): ler/limpar o textarea
  - `selecionarEmpresa()` (~linha 119-146): popular/ocultar o banner

---

## Task 1: Cadastro da observação no modal de Configuração de Rubricas

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Adicionar o textarea no modal**

Em `index.html`, localizar (~linha 720-727):
```html
                        <div id="cfgJornadaSabadoContainer" style="display: none; align-items: center; gap: 12px; padding-left: 24px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas no Sábado</label>
                            <input type="text" id="cfgJornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                            <input type="checkbox" id="cfgSabadoSempreExtra" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="if (this.checked) { document.getElementById('cfgJornadaSabadoAtiva').checked = false; document.getElementById('cfgJornadaSabadoContainer').style.display = 'none'; }">
                            <label for="cfgSabadoSempreExtra" style="font-size: 13px; cursor: pointer; margin: 0;">Sábado sempre extra</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-top: 1px solid #eee;">
```
Substituir por:
```html
                        <div id="cfgJornadaSabadoContainer" style="display: none; align-items: center; gap: 12px; padding-left: 24px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas no Sábado</label>
                            <input type="text" id="cfgJornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                            <input type="checkbox" id="cfgSabadoSempreExtra" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="if (this.checked) { document.getElementById('cfgJornadaSabadoAtiva').checked = false; document.getElementById('cfgJornadaSabadoContainer').style.display = 'none'; }">
                            <label for="cfgSabadoSempreExtra" style="font-size: 13px; cursor: pointer; margin: 0;">Sábado sempre extra</label>
                        </div>
                    </div>
                </div>

                <!-- Observações -->
                <div style="margin-top: 18px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                    <div style="background: var(--background-color); padding: 8px 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Observações</span>
                    </div>
                    <div style="padding: 14px 14px;">
                        <textarea id="cfgObservacoes" rows="4" placeholder="Observações sobre esta empresa, exibidas ao iniciar o preenchimento da folha..."
                            style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: inherit; resize: vertical;"></textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-top: 1px solid #eee;">
```

- [ ] **Step 2: Salvar o novo evento em `salvarConfigRubricas`**

Em `script.js`, localizar (~linha 1871-1876):
```js
    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra',   codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
    ];
```
Substituir por:
```js
    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra',   codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'observacoes',           codigo_rubrica: (document.getElementById('cfgObservacoes')?.value || '').trim(),            tipo_valor: 'texto' },
    ];
```

- [ ] **Step 3: Preencher o textarea ao abrir o modal para uma empresa**

Localizar (~linha 1765-1786):
```js
function _preencherCamposConfigRubricas(cfg) {
    if (!cfg) { _limparCamposConfigRubricas(); return; }
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
    const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
    const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
    if (jSabAtiva) jSabAtiva.checked = sabAtiva;
    if (jSabCont)  jSabCont.style.display = sabAtiva ? 'flex' : 'none';
    if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
}
```
Substituir por:
```js
function _preencherCamposConfigRubricas(cfg) {
    if (!cfg) { _limparCamposConfigRubricas(); return; }
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    const jObservacoes  = document.getElementById('cfgObservacoes');
    if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
    const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
    const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
    if (jSabAtiva) jSabAtiva.checked = sabAtiva;
    if (jSabCont)  jSabCont.style.display = sabAtiva ? 'flex' : 'none';
    if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    if (jObservacoes) jObservacoes.value = cfg['observacoes']?.cod || '';
}
```

- [ ] **Step 4: Limpar o textarea junto com os demais campos**

Localizar (~linha 1788-1805):
```js
function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = false;
}
```
Substituir por:
```js
function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    const jObservacoes  = document.getElementById('cfgObservacoes');
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = false;
    if (jObservacoes) jObservacoes.value = '';
}
```

- [ ] **Step 5: Verificação manual**

Abrir a ferramenta no navegador (`Projeto RH/index.html`), abrir "⚙️ Configurações" na sidebar, buscar uma empresa, digitar um texto em "Observações" e salvar. Reabrir o modal para a mesma empresa e confirmar que o texto volta preenchido. Testar "Limpar Empresa" e confirmar que o campo volta vazio. Buscar uma empresa diferente (sem observação salva) e confirmar que o campo aparece vazio.

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: adicionar campo de observações por empresa no modal de Configuração de Rubricas"
```

---

## Task 2: Banner de observação na tela de lançamento

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Adicionar o banner (inicialmente oculto) no topo de `mainScreen`**

Localizar (~linha 128-131):
```html
        <!-- TELA PRINCIPAL (Preenchimento) -->
        <div id="mainScreen" style="display: none;">
            
            <!-- Sistema de Abas (Empregados) -->
```
Substituir por:
```html
        <!-- TELA PRINCIPAL (Preenchimento) -->
        <div id="mainScreen" style="display: none;">

            <!-- Observações da empresa -->
            <div id="empresaObservacoesBanner" style="display: none; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; gap: 10px; align-items: flex-start;">
                <span style="font-size: 16px; line-height: 1;">📝</span>
                <span id="empresaObservacoesTexto" style="font-size: 13px; white-space: pre-wrap; line-height: 1.5;"></span>
            </div>

            <!-- Sistema de Abas (Empregados) -->
```

O banner nasce com `display: none` (oculto). O `gap`/`align-items` só têm efeito quando o JavaScript (Step 2) trocar o `display` para `flex` — não há `display: flex` no HTML para evitar qualquer conflito com o `display: none` na mesma declaração de estilo.

- [ ] **Step 2: Popular/ocultar o banner em `selecionarEmpresa`**

Em `script.js`, localizar (~linha 119-146):
```js
async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    const jDiaria       = document.getElementById('jornada');
    const jSabAtiva     = document.getElementById('jornadaSabadoAtiva');
    const jSabCont      = document.getElementById('jornadaSabadoContainer');
    const jSab          = document.getElementById('jornadaSabado');
    const jSabSempreExt = document.getElementById('sabadoSempreExtra');
    if (cfg && cfg['jornada_diaria']) {
        if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
        const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
        const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
        if (jSabAtiva) { jSabAtiva.checked = sabAtiva; }
        if (jSabCont)  jSabCont.style.display = sabAtiva ? 'block' : 'none';
        if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    } else {
        if (jDiaria)   jDiaria.value    = '08:00';
        if (jSabAtiva) jSabAtiva.checked = false;
        if (jSabCont)  jSabCont.style.display = 'none';
        if (jSab)      jSab.value       = '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = false;
    }
}
```
Substituir por:
```js
async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    const jDiaria       = document.getElementById('jornada');
    const jSabAtiva     = document.getElementById('jornadaSabadoAtiva');
    const jSabCont      = document.getElementById('jornadaSabadoContainer');
    const jSab          = document.getElementById('jornadaSabado');
    const jSabSempreExt = document.getElementById('sabadoSempreExtra');
    const obsBanner     = document.getElementById('empresaObservacoesBanner');
    const obsTexto      = document.getElementById('empresaObservacoesTexto');
    if (cfg && cfg['jornada_diaria']) {
        if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
        const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
        const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
        if (jSabAtiva) { jSabAtiva.checked = sabAtiva; }
        if (jSabCont)  jSabCont.style.display = sabAtiva ? 'block' : 'none';
        if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    } else {
        if (jDiaria)   jDiaria.value    = '08:00';
        if (jSabAtiva) jSabAtiva.checked = false;
        if (jSabCont)  jSabCont.style.display = 'none';
        if (jSab)      jSab.value       = '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = false;
    }
    const observacoes = cfg?.['observacoes']?.cod?.trim() || '';
    if (obsBanner && obsTexto) {
        obsTexto.textContent = observacoes;
        obsBanner.style.display = observacoes ? 'flex' : 'none';
    }
}
```

- [ ] **Step 3: Verificação manual**

No navegador, cadastrar uma observação para uma empresa (via Task 1). Selecionar essa empresa na tela de seleção (competência + empresa) e continuar — confirmar que o banner aparece no topo da tela principal com o texto da observação, permanece visível enquanto a empresa estiver selecionada, e não pode ser fechado. Selecionar uma empresa sem observação cadastrada e confirmar que o banner não aparece.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: exibir banner de observações da empresa na tela de lançamento"
```

---

## Task 3: Verificação manual final (checklist de regressão)

Sem framework de testes automatizados neste projeto, feche o trabalho com uma rodada manual:

- [ ] **Step 1:** Uma empresa sem observação cadastrada não mostra nenhum textarea preenchido no modal, nem banner na tela de lançamento.
- [ ] **Step 2:** Salvar uma observação, trocar de empresa no modal (sem salvar), reabrir a empresa original — o texto salvo permanece intacto (não foi sobrescrito pela troca).
- [ ] **Step 3:** O banner não interfere com o restante do layout de `mainScreen` (abas de empregados, seção de Configurações) quando visível ou oculto.
- [ ] **Step 4:** "Limpar Empresa" no modal remove a observação salva (confirmar que uma nova seleção dessa empresa na tela de lançamento não mostra mais o banner).

Nenhum commit necessário neste task — é só verificação.
