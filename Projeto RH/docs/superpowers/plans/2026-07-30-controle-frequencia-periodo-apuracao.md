# Período de Apuração Customizado por Empresa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a ferramenta Controle de Frequência apure um intervalo de dias fora
do mês calendário da competência (ex.: 28/06 a 28/07 para competência 07/2026),
configurável e persistido por empresa.

**Architecture:** `gerarDiasDoMes(competencia, diaInicio, diaFim)` passa a aceitar um
intervalo customizado opcional; a config por empresa é persistida em
`rh_config_rubricas_txt` (3 eventos novos, mesmo padrão key-value já usado para jornada) e
editada no modal "Configurar Rubricas por Empresa" já existente em `index.html`. Os 6
pontos de chamada de `gerarDiasDoMes` em `script.js` passam a resolver e repassar o
período da empresa correspondente.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS client. `script.js` não tem
`module.exports` nem suíte de testes automatizados (diferente de `escala-calculo.js`,
`ferias-parser.js` etc., que são módulos Node separados com `test-*.js`) — verificação é
manual via navegador, conforme já é o padrão do resto do arquivo.

## Global Constraints

- Sem migração SQL nova — reaproveitar `rh_config_rubricas_txt` (spec seção 2).
- Sem alterar Gerar Escala, Gerar Benefícios, Ajuda de Custo ITC, Fechamento de Folha
  (fora de escopo, spec seção "Fora de escopo").
- Comportamento padrão (sem período customizado) deve ficar bit-a-bit igual ao atual.
- TXT de lançamento continua identificado pela competência MM/AAAA, não pelo período.

---

### Task 1: Generalizar `gerarDiasDoMes` para aceitar período customizado

**Files:**
- Modify: `script.js:4959-4983` (função `gerarDiasDoMes`)

**Interfaces:**
- Produces: `gerarDiasDoMes(competencia: string, diaInicio?: number|null, diaFim?: number|null): Array<{data, diaSemana, entrada1, saida1, entrada2, saida2, entrada3, saida3}>`
  - `diaInicio`/`diaFim` omitidos, `null`, `0` ou inválidos (não numéricos, fora de 1–31,
    ou `diaInicio` resultando em intervalo vazio/invertido) → comportamento atual (mês
    calendário completo).
  - Válidos → itera de `diaInicio` do mês anterior até `diaFim` do mês da competência,
    inclusive nas duas pontas.

- [ ] **Step 1: Substituir a implementação da função**

Localizar a função atual (script.js:4959):

```javascript
function gerarDiasDoMes(competencia) {
    if (!competencia) return [];
    const [mes, ano] = competencia.split('/');
    const mesInt = parseInt(mes);
    const anoInt = parseInt(ano);
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const mesStr = String(mesInt).padStart(2, '0');
    const anoStr = String(anoInt);
    const ultimoDia = new Date(anoInt, mesInt, 0).getDate();
    const dias = [];
    for (let i = 1; i <= ultimoDia; i++) {
        const data = new Date(anoInt, mesInt - 1, i);
        dias.push({
            data: `${String(i).padStart(2, '0')}/${mesStr}/${anoStr}`,
            diaSemana: diasSemana[data.getDay()],
            entrada1: '',
            saida1: '',
            entrada2: '',
            saida2: '',
            entrada3: '',
            saida3: ''
        });
    }
    return dias;
}
```

Substituir por:

