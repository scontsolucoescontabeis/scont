# Faltas em Dias e Atestado Médico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar faltas (dias inteiros, manual) de horas faltantes (jornada incompleta), adicionar Atestado Médico como flag neutro igual à folga, e sinalizar visualmente dias sem nenhum registro.

**Architecture:** Todas as mudanças estão em `script.js` — função `calcularFolha` (lógica de cálculo), função de renderização da tabela de entrada (`renderizarConteudoAba`), e função de exibição de resultados (`renderizarConsolidado` + `renderizarTabelasDiarias`). Sem mudança de banco de dados — o campo `flagsFolga` já armazena strings, basta aceitar `'atestado'` como novo valor.

**Tech Stack:** JavaScript vanilla, HTML inline (sem framework, sem build step)

---

## Arquivos Impactados

- Modify: `Projeto RH/script.js`
  - `calcularFolha` (~linha 1040): lógica de classificação por dia e totalizadores
  - Renderização da tabela de entrada (~linha 659): dropdown de flags
  - `renderizarTabelasDiarias` (~linha 1314): badges por dia
  - `renderizarConsolidado` (~linha 1263): card de totais

---

## Task 1: Lógica de cálculo — `calcularFolha`

**Files:**
- Modify: `Projeto RH/script.js:1042–1135`

### O que muda

Hoje (linha 1042):
```js
let totalTrabalhado = 0, totalExtra50 = 0, totalExtra100 = 0, totalNoturno = 0, totalNoturnoConvertido = 0, totalFaltante = 0;
```

Por dia sem horas (linhas 1094-1104):
```js
} else if (!isDiaDescanso) {
    const flagFolgaData = folha.flagsFolga[dia.data];
    if (flagFolgaData === 'folga') {
        flagFolga = true;
    } else if (flagFolgaData === 'falta') {
        faltante = jornadaMinutos;
        flagFalta = true;
    } else {
        faltante = jornadaMinutos;
        flagFalta = true;
    }
}
```

Objeto retornado por dia (linha 1119-1136):
```js
return {
    ...
    flagFolga: flagFolga,
    flagFalta: flagFalta
};
```

Totais retornados (linha 1173-1186):
```js
totais: {
    ...
    faltante: converterMinutosParaHora(totalFaltante),
    devidas: converterMinutosParaHora(horasDevidasMinutos)
}
```

### Passos

- [ ] **Step 1: Atualizar inicialização dos totalizadores**

Substituir a linha 1042 de:
```js
let totalTrabalhado = 0, totalExtra50 = 0, totalExtra100 = 0, totalNoturno = 0, totalNoturnoConvertido = 0, totalFaltante = 0;
```
Para:
```js
let totalTrabalhado = 0, totalExtra50 = 0, totalExtra100 = 0, totalNoturno = 0, totalNoturnoConvertido = 0, totalFaltante = 0, totalFaltas = 0;
```

- [ ] **Step 2: Atualizar flags iniciais por dia**

Substituir (linha 1055):
```js
let flagFolga = false, flagFalta = false;
```
Para:
```js
let flagFolga = false, flagFalta = false, flagAtestado = false, flagSemRegistro = false;
```

- [ ] **Step 3: Substituir lógica do bloco `else if (!isDiaDescanso)`**

Substituir o bloco inteiro (linhas 1094-1105):
```js
} else if (!isDiaDescanso) {
    const flagFolgaData = folha.flagsFolga[dia.data];
    if (flagFolgaData === 'folga') {
        flagFolga = true;
    } else if (flagFolgaData === 'falta') {
        faltante = jornadaMinutos;
        flagFalta = true;
    } else {
        faltante = jornadaMinutos;
        flagFalta = true;
    }
}
```
Por:
```js
} else if (!isDiaDescanso) {
    const flagFolgaData = folha.flagsFolga[dia.data];
    if (flagFolgaData === 'folga') {
        flagFolga = true;
    } else if (flagFolgaData === 'atestado') {
        flagAtestado = true;
    } else if (flagFolgaData === 'falta') {
        flagFalta = true;
        totalFaltas += 1;
    } else {
        flagSemRegistro = true;
    }
}
```

- [ ] **Step 4: Acrescentar `totalFaltas` no acumulador de totais**

Após a linha `totalFaltante += faltante;` (linha 1117), não é necessário acumular `totalFaltas` aqui pois já é feito dentro do `if (flagFalgaData === 'falta')` acima. Verificar que não há dupla contagem.

- [ ] **Step 5: Acrescentar novos flags no objeto retornado por dia**

Substituir o final do `return` dentro do `.map` (linhas 1134-1135):
```js
    flagFolga: flagFolga,
    flagFalta: flagFalta
```
Por:
```js
    flagFolga: flagFolga,
    flagFalta: flagFalta,
    flagAtestado: flagAtestado,
    flagSemRegistro: flagSemRegistro
```

- [ ] **Step 6: Acrescentar `faltas` nos totais retornados**

Substituir (linha 1183-1184):
```js
            faltante: converterMinutosParaHora(totalFaltante),
            devidas: converterMinutosParaHora(horasDevidasMinutos)
```
Por:
```js
            faltante: converterMinutosParaHora(totalFaltante),
            faltas: totalFaltas,
            devidas: converterMinutosParaHora(horasDevidasMinutos)
```

