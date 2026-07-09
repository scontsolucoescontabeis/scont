# Configuração por Empresa (Extra 100%, Turnos, Não Compensar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar configuráveis por empresa, no modal "Configurar Rubricas por Empresa" do Controle de Frequência, a regra de hora extra 100% a partir da 3ª hora, o flag de 3 turnos e o default de "não compensar horas extras", pré-preenchendo esses valores automaticamente quando o operador seleciona a empresa (tela inicial) ou abre os modais de geração de TXT.

**Architecture:** Reaproveita a tabela `rh_config_rubricas_txt` já existente (chave `codigo_empresa` + `evento`, schema-less quanto ao `evento`) adicionando 3 novos `evento` (`rule_extra_100_opcional`, `terceiro_turno`, `nao_compensar_extras`). Nenhuma tabela nova. As mudanças de UI/JS seguem exatamente o padrão já usado para jornada de trabalho e observações no mesmo modal.

**Tech Stack:** HTML/JS vanilla, Supabase JS client, sem framework de build. Projeto não possui suite de testes automatizados.

## Global Constraints

- Não criar tabela nova — usar `rh_config_rubricas_txt` (evento schema-less).
- Valores booleanos são armazenados como string `'1'`/`'0'` em `codigo_rubrica`, com `tipo_valor: 'config'`.
- Os 3 checkboxes na tela de edição da folha (`ruleExtra100Optional`, `terceiroTurno`) e nos modais de TXT (`resNaoCompensar`, `expNaoCompensar`) continuam editáveis manualmente na sessão — a config da empresa só define o valor inicial.
- Sem suite de testes automatizados neste projeto: cada task é validada com `node --check <arquivo>` (sintaxe) e um roteiro de verificação manual documentado no passo de commit.
- Manter IDs consistentes com o prefixo `cfg` já usado no modal (`cfgRuleExtra100`, `cfgTerceiroTurno`, `cfgNaoCompensarDefault`).

---

## Task 1: UI — nova seção no modal "Configurar Rubricas por Empresa"

**Files:**
- Modify: `Projeto RH/index.html:842-846`

**Interfaces:**
- Produces: elementos `#cfgRuleExtra100`, `#cfgTerceiroTurno`, `#cfgNaoCompensarDefault` (checkboxes), consumidos pelas Tasks 2 e 3.

- [ ] **Step 1: Inserir a seção HTML**

Localizar em `index.html` o fechamento da seção "Jornada de Trabalho" e a abertura da seção "Observações" (linhas 842-846):

```html
                    </div>
                </div>

                <!-- Observações -->
                <div style="margin-top: 18px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
```

Substituir por (nova seção inserida entre as duas):

```html
                    </div>
                </div>

                <!-- Regras de Horas Extras e Turnos -->
                <div style="margin-top: 18px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                    <div style="background: var(--background-color); padding: 8px 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Regras de Horas Extras e Turnos</span>
                    </div>
                    <div style="padding: 14px 14px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <input type="checkbox" id="cfgRuleExtra100" style="width: 16px; height: 16px; cursor: pointer;">
                            <label for="cfgRuleExtra100" style="font-size: 13px; cursor: pointer; margin: 0;">Aplicar Hora Extra 100% a partir da 3ª hora</label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <input type="checkbox" id="cfgTerceiroTurno" style="width: 16px; height: 16px; cursor: pointer;">
                            <label for="cfgTerceiroTurno" style="font-size: 13px; cursor: pointer; margin: 0;">Empresa com 3 turnos (Entrada 3 / Saída 3)</label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="cfgNaoCompensarDefault" style="width: 16px; height: 16px; cursor: pointer;">
                            <label for="cfgNaoCompensarDefault" style="font-size: 13px; cursor: pointer; margin: 0;">Não compensar horas extras com horas faltantes (padrão ao gerar TXT)</label>
                        </div>
                    </div>
                </div>

                <!-- Observações -->
                <div style="margin-top: 18px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
```

- [ ] **Step 2: Validar sintaxe HTML abrindo o arquivo**

Run: `node -e "require('fs').readFileSync('index.html','utf8')" ` (apenas confirma que o arquivo é legível; validação real é visual)