```javascript
function _diaObjeto(dataObj) {
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const d = String(dataObj.getDate()).padStart(2, '0');
    const m = String(dataObj.getMonth() + 1).padStart(2, '0');
    const a = String(dataObj.getFullYear());
    return {
        data: `${d}/${m}/${a}`,
        diaSemana: diasSemana[dataObj.getDay()],
        entrada1: '',
        saida1: '',
        entrada2: '',
        saida2: '',
        entrada3: '',
        saida3: ''
    };
}

function gerarDiasDoMes(competencia, diaInicio = null, diaFim = null) {
    if (!competencia) return [];
    const [mes, ano] = competencia.split('/');
    const mesInt = parseInt(mes);
    const anoInt = parseInt(ano);

    const inicioValido = Number.isInteger(diaInicio) && diaInicio >= 1 && diaInicio <= 31;
    const fimValido = Number.isInteger(diaFim) && diaFim >= 1 && diaFim <= 31;

    if (!inicioValido || !fimValido) {
        const ultimoDia = new Date(anoInt, mesInt, 0).getDate();
        const dias = [];
        for (let i = 1; i <= ultimoDia; i++) {
            dias.push(_diaObjeto(new Date(anoInt, mesInt - 1, i)));
        }
        return dias;
    }

    // Mês anterior: clampa o dia de início ao último dia real desse mês
    const ultimoDiaMesAnterior = new Date(anoInt, mesInt - 1, 0).getDate();
    const inicioClamp = Math.min(diaInicio, ultimoDiaMesAnterior);
    const dataInicio = new Date(anoInt, mesInt - 2, inicioClamp);

    // Mês da competência: clampa o dia de fim ao último dia real desse mês
    const ultimoDiaCompetencia = new Date(anoInt, mesInt, 0).getDate();
    const fimClamp = Math.min(diaFim, ultimoDiaCompetencia);
    const dataFim = new Date(anoInt, mesInt - 1, fimClamp);

    if (dataInicio > dataFim) {
        const dias = [];
        for (let i = 1; i <= ultimoDiaCompetencia; i++) {
            dias.push(_diaObjeto(new Date(anoInt, mesInt - 1, i)));
        }
        return dias;
    }

    const dias = [];
    const cursor = new Date(dataInicio.getTime());
    while (cursor <= dataFim) {
        dias.push(_diaObjeto(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return dias;
}
```

- [ ] **Step 2: Verificar manualmente no console do navegador**

Com `index.html` aberto (ou via `node -e` carregando o trecho isoladamente), confirmar:

```javascript
gerarDiasDoMes('07/2026').length === 31            // comportamento padrão inalterado
gerarDiasDoMes('07/2026', null, null).length === 31 // omitido = padrão
gerarDiasDoMes('07/2026', 28, 28)[0].data === '28/06/2026'
gerarDiasDoMes('07/2026', 28, 28).at(-1).data === '28/07/2026'
gerarDiasDoMes('07/2026', 28, 28).length === 31
gerarDiasDoMes('03/2026', 31, 31)[0].data === '28/02/2026' // fev/2026 não é bissexto, clampa pro dia 28
```

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat(rh-frequencia): gerarDiasDoMes aceita periodo customizado opcional"
```

---

### Task 2: Campos de configuração no modal (index.html)

**Files:**
- Modify: `index.html` (modal "Configurar Rubricas por Empresa", após o bloco "Jornada de Trabalho", por volta da linha 1119)

**Interfaces:**
- Produces: elementos DOM `cfgPeriodoApuracaoAtivo` (checkbox), `cfgPeriodoApuracaoContainer` (div, controla visibilidade), `cfgPeriodoApuracaoDiaInicio` (input number), `cfgPeriodoApuracaoDiaFim` (input number), `cfgPeriodoApuracaoExemplo` (span de texto auxiliar) — consumidos pela Task 3.

- [ ] **Step 1: Inserir a nova seção logo após o `</div>` que fecha o bloco "Jornada de Trabalho" (index.html:1119) e antes do comentário `<!-- Benefícios (VT/VA) -->`**

```html
                <!-- Período de Apuração -->
                <div style="margin-top: 18px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                    <div style="background: var(--background-color); padding: 8px 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Período de Apuração</span>
                    </div>
                    <div style="padding: 14px 14px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <input type="checkbox" id="cfgPeriodoApuracaoAtivo" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="document.getElementById('cfgPeriodoApuracaoContainer').style.display = this.checked ? 'block' : 'none'; atualizarExemploPeriodoApuracao();">
                            <label for="cfgPeriodoApuracaoAtivo" style="font-size: 13px; cursor: pointer; margin: 0;">Usar período customizado (fora do mês calendário)</label>
                        </div>
                        <div id="cfgPeriodoApuracaoContainer" style="display: none; padding-left: 24px;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <label style="font-size: 13px; font-weight: 500; min-width: 190px;">Dia de início (mês anterior)</label>
                                <input type="number" id="cfgPeriodoApuracaoDiaInicio" min="1" max="31" placeholder="28" oninput="atualizarExemploPeriodoApuracao()"
                                    style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 70px;">
                            </div>
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <label style="font-size: 13px; font-weight: 500; min-width: 190px;">Dia de fim (mês da competência)</label>
                                <input type="number" id="cfgPeriodoApuracaoDiaFim" min="1" max="31" placeholder="28" oninput="atualizarExemploPeriodoApuracao()"
                                    style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 70px;">
                            </div>
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                <span id="cfgPeriodoApuracaoExemplo">Ex.: para competência 07/2026 → 28/06/2026 a 28/07/2026</span>
                            </div>
                        </div>
                    </div>
                </div>

