# Terceiro Turno (ENTRADA3/SAIDA3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte opt-in a um terceiro turno (entrada3/saida3) na folha de ponto, ativado por flag em localStorage + checkbox na UI.

**Architecture:** Flag `state.terceiroTurno` (lida de localStorage `rh_terceiro_turno`) controla visibilidade das colunas e participação nos cálculos. O modelo de dados sempre inicializa os campos, mas os ignora quando flag desativada.

**Tech Stack:** Vanilla JS, SheetJS (XLSX), Supabase

---

### Task 1: Modelo de dados + state flag

**Files:**
- Modify: `Projeto RH/script.js` — `state`, `DOMContentLoaded`, `gerarDiasDoMes`, nova função `alternarTerceiroTurno`

- [ ] Adicionar `terceiroTurno: false` ao objeto `state` (linha ~11)

```js
const state = {
    empresas: [],
    empregadosDisponiveis: [],
    empresaSelecionada: null,
    competencia: '',
    folhas: [],
    abaAtivaIndex: 0,
    feriados: [],
    jornada: '08:00',
    ruleExtra100Optional: false,
    terceiroTurno: false,
    resultados: []
};
```

- [ ] Ler localStorage no `DOMContentLoaded` (após `carregarFeriadosPadrao()`)

```js
state.terceiroTurno = localStorage.getItem('rh_terceiro_turno') === 'true';
document.getElementById('terceiroTurno').checked = state.terceiroTurno;
```

- [ ] Adicionar `entrada3`/`saida3` em `gerarDiasDoMes`

```js
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
```

- [ ] Adicionar função `alternarTerceiroTurno` após `inicializarEventos`

```js
function alternarTerceiroTurno(checked) {
    state.terceiroTurno = checked;
    localStorage.setItem('rh_terceiro_turno', checked);
    renderizarConteudoAba();
}
```

- [ ] Commit: `feat: state flag terceiroTurno + campo entrada3/saida3 no modelo de dias`

---

### Task 2: Checkbox na UI (index.html)

**Files:**
- Modify: `Projeto RH/index.html` — adicionar setting-card após o de `ruleExtra100Optional`

- [ ] Adicionar o card logo após o fechamento do `</div>` do card de Horas Extras (linha ~106):

```html
<div class="setting-card">
    <h4>Turnos</h4>
    <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="terceiroTurno" onchange="alternarTerceiroTurno(this.checked)" style="width: 18px; height: 18px; cursor: pointer;">
        <label for="terceiroTurno" style="font-size: 13px; cursor: pointer; margin: 0;">Empresa com 3 turnos (Entrada 3 / Saída 3)</label>
    </div>
    <small style="display: block; margin-top: 5px;">Ativa colunas e cálculos do terceiro período de trabalho</small>
</div>
```

- [ ] Commit: `feat: checkbox terceiroTurno na UI`

---

### Task 3: Tabela de edição (renderizarConteudoAba + limparLinha)

**Files:**
- Modify: `Projeto RH/script.js` — `renderizarConteudoAba`, `limparLinha`

- [ ] No cabeçalho da tabela, após `<th>Saída 2</th>`, adicionar colunas condicionais:

```js
<th>Entrada 1</th>
<th>Saída 1</th>
<th>Entrada 2</th>
<th>Saída 2</th>
${state.terceiroTurno ? '<th>Entrada 3</th><th>Saída 3</th>' : ''}
<th>DSR</th>
```

- [ ] Na linha de cada dia, atualizar `temEntrada` e adicionar inputs condicionais após saida2:

```js
const temEntrada = dia.entrada1 || dia.entrada2 || (state.terceiroTurno && dia.entrada3);
```

```js
<td><input type="text" class="time-input" value="${dia.saida2}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'saida2', this.value)" placeholder="00:00" maxlength="5"></td>
${state.terceiroTurno ? `
<td><input type="text" class="time-input" value="${dia.entrada3}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'entrada3', this.value)" placeholder="00:00" maxlength="5"></td>
<td><input type="text" class="time-input" value="${dia.saida3}" onchange="atualizarDado(${state.abaAtivaIndex}, ${diaIndex}, 'saida3', this.value)" placeholder="00:00" maxlength="5"></td>` : ''}
<td style="text-align: center;">
```

- [ ] Em `limparLinha`, adicionar limpeza de entrada3/saida3:

```js
window.limparLinha = function(folhaIndex, diaIndex) {
    state.folhas[folhaIndex].dados[diaIndex].entrada1 = '';
    state.folhas[folhaIndex].dados[diaIndex].saida1 = '';
    state.folhas[folhaIndex].dados[diaIndex].entrada2 = '';
    state.folhas[folhaIndex].dados[diaIndex].saida2 = '';
    state.folhas[folhaIndex].dados[diaIndex].entrada3 = '';
    state.folhas[folhaIndex].dados[diaIndex].saida3 = '';
    renderizarConteudoAba();
};
```

- [ ] Commit: `feat: colunas Entrada3/Saida3 condicionais na tabela de edição`

---

### Task 4: calcularHorasNoturnas — aceitar 3º par

**Files:**
- Modify: `Projeto RH/script.js` — `calcularHorasNoturnas`

- [ ] Estender assinatura para aceitar e3/s3 (ambos opcionais):