Abrir `index.html` no navegador, ir em "⚙️ Configurar Rubricas por Empresa" e confirmar visualmente que a nova seção aparece entre "Jornada de Trabalho" e "Observações", com os 3 checkboxes desmarcados.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/index.html"
git commit -m "feat: adiciona secao de regras de horas extras e turnos no modal de config por empresa"
```

---

## Task 2: Persistência — salvar, preencher e limpar os 3 novos campos

**Files:**
- Modify: `Projeto RH/script.js:1888-1918` (`_preencherCamposConfigRubricas`)
- Modify: `Projeto RH/script.js:1920-1945` (`_limparCamposConfigRubricas`)
- Modify: `Projeto RH/script.js:2000-2032` (`salvarConfigRubricas`)

**Interfaces:**
- Consumes: `#cfgRuleExtra100`, `#cfgTerceiroTurno`, `#cfgNaoCompensarDefault` (Task 1).
- Produces: eventos `rule_extra_100_opcional`, `terceiro_turno`, `nao_compensar_extras` persistidos em `rh_config_rubricas_txt`, lidos por `_buscarConfigRubricas(codigo)` como `cfg['rule_extra_100_opcional']?.cod === '1'` etc. — consumido pelas Tasks 3 e 4.

- [ ] **Step 1: Atualizar `_preencherCamposConfigRubricas` para ler os novos campos do `cfg`**

Em `script.js`, localizar:

```js
    if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    if (jObservacoes) jObservacoes.value = cfg['observacoes']?.cod || '';
}
```

Substituir por:

```js
    if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    if (jObservacoes) jObservacoes.value = cfg['observacoes']?.cod || '';
    const cRuleExtra100 = document.getElementById('cfgRuleExtra100');
    const cTerceiroT    = document.getElementById('cfgTerceiroTurno');
    const cNaoComp      = document.getElementById('cfgNaoCompensarDefault');
    if (cRuleExtra100) cRuleExtra100.checked = cfg['rule_extra_100_opcional']?.cod === '1';
    if (cTerceiroT)    cTerceiroT.checked    = cfg['terceiro_turno']?.cod === '1';
    if (cNaoComp)      cNaoComp.checked      = cfg['nao_compensar_extras']?.cod === '1';
}
```

- [ ] **Step 2: Atualizar `_limparCamposConfigRubricas` para resetar os novos campos**

Localizar o final da função (após o reset de `jObservacoes`, antes do fechamento `}` da função — usar `Read` para confirmar as linhas exatas, pois a função continua após a linha 1935 lida anteriormente). O trecho final da função hoje é:

```js
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSexAtiva) jSexAtiva.checked = false;
    if (jSexCont)  jSexCont.style.display = 'none';
    if (jSex)      jSex.value       = '04:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = false;
    if (jObservacoes) jObservacoes.value = '';
}
```

Substituir por:

```js
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSexAtiva) jSexAtiva.checked = false;
    if (jSexCont)  jSexCont.style.display = 'none';
    if (jSex)      jSex.value       = '04:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = false;
    if (jObservacoes) jObservacoes.value = '';
    const cRuleExtra100 = document.getElementById('cfgRuleExtra100');
    const cTerceiroT    = document.getElementById('cfgTerceiroTurno');
    const cNaoComp      = document.getElementById('cfgNaoCompensarDefault');
    if (cRuleExtra100) cRuleExtra100.checked = false;
    if (cTerceiroT)    cTerceiroT.checked    = false;
    if (cNaoComp)      cNaoComp.checked      = false;
}
```

- [ ] **Step 3: Atualizar `salvarConfigRubricas` para persistir os 3 novos eventos**

Localizar:

```js
    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sexta_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSextaAtiva')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sexta',        codigo_rubrica: (document.getElementById('cfgJornadaSexta')?.value || '04:00').trim(),       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra',   codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'observacoes',           codigo_rubrica: (document.getElementById('cfgObservacoes')?.value || '').trim(),            tipo_valor: 'texto' },
    ];
```

Substituir por (adiciona 3 linhas ao array existente):

```js
    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sexta_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSextaAtiva')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sexta',        codigo_rubrica: (document.getElementById('cfgJornadaSexta')?.value || '04:00').trim(),       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra',   codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'observacoes',           codigo_rubrica: (document.getElementById('cfgObservacoes')?.value || '').trim(),            tipo_valor: 'texto' },
        { codigo_empresa: codigoEmpresa, evento: 'rule_extra_100_opcional', codigo_rubrica: document.getElementById('cfgRuleExtra100')?.checked ? '1' : '0',          tipo_valor: 'config' },
        { codigo_empresa: codigoEmpresa, evento: 'terceiro_turno',          codigo_rubrica: document.getElementById('cfgTerceiroTurno')?.checked ? '1' : '0',         tipo_valor: 'config' },
        { codigo_empresa: codigoEmpresa, evento: 'nao_compensar_extras',    codigo_rubrica: document.getElementById('cfgNaoCompensarDefault')?.checked ? '1' : '0',   tipo_valor: 'config' },
    ];
```