```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(rh-frequencia): campos de periodo de apuracao no modal de config por empresa"
```

---

### Task 3: Carregar, exibir, calcular exemplo e salvar a configuração

**Files:**
- Modify: `script.js` (`_preencherCamposConfigRubricas` ~linha 1979, `_limparCamposConfigRubricas` ~linha 2019, `salvarConfigRubricas` ~linha 2688, nova função `atualizarExemploPeriodoApuracao`)

**Interfaces:**
- Consumes: `_buscarConfigRubricas(codigoEmpresa)` (já existente, retorna `{ evento: { cod, tipo } }`), elementos DOM da Task 2.
- Produces: `atualizarExemploPeriodoApuracao(): void` (lida por `onchange`/`oninput` da Task 2); helper `_resolverPeriodoApuracao(cfg): { diaInicio: number|null, diaFim: number|null }` consumido pelas Tasks 4 e 5.

- [ ] **Step 1: Adicionar o helper de resolução, logo após `_buscarConfigRubricas` (script.js:1946)**

```javascript
function _resolverPeriodoApuracao(cfg) {
    if (!cfg || cfg['periodo_apuracao_ativo']?.cod !== '1') return { diaInicio: null, diaFim: null };
    const diaInicio = parseInt(cfg['periodo_apuracao_dia_inicio']?.cod, 10);
    const diaFim = parseInt(cfg['periodo_apuracao_dia_fim']?.cod, 10);
    return {
        diaInicio: Number.isInteger(diaInicio) ? diaInicio : null,
        diaFim: Number.isInteger(diaFim) ? diaFim : null
    };
}
```

- [ ] **Step 2: Preencher os campos ao abrir a config de uma empresa — em `_preencherCamposConfigRubricas` (script.js:1979), logo antes do `const cBenExcluirFeriados` (linha 2015)**

```javascript
    const cPeriodoAtivo   = document.getElementById('cfgPeriodoApuracaoAtivo');
    const cPeriodoCont    = document.getElementById('cfgPeriodoApuracaoContainer');
    const cPeriodoInicio  = document.getElementById('cfgPeriodoApuracaoDiaInicio');
    const cPeriodoFim     = document.getElementById('cfgPeriodoApuracaoDiaFim');
    const periodoAtivo    = cfg['periodo_apuracao_ativo']?.cod === '1';
    if (cPeriodoAtivo)  cPeriodoAtivo.checked = periodoAtivo;
    if (cPeriodoCont)   cPeriodoCont.style.display = periodoAtivo ? 'block' : 'none';
    if (cPeriodoInicio) cPeriodoInicio.value = cfg['periodo_apuracao_dia_inicio']?.cod || '';
    if (cPeriodoFim)    cPeriodoFim.value = cfg['periodo_apuracao_dia_fim']?.cod || '';
    atualizarExemploPeriodoApuracao();
```

- [ ] **Step 3: Limpar os campos ao trocar/limpar empresa — em `_limparCamposConfigRubricas` (script.js:2019), logo antes do fechamento da função (linha 2051, antes do `}`)**

```javascript
    const cPeriodoAtivo2  = document.getElementById('cfgPeriodoApuracaoAtivo');
    const cPeriodoCont2   = document.getElementById('cfgPeriodoApuracaoContainer');
    const cPeriodoInicio2 = document.getElementById('cfgPeriodoApuracaoDiaInicio');
    const cPeriodoFim2    = document.getElementById('cfgPeriodoApuracaoDiaFim');
    if (cPeriodoAtivo2)  cPeriodoAtivo2.checked = false;
    if (cPeriodoCont2)   cPeriodoCont2.style.display = 'none';
    if (cPeriodoInicio2) cPeriodoInicio2.value = '';
    if (cPeriodoFim2)    cPeriodoFim2.value = '';
    atualizarExemploPeriodoApuracao();
```