```js
function calcularHorasNoturnas(e1, s1, e2, s2, e3, s3) {
    const inicioNoturno = 22 * 60, fimNoturno = 5 * 60;
    let minNoturnos = 0;
    const calcularNoturnoIntervalo = (entrada, saida) => {
        if (!entrada || !saida) return 0;
        let minE = converterHoraParaMinutos(entrada);
        let minS = converterHoraParaMinutos(saida);
        if (minS < minE) minS += 24 * 60;
        let noturno = 0;
        if (minE < fimNoturno && minS > fimNoturno) noturno += fimNoturno - minE;
        if (minE < inicioNoturno && minS > inicioNoturno) noturno += minS - inicioNoturno;
        if (minE >= inicioNoturno || minS <= fimNoturno) {
            if (minE >= inicioNoturno) noturno += minS - minE;
            else if (minS <= fimNoturno) noturno += minS - minE;
        }
        return noturno;
    };
    minNoturnos += calcularNoturnoIntervalo(e1, s1);
    minNoturnos += calcularNoturnoIntervalo(e2, s2);
    minNoturnos += calcularNoturnoIntervalo(e3, s3);
    return minNoturnos;
}
```

- [ ] Commit: `feat: calcularHorasNoturnas aceita 3º par e3/s3`

---

### Task 5: calcularFolha — somar 3º turno

**Files:**
- Modify: `Projeto RH/script.js` — `calcularFolha`

- [ ] Atualizar `minTrabalhados` e chamada de `calcularHorasNoturnas`:

```js
const minTrabalhados = calcularHorasTrabalhadas(dia.entrada1, dia.saida1)
    + calcularHorasTrabalhadas(dia.entrada2, dia.saida2)
    + (state.terceiroTurno ? calcularHorasTrabalhadas(dia.entrada3, dia.saida3) : 0);
const minNoturnos = calcularHorasNoturnas(
    dia.entrada1, dia.saida1,
    dia.entrada2, dia.saida2,
    state.terceiroTurno ? dia.entrada3 : null,
    state.terceiroTurno ? dia.saida3 : null
);
```

- [ ] Incluir `entrada3`/`saida3` no objeto retornado por `diasCalculados.map`:

```js
return {
    data: dia.data,
    diaSemana: dia.diaSemana,
    entrada1: dia.entrada1,
    saida1: dia.saida1,
    entrada2: dia.entrada2,
    saida2: dia.saida2,
    entrada3: dia.entrada3 || '',
    saida3: dia.saida3 || '',
    trabalhado: converterMinutosParaHora(minTrabalhados),
    // ... demais campos inalterados
};
```

- [ ] Commit: `feat: calcularFolha soma 3º turno quando terceiroTurno ativo`

---

### Task 6: _construirConteudoTXTExportacao — 3º turno

**Files:**
- Modify: `Projeto RH/script.js` — `_construirConteudoTXTExportacao`

- [ ] Atualizar `minTrab` e `minNot` no loop `dados.forEach`:

```js
const minTrab = calcularHorasTrabalhadas(dia.entrada1, dia.saida1)
    + calcularHorasTrabalhadas(dia.entrada2, dia.saida2)
    + (state.terceiroTurno ? calcularHorasTrabalhadas(dia.entrada3, dia.saida3) : 0);
const minNot  = calcularHorasNoturnas(
    dia.entrada1, dia.saida1,
    dia.entrada2, dia.saida2,
    state.terceiroTurno ? dia.entrada3 : null,
    state.terceiroTurno ? dia.saida3 : null
);
```

- [ ] Commit: `feat: exportação TXT considera 3º turno`

---

### Task 7: importarExcel + gerarModeloExcel

**Files:**
- Modify: `Projeto RH/script.js` — `importarExcel`, `gerarModeloExcel`

- [ ] Em `importarExcel`, após setar saida2, adicionar leitura condicional de row[6]/row[7]:

```js
state.folhas[folhaIdx].dados[diaIdx].entrada1 = normalizeHora(row[2]);
state.folhas[folhaIdx].dados[diaIdx].saida1   = normalizeHora(row[3]);
state.folhas[folhaIdx].dados[diaIdx].entrada2 = normalizeHora(row[4]);
state.folhas[folhaIdx].dados[diaIdx].saida2   = normalizeHora(row[5]);
if (state.terceiroTurno) {
    state.folhas[folhaIdx].dados[diaIdx].entrada3 = normalizeHora(row[6]);
    state.folhas[folhaIdx].dados[diaIdx].saida3   = normalizeHora(row[7]);
}
```

- [ ] Em `gerarModeloExcel`, tornar header e colunas condicionais:

```js
const header = state.terceiroTurno
    ? ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3']
    : ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'];
const rows = [header, ...diasDoMes.map(d => state.terceiroTurno
    ? [d.data, d.diaSemana, '', '', '', '', '', '']
    : [d.data, d.diaSemana, '', '', '', ''])];
```

Atualizar `ws['!cols']` condicionalmente:

```js
ws['!cols'] = state.terceiroTurno
    ? [{ wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
    : [{ wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
```

- [ ] Commit: `feat: importarExcel e gerarModeloExcel suportam 3º turno`

---

### Task 8: renderizarTabelasDiarias + exportarParaExcel — marcacoes

**Files:**
- Modify: `Projeto RH/script.js` — `renderizarTabelasDiarias`, `exportarParaExcel`

- [ ] Em `renderizarTabelasDiarias`, atualizar `marcacoes`:

```js
const marcacoes = [dia.entrada1, dia.saida1, dia.entrada2, dia.saida2,
    dia.entrada3, dia.saida3].filter(v => v).join(' - ') || '-';
```

- [ ] Em `exportarParaExcel`, atualizar `marcacoes` no `res.dias.forEach`:

```js
const marcacoes = [dia.entrada1, dia.saida1, dia.entrada2, dia.saida2,
    dia.entrada3, dia.saida3].filter(v => v).join(' - ') || '-';
```

- [ ] Commit: `feat: exibição e export Excel incluem entrada3/saida3`