Não é necessário alterar o `upsert` logo abaixo — ele já faz `[...rows, ...jornadaRows]`.

- [ ] **Step 4: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída (sintaxe válida).

- [ ] **Step 5: Verificação manual**

No navegador: abrir "Configurar Rubricas por Empresa", selecionar uma empresa, marcar os 3 novos checkboxes, salvar. Reabrir o modal para a mesma empresa e confirmar que os 3 checkboxes vêm marcados. Testar também "Limpar Empresa" e confirmar que os 3 campos voltam a desmarcado.

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: persiste regra extra 100, terceiro turno e nao compensar por empresa"
```

---

## Task 3: Pré-preenchimento na tela inicial (`selecionarEmpresa`)

**Files:**
- Modify: `Projeto RH/script.js:128-134`

**Interfaces:**
- Consumes: `_buscarConfigRubricas(codigo)` retornando `cfg['rule_extra_100_opcional']` e `cfg['terceiro_turno']` (Task 2).
- Produces: checkboxes `#ruleExtra100Optional` e `#terceiroTurno` (tela de edição) refletindo a config da empresa ao entrar na sessão; `state.terceiroTurno` sincronizado.

- [ ] **Step 1: Editar `selecionarEmpresa`**

Localizar:

```js
async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
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
    const ruleExtra100El = document.getElementById('ruleExtra100Optional');
    const terceiroTurnoEl = document.getElementById('terceiroTurno');
    if (ruleExtra100El) ruleExtra100El.checked = cfg?.['rule_extra_100_opcional']?.cod === '1';
    if (terceiroTurnoEl) {
        const ativo = cfg?.['terceiro_turno']?.cod === '1';
        terceiroTurnoEl.checked = ativo;
        state.terceiroTurno = ativo;
    }
```

(o restante da função, a partir de `const jDiaria = document.getElementById('jornada');`, permanece inalterado)

- [ ] **Step 2: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída.

- [ ] **Step 3: Verificação manual**

Na empresa configurada na Task 2 (com os 3 checkboxes marcados), ir na tela inicial, selecionar essa empresa e confirmar que, ao entrar na tela de edição, os checkboxes "Aplicar Hora Extra 100% a partir da 3ª hora" e "Empresa com 3 turnos" já aparecem marcados. Selecionar uma empresa sem config e confirmar que ambos aparecem desmarcados.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: preenche regra extra 100 e terceiro turno a partir da config da empresa"
```

---

## Task 4: Pré-preenchimento do "não compensar" nos modais de TXT

**Files:**
- Modify: `Projeto RH/script.js:2291-2303` (`abrirModalExportacaoTXT`)
- Modify: `Projeto RH/script.js:2854-2870` (`abrirModalTxtResultados`)

**Interfaces:**
- Consumes: `_buscarConfigRubricas`, `_toggleNaoCompensar(prefix)` (já existente, script.js:2256), `cfg['nao_compensar_extras']` (Task 2).
- Produces: checkboxes `#resNaoCompensar` e `#expNaoCompensar` pré-marcados conforme a config da empresa, com o rótulo "Atraso"/"Horas Faltantes" já correto ao abrir o modal.

- [ ] **Step 1: Editar `abrirModalExportacaoTXT`**

Localizar:

```js
async function abrirModalExportacaoTXT() {
    document.getElementById('expNaoCompensar').checked = false;
    document.getElementById('expLabelAtraso').textContent = 'Atraso';
    document.getElementById('exportTxtModal').classList.add('active');
    document.getElementById('exportCompetencia').value = state.competencia || '';
    document.getElementById('exportEmpresasContainer').style.display = 'none';
    document.getElementById('expTxtPrevia').style.display = 'none';
    document.getElementById('btnGerarTXT').style.display = 'none';
    document.getElementById('btnPreviewTXT').style.display = 'none';
    const codEmp = state.empresaSelecionada?.codigo_empresa;
    const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
    _aplicarConfigRubricasNoCampos('exp', cfg);
}
```