- [ ] **Step 7: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: separar faltas (dias) de horas faltantes em calcularFolha"
```

---

## Task 2: Dropdown da tabela de entrada — adicionar Atestado Médico

**Files:**
- Modify: `Projeto RH/script.js:659–663`

### O que muda

Hoje o select de flag (linha 659-663):
```html
<select onchange="atualizarFlagFolga(...)">
    <option value="">-</option>
    <option value="folga" ...>Folga</option>
    <option value="falta" ...>Falta</option>
</select>
```

### Passos

- [ ] **Step 1: Adicionar opção Atestado Médico no select**

Substituir o bloco do `<select>` (linha 659-663):
```js
<select onchange="atualizarFlagFolga(${state.abaAtivaIndex}, '${dia.data}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ced4da; font-size: 12px;">
    <option value="">-</option>
    <option value="folga" ${flagFolga === 'folga' ? 'selected' : ''}>Folga</option>
    <option value="falta" ${flagFolga === 'falta' ? 'selected' : ''}>Falta</option>
</select>
```
Por:
```js
<select onchange="atualizarFlagFolga(${state.abaAtivaIndex}, '${dia.data}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ced4da; font-size: 12px;">
    <option value="">-</option>
    <option value="folga" ${flagFolga === 'folga' ? 'selected' : ''}>Folga</option>
    <option value="falta" ${flagFolga === 'falta' ? 'selected' : ''}>Falta</option>
    <option value="atestado" ${flagFolga === 'atestado' ? 'selected' : ''}>Atestado Médico</option>
</select>
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: adicionar Atestado Médico no dropdown de flags da folha de ponto"
```

---

## Task 3: Badges na tabela de resultados diários

**Files:**
- Modify: `Projeto RH/script.js:1314–1326`

### O que muda

Hoje o bloco de flags (linhas 1314-1326) não tem badge para atestado nem sem registro.

### Passos

- [ ] **Step 1: Adicionar badges de Atestado e Sem Registro**

Após o bloco existente de flags (após o `if (isFeriado)` que fecha em ~linha 1326), acrescentar:

Dentro do bloco `let flags = '';` ... `if (isFeriado)`, adicionar após o badge de FALTA:
```js
if (dia.flagAtestado) {
    flags += '<span style="background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">ATESTADO</span>';
}
if (dia.flagSemRegistro) {
    flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">SEM REGISTRO</span>';
}
```

O bloco completo de flags deve ficar:
```js
let flags = '';
if (dia.flagDSR) {
    flags += '<span style="background: #4f46e5; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">DSR</span>';
}
if (dia.flagFolga) {
    flags += '<span style="background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">FOLGA</span>';
}
if (dia.flagFalta) {
    flags += '<span style="background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">FALTA</span>';
}
if (dia.flagAtestado) {
    flags += '<span style="background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">ATESTADO</span>';
}
if (dia.flagSemRegistro) {
    flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">SEM REGISTRO</span>';
}
if (isFeriado) {
    flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px;">FERIADO</span>';
}
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: adicionar badges de Atestado e Sem Registro na tabela de resultados"
```

---

## Task 4: Card de Faltas no consolidado de totais

**Files:**
- Modify: `Projeto RH/script.js:1262–1270`

### O que muda

Hoje a grade de totais (linhas 1262-1270) tem: Trabalhado | Adic. Noturno | Horas Faltantes | Horas Devidas.

Adicionar um card "Faltas" entre "Horas Faltantes" e "Horas Devidas".

### Passos

- [ ] **Step 1: Inserir card de Faltas no grid**

Substituir o bloco do card "Horas Faltantes" e "Horas Devidas" (linhas 1262-1269):
```js
                    <div style="background: #fff5f5; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Horas Faltantes</div>
                        <div style="font-size: 24px; font-weight: 800; color: #991b1b; margin-top: 8px;">${res.totais.faltante}</div>
                    </div>
                    <div style="background: #fef3c7; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #92400e; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Horas Devidas</div>
                        <div style="font-size: 24px; font-weight: 800; color: #92400e; margin-top: 8px;">${res.totais.devidas}</div>
                    </div>
```
Por:
```js
                    <div style="background: #fff5f5; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Horas Faltantes</div>
                        <div style="font-size: 24px; font-weight: 800; color: #991b1b; margin-top: 8px;">${res.totais.faltante}</div>
                    </div>
                    <div style="background: #fff5f5; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Faltas</div>
                        <div style="font-size: 24px; font-weight: 800; color: #991b1b; margin-top: 8px;">${res.totais.faltas} ${res.totais.faltas === 1 ? 'dia' : 'dias'}</div>
                    </div>
                    <div style="background: #fef3c7; padding: 20px 15px; text-align: center;">
                        <div style="font-size: 11px; color: #92400e; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Horas Devidas</div>
                        <div style="font-size: 24px; font-weight: 800; color: #92400e; margin-top: 8px;">${res.totais.devidas}</div>
                    </div>
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: exibir contador de faltas (dias) no consolidado da folha de ponto"
```