- [ ] **Step 4: Adicionar `atualizarExemploPeriodoApuracao`, logo após `_resolverPeriodoApuracao` (mesmo local do Step 1)**

```javascript
function atualizarExemploPeriodoApuracao() {
    const el = document.getElementById('cfgPeriodoApuracaoExemplo');
    if (!el) return;
    const diaInicio = parseInt(document.getElementById('cfgPeriodoApuracaoDiaInicio')?.value, 10);
    const diaFim = parseInt(document.getElementById('cfgPeriodoApuracaoDiaFim')?.value, 10);
    if (!Number.isInteger(diaInicio) || !Number.isInteger(diaFim) || diaInicio < 1 || diaInicio > 31 || diaFim < 1 || diaFim > 31) {
        el.textContent = 'Informe o dia de início e o dia de fim para ver um exemplo.';
        return;
    }
    const comp = document.getElementById('competencia')?.value;
    const [mesStr, anoStr] = validarCompetencia(comp) ? comp.split('/') : ['07', String(new Date().getFullYear())];
    const mesInt = parseInt(mesStr, 10);
    const anoInt = parseInt(anoStr, 10);
    const dias = gerarDiasDoMes(`${mesStr}/${anoStr}`, diaInicio, diaFim);
    if (dias.length === 0) { el.textContent = ''; return; }
    el.textContent = `Ex.: para competência ${mesStr}/${anoStr} → ${dias[0].data} a ${dias.at(-1).data}`;
}
```

- [ ] **Step 5: Persistir ao salvar — em `salvarConfigRubricas` (script.js:2688), adicionar ao array `jornadaRows` (linha 2699-2711), como novos itens antes do fechamento `];`**

```javascript
        { codigo_empresa: codigoEmpresa, evento: 'periodo_apuracao_ativo',      codigo_rubrica: document.getElementById('cfgPeriodoApuracaoAtivo')?.checked ? '1' : '0', tipo_valor: 'config' },
        { codigo_empresa: codigoEmpresa, evento: 'periodo_apuracao_dia_inicio', codigo_rubrica: (document.getElementById('cfgPeriodoApuracaoDiaInicio')?.value || '').trim(), tipo_valor: 'config' },
        { codigo_empresa: codigoEmpresa, evento: 'periodo_apuracao_dia_fim',    codigo_rubrica: (document.getElementById('cfgPeriodoApuracaoDiaFim')?.value || '').trim(), tipo_valor: 'config' },
```

- [ ] **Step 6: Commit**

```bash
git add script.js
git commit -m "feat(rh-frequencia): carregar, exibir e salvar periodo de apuracao por empresa"
```

---

### Task 4: Resolver o período na abertura da folha e usá-lo nos pontos de sessão ativa

**Files:**
- Modify: `script.js` (`state` ~linha 11, `inicializarEventos`/submit do `selectionForm` ~linha 260-282, criação de nova folha em branco ~linha 670-674, `importarExcel` ~linha 5108-5114)

**Interfaces:**
- Consumes: `_resolverPeriodoApuracao` (Task 3), `_buscarConfigRubricas` (existente), `gerarDiasDoMes` (Task 1).
- Produces: `state.periodoApuracaoInicio: number|null`, `state.periodoApuracaoFim: number|null`.

- [ ] **Step 1: Adicionar os dois novos campos ao `state` (script.js:11-29), logo após `competencia: ''`**

```javascript
    periodoApuracaoInicio: null,
    periodoApuracaoFim: null,
```

- [ ] **Step 2: Resolver o período ao submeter o formulário — em `inicializarEventos` (script.js:261-282), logo após `state.empresaSelecionada = state.empresas.find(...)` (linha 275)**

```javascript
        const cfgPeriodo = await _buscarConfigRubricas(codEmp);
        const { diaInicio, diaFim } = _resolverPeriodoApuracao(cfgPeriodo);
        state.periodoApuracaoInicio = diaInicio;
        state.periodoApuracaoFim = diaFim;
```

- [ ] **Step 3: Usar o período resolvido ao criar folha em branco — script.js:673**

```javascript
        dados: gerarDiasDoMes(state.competencia, state.periodoApuracaoInicio, state.periodoApuracaoFim),
```

- [ ] **Step 4: Usar o período resolvido ao importar Excel na sessão ativa — script.js:5111**