Substituir por:

```js
async function abrirModalExportacaoTXT() {
    const codEmp = state.empresaSelecionada?.codigo_empresa;
    const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
    document.getElementById('expNaoCompensar').checked = cfg?.['nao_compensar_extras']?.cod === '1';
    _toggleNaoCompensar('exp');
    document.getElementById('exportTxtModal').classList.add('active');
    document.getElementById('exportCompetencia').value = state.competencia || '';
    document.getElementById('exportEmpresasContainer').style.display = 'none';
    document.getElementById('expTxtPrevia').style.display = 'none';
    document.getElementById('btnGerarTXT').style.display = 'none';
    document.getElementById('btnPreviewTXT').style.display = 'none';
    _aplicarConfigRubricasNoCampos('exp', cfg);
}
```

- [ ] **Step 2: Editar `abrirModalTxtResultados`**

Localizar:

```js
async function abrirModalTxtResultados() {
    if (!state.resultados || state.resultados.length === 0) {
        mostrarMensagem('Aviso', 'Não há dados processados para gerar o TXT.');
        return;
    }
    document.getElementById('resNaoCompensar').checked = false;
    document.getElementById('resLabelAtraso').textContent = 'Atraso';
    const codEmp = state.empresaSelecionada?.codigo_empresa;
    const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
    _aplicarConfigRubricasNoCampos('res', cfg);
    document.getElementById('resTxtPrevia').style.display = 'none';
```

Substituir por:

```js
async function abrirModalTxtResultados() {
    if (!state.resultados || state.resultados.length === 0) {
        mostrarMensagem('Aviso', 'Não há dados processados para gerar o TXT.');
        return;
    }
    const codEmp = state.empresaSelecionada?.codigo_empresa;
    const cfg = codEmp ? await _buscarConfigRubricas(codEmp) : null;
    document.getElementById('resNaoCompensar').checked = cfg?.['nao_compensar_extras']?.cod === '1';
    _toggleNaoCompensar('res');
    _aplicarConfigRubricasNoCampos('res', cfg);
    document.getElementById('resTxtPrevia').style.display = 'none';
```

(o restante da função permanece inalterado)

- [ ] **Step 3: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída.

- [ ] **Step 4: Verificação manual**

Com a empresa configurada na Task 2 (checkbox "não compensar" marcado): processar uma folha e abrir "Gerar TXT" — confirmar que o checkbox já vem marcado e o rótulo já mostra "Horas Faltantes". Abrir "Exportar TXT" com essa empresa selecionada na sessão — mesma checagem. Repetir com uma empresa sem config e confirmar que ambos os modais nascem com o checkbox desmarcado e rótulo "Atraso".

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: preenche nao compensar por padrao nos modais de geracao de TXT"
```

---

## Task 5: Documentar os novos eventos no schema

**Files:**
- Modify: `Projeto RH/schema_rh.sql:246-248`

**Interfaces:**
- Nenhuma (apenas comentário/documentação; não afeta código em execução).

- [ ] **Step 1: Atualizar o comentário da tabela**

Localizar:

```sql
-- ============================================================
-- 8. TABELA: rh_config_rubricas_txt
--    Presets de rubricas TXT por empresa (6 eventos fixos)
-- ============================================================
```

Substituir por:

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

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/schema_rh.sql"
git commit -m "docs: documenta novos eventos de config por empresa no schema"
```

---

## Self-Review

**Spec coverage:**
- Regra 100% configurável por empresa → Task 1 (UI), Task 2 (persistência), Task 3 (default na tela inicial). ✅
- 2 ou 3 turnos configurável por empresa → mesmas tasks, campo `terceiro_turno`. ✅
- Flag "não compensar" no modal de gerar TXT configurável por empresa → Task 1, Task 2, Task 4. ✅
- "Grupo de empresas" → explicitamente fora de escopo desta spec/plano (ver spec, seção "Fora de escopo").

**Placeholder scan:** nenhum "TBD"/"TODO" — todos os steps têm código completo.

**Type consistency:** IDs `cfgRuleExtra100` / `cfgTerceiroTurno` / `cfgNaoCompensarDefault` usados de forma consistente entre Task 1 (criação) e Task 2 (leitura/escrita). Eventos `rule_extra_100_opcional` / `terceiro_turno` / `nao_compensar_extras` usados de forma consistente entre Task 2 (escrita) e Tasks 3-4 (leitura).