```javascript
                    dados: gerarDiasDoMes(state.competencia, state.periodoApuracaoInicio, state.periodoApuracaoFim),
```

- [ ] **Step 5: Verificar manualmente no navegador**

Rodar a ferramenta (ver Task 6), configurar uma empresa de teste com período 28/28,
selecioná-la com competência 07/2026 e confirmar que a tabela de lançamento mostra
28/06/2026 como primeira linha e 28/07/2026 como última.

- [ ] **Step 6: Commit**

```bash
git add script.js
git commit -m "feat(rh-frequencia): resolver periodo de apuracao ao abrir a folha e usar na sessao ativa"
```

---

### Task 5: Usar o período resolvido nos modelos de planilha (individual e em lote)

**Files:**
- Modify: `script.js` (`gerarModeloExcel` ~linha 5005-5036, `baixarModelosGrupo` ~linha 2282-2329, `_parseExcelParaFolhas` ~linha 2389-2430, `processarLoteGrupo` ~linha 2434-2495)

**Interfaces:**
- Consumes: `_buscarConfigRubricas`, `_resolverPeriodoApuracao`, `gerarDiasDoMes` (Task 1 e 3).
- Produces: `_parseExcelParaFolhas(wb, empregados, comTerceiroTurno, competencia, diaInicio, diaFim)` (assinatura estendida).

- [ ] **Step 1: Resolver o período no modelo individual — em `gerarModeloExcel` (script.js:5005), logo antes de `const diasDoMes = gerarDiasDoMes(comp);` (linha 5035)**

```javascript
        const cfgModelo = await _buscarConfigRubricas(codEmp);
        const { diaInicio: diModelo, diaFim: dfModelo } = _resolverPeriodoApuracao(cfgModelo);
        const diasDoMes = gerarDiasDoMes(comp, diModelo, dfModelo);
```

(remove a linha antiga `const diasDoMes = gerarDiasDoMes(comp);`)

- [ ] **Step 2: Mover a geração dos dias para dentro do loop por empresa em `baixarModelosGrupo` (script.js:2282-2329)**

Remover a linha `const diasDoMes = gerarDiasDoMes(comp);` (linha 2291, antes do loop `for (const empresa of _grupoAtual.empresas)`).

Dentro do loop, logo após `const comTerceiroTurno = cfg?.['terceiro_turno']?.cod === '1';` (linha 2308), adicionar:

```javascript
            const { diaInicio: diGrupo, diaFim: dfGrupo } = _resolverPeriodoApuracao(cfg);
            const diasDoMes = gerarDiasDoMes(comp, diGrupo, dfGrupo);
```

- [ ] **Step 3: Estender `_parseExcelParaFolhas` para aceitar o período (script.js:2389)**

```javascript
function _parseExcelParaFolhas(wb, empregados, comTerceiroTurno, competencia, diaInicio = null, diaFim = null) {
```

E na linha 2409, trocar:

```javascript
        const folha = { empregadoId: empregado.codigo_empregado, nome: empregado.nome_empregado, dados: gerarDiasDoMes(competencia, diaInicio, diaFim), dsrDias: [], flagsFolga: {} };
```

- [ ] **Step 4: Repassar o período no chamador `processarLoteGrupo` (script.js:2489-2495)**

Logo após `const comTerceiroTurno = cfg?.['terceiro_turno']?.cod === '1';` (linha 2490), adicionar:

```javascript
            const { diaInicio: diLote, diaFim: dfLote } = _resolverPeriodoApuracao(cfg);
```

E atualizar a chamada (linha 2495):

```javascript
            const { folhas, avisosAbas } = _parseExcelParaFolhas(wb, empregados, comTerceiroTurno, comp, diLote, dfLote);
```

- [ ] **Step 5: Verificar manualmente no navegador**

Com a mesma empresa de teste (período 28/28) configurada, baixar o "Modelo Excel"
individual para competência 07/2026 e confirmar que a primeira linha da planilha é
28/06/2026 e a última é 28/07/2026. Repetir para "Modelos do grupo" com um grupo contendo
essa empresa e outra sem período customizado, confirmando que a segunda empresa mantém o
mês calendário completo.

- [ ] **Step 6: Commit**

```bash
git add script.js
git commit -m "feat(rh-frequencia): aplicar periodo de apuracao nos modelos de planilha individual e em lote"
```

---

### Task 6: Feedback visual do período ativo

**Files:**
- Modify: `script.js` (banner da empresa selecionada em `selecionarEmpresa` ~linha 175-192, cabeçalho do Excel exportado em `exportarParaExcel` ~linha 1770-1771)

**Interfaces:**
- Consumes: `state.periodoApuracaoInicio/Fim`, `state.competencia`, `gerarDiasDoMes`.

- [ ] **Step 1: Adicionar helper de texto do período, logo após `_resolverPeriodoApuracao` (Task 3, Step 1)**

```javascript
function _textoPeriodoApuracao(competencia, diaInicio, diaFim) {
    if (!Number.isInteger(diaInicio) || !Number.isInteger(diaFim) || !validarCompetencia(competencia)) return '';
    const dias = gerarDiasDoMes(competencia, diaInicio, diaFim);
    if (dias.length === 0) return '';
    return ` (período: ${dias[0].data} a ${dias.at(-1).data})`;
}
```

- [ ] **Step 2: Complementar o banner da empresa — em `atualizarBannerObservacoes` ou onde o texto "🏢 ... 📅 ..." é montado (script.js:4856)**

Localizar:

```javascript
            sub.textContent = `🏢 ${state.empresaSelecionada.codigo_empresa} — ${state.empresaSelecionada.nome_empresa}  ·  📅 ${state.competencia}`;
```

Substituir por:

```javascript
            const textoPeriodo = _textoPeriodoApuracao(state.competencia, state.periodoApuracaoInicio, state.periodoApuracaoFim);
            sub.textContent = `🏢 ${state.empresaSelecionada.codigo_empresa} — ${state.empresaSelecionada.nome_empresa}  ·  📅 ${state.competencia}${textoPeriodo}`;
```

- [ ] **Step 3: Complementar o cabeçalho do Excel exportado — script.js:1771**

```javascript
    const textoPeriodoExport = _textoPeriodoApuracao(state.competencia, state.periodoApuracaoInicio, state.periodoApuracaoFim);
    const infoCabecalho = `Empresa: ${state.empresaSelecionada.codigo_empresa} - ${state.empresaSelecionada.nome_empresa} | Competência: ${state.competencia}${textoPeriodoExport}`;
```

- [ ] **Step 4: Verificar manualmente no navegador**

Selecionar a empresa de teste (período 28/28) com competência 07/2026 e confirmar que o
banner mostra "📅 07/2026 (período: 28/06/2026 a 28/07/2026)". Exportar o Excel final e
confirmar o mesmo texto no cabeçalho da planilha.

- [ ] **Step 5: Commit**

```bash
git add script.js
git commit -m "feat(rh-frequencia): exibir periodo de apuracao ativo no banner e na exportacao"
```

---

### Task 7: Verificação final end-to-end e push

**Files:** nenhum (verificação + push)

- [ ] **Step 1: Rodar a aplicação localmente e validar o fluxo completo**

Usar a skill `run` (ou um servidor estático simples, ex. `npx serve .` na pasta do
projeto) para abrir `index.html` no navegador. Repetir o roteiro:
1. Abrir "Configurar Rubricas por Empresa", selecionar uma empresa de teste, ativar
   "Usar período customizado", definir início=28 e fim=28, salvar.
2. Reabrir a config da mesma empresa e confirmar que os valores voltam preenchidos.
3. Na tela principal, selecionar essa empresa com competência 07/2026 — confirmar banner
   e primeira/última linha da tabela (28/06/2026 a 28/07/2026).
4. Baixar modelo Excel individual — confirmar datas.
5. Selecionar uma empresa **sem** período customizado — confirmar que o comportamento
   permanece o mês calendário completo (01/07/2026 a 31/07/2026), sem texto de período no
   banner.
6. Preencher alguns horários, salvar e confirmar que o DSR automático (domingos) continua
   marcando corretamente mesmo com domingos vindos do mês anterior.

- [ ] **Step 2: Rodar as suítes de teste Node existentes para garantir que nada foi quebrado por engano**

```bash
node test-escala-calculo.js
node test-ferias-parser.js
node test-jornada-parser.js
node test-folha-ponto-solides-parser.js
```

Expected: todas passam (script.js não é importado por elas, então isso apenas confirma
que os módulos irmãos não foram afetados).

- [ ] **Step 3: Push**

```bash
git push
```
