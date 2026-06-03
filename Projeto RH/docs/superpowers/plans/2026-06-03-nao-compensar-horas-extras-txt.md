# Não Compensação de Horas Extras na Geração do TXT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar checkbox "Não compensar horas extras com horas faltantes" nos dois modais de geração de TXT, e ao marcá-lo gerar o TXT com valores brutos (sem compensação) e label "Horas Faltantes" no lugar de "Atraso".

**Architecture:** Dois modais afetados — `txtRubricasModal` (individual) e `exportTxtModal` (lote). Cada modal ganha um checkbox e um span com ID para o label "Atraso". A lógica de compensação em `_construirConteudoTXTResultados` e `_construirConteudoTXTExportacao` é condicionada ao estado do checkbox. Não há persistência.

**Tech Stack:** HTML, JavaScript vanilla, sem frameworks.

---

## Arquivos

- Modificar: `Projeto RH/index.html` — adicionar checkboxes e IDs nos spans "Atraso"
- Modificar: `Projeto RH/script.js` — lógica condicional em duas funções + função de toggle de label

---

### Task 1: Adicionar checkbox e ID no span "Atraso" — modal de exportação (`exportTxtModal`)

**Files:**
- Modify: `Projeto RH/index.html:163-217`

- [ ] **Step 1: Adicionar checkbox após o label "Configuração de Rubricas" no modal de exportação**

Em `index.html`, o label "Configuração de Rubricas" do modal de exportação está na linha ~163. Substituir:

```html
                    <label style="font-weight: 600; font-size: 13px; display: block; margin-bottom: 8px; color: var(--text-primary);">Configuração de Rubricas</label>
```

Por:

```html
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Configuração de Rubricas</label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); cursor: pointer;">
                            <input type="checkbox" id="expNaoCompensar" onchange="_toggleNaoCompensar('exp')">
                            Não compensar horas extras
                        </label>
                    </div>
```

- [ ] **Step 2: Adicionar ID no span "Atraso" do modal de exportação**

Na linha ~198, substituir:

```html
                            <span style="font-size: 13px; font-weight: 500;">Atraso</span>
```

Por:

```html
                            <span id="expLabelAtraso" style="font-size: 13px; font-weight: 500;">Atraso</span>
```

- [ ] **Step 3: Commit**

```
git add "Projeto RH/index.html"
git commit -m "feat: checkbox não compensar e ID no label Atraso — modal exportação"
```

---

### Task 2: Adicionar checkbox e ID no span "Atraso" — modal individual (`txtRubricasModal`)

**Files:**
- Modify: `Projeto RH/index.html:386-440`

- [ ] **Step 1: Adicionar checkbox após o label "Configuração de Rubricas" no modal individual**

Em `index.html`, linha ~386. Substituir:

```html
                    <label style="font-weight: 600; font-size: 13px; display: block; margin-bottom: 8px; color: var(--text-primary);">Configuração de Rubricas</label>
```

Por:

```html
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Configuração de Rubricas</label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); cursor: pointer;">
                            <input type="checkbox" id="resNaoCompensar" onchange="_toggleNaoCompensar('res')">
                            Não compensar horas extras
                        </label>
                    </div>
```

- [ ] **Step 2: Adicionar ID no span "Atraso" do modal individual**

Na linha ~421, substituir:

```html
                            <span style="font-size: 13px; font-weight: 500;">Atraso</span>
```

Por:

```html
                            <span id="resLabelAtraso" style="font-size: 13px; font-weight: 500;">Atraso</span>
```

- [ ] **Step 3: Commit**

```
git add "Projeto RH/index.html"
git commit -m "feat: checkbox não compensar e ID no label Atraso — modal individual"
```

---

### Task 3: Adicionar função `_toggleNaoCompensar` no script.js

**Files:**
- Modify: `Projeto RH/script.js` — adicionar logo após a função `_linhasFaltas` (linha ~1569)

- [ ] **Step 1: Inserir função após `_linhasFaltas`**

Após o fechamento da função `_linhasFaltas` (linha ~1569), adicionar:

```js
function _toggleNaoCompensar(prefix) {
    const checked = document.getElementById(prefix + 'NaoCompensar').checked;
    document.getElementById(prefix + 'LabelAtraso').textContent = checked ? 'Horas Faltantes' : 'Atraso';
}
```

- [ ] **Step 2: Resetar checkbox ao abrir cada modal**

Na função `abrirModalTxtResultados` (linha ~2077), adicionar antes do `classList.add('active')`:

```js
document.getElementById('resNaoCompensar').checked = false;
document.getElementById('resLabelAtraso').textContent = 'Atraso';
```

Na função `abrirModalExportacaoTXT` (linha ~1590), adicionar antes de `document.getElementById('exportTxtModal').classList.add('active')`:

```js
document.getElementById('expNaoCompensar').checked = false;
document.getElementById('expLabelAtraso').textContent = 'Atraso';
```

- [ ] **Step 3: Commit**

```
git add "Projeto RH/script.js"
git commit -m "feat: função _toggleNaoCompensar e reset ao abrir modais"
```

---

### Task 4: Lógica condicional em `_construirConteudoTXTResultados`

**Files:**
- Modify: `Projeto RH/script.js:2092-2126`

Localizar a função `_construirConteudoTXTResultados`. O trecho relevante atualmente é:

```js
    state.resultados.forEach(res => {
        let he50 = converterHoraParaMinutos(res.totais.extra50);
        let he100 = converterHoraParaMinutos(res.totais.extra100);
        let devRest = converterHoraParaMinutos(res.totais.faltante);
        const abate50 = Math.min(he50, devRest); he50 -= abate50; devRest -= abate50;
        const abate100 = Math.min(he100, devRest); he100 -= abate100;
        const diasFaltaRes = res.dias.filter(d => d.flagFalta);
        conteudoTXT += _linhasTxt(
            config,
            res.empregadoId,
            compFmt,
            codEmpresa,
            he50,
            he100,
            converterHoraParaMinutos(res.totais.noturnoConvertido),
            converterHoraParaMinutos(res.totais.devidas),
            diasFaltaRes.length
        );
```

- [ ] **Step 1: Substituir o bloco forEach para respeitar checkbox**

```js
    const naoCompensar = document.getElementById('resNaoCompensar').checked;
    state.resultados.forEach(res => {
        let he50 = converterHoraParaMinutos(res.totais.extra50);
        let he100 = converterHoraParaMinutos(res.totais.extra100);
        let minsAtr;
        if (naoCompensar) {
            minsAtr = converterHoraParaMinutos(res.totais.faltante);
        } else {
            let devRest = converterHoraParaMinutos(res.totais.faltante);
            const abate50 = Math.min(he50, devRest); he50 -= abate50; devRest -= abate50;
            const abate100 = Math.min(he100, devRest); he100 -= abate100;
            minsAtr = converterHoraParaMinutos(res.totais.devidas);
        }
        const diasFaltaRes = res.dias.filter(d => d.flagFalta);
        conteudoTXT += _linhasTxt(
            config,
            res.empregadoId,
            compFmt,
            codEmpresa,
            he50,
            he100,
            converterHoraParaMinutos(res.totais.noturnoConvertido),
            minsAtr,
            diasFaltaRes.length
        );
```

- [ ] **Step 2: Commit**

```
git add "Projeto RH/script.js"
git commit -m "feat: modo não compensar em _construirConteudoTXTResultados"
```

---

### Task 5: Lógica condicional em `_construirConteudoTXTExportacao`

**Files:**
- Modify: `Projeto RH/script.js:1723-1744`

Localizar o bloco de compensação dentro de `_construirConteudoTXTExportacao`. Atualmente:

```js
        // Compensar devidas com extras
        let devidasRestantes = tDev;
        if (devidasRestantes > 0) {
            const abate50  = Math.min(tEx50,  devidasRestantes); tEx50  -= abate50;  devidasRestantes -= abate50;
            const abate100 = Math.min(tEx100, devidasRestantes); tEx100 -= abate100; devidasRestantes -= abate100;
            tDev = Math.max(0, devidasRestantes);
        }

        conteudoTXT += _linhasTxt(
```

- [ ] **Step 1: Tornar o bloco de compensação condicional**

Antes do `Object.values(ultimasVersoes).forEach(save => {` (linha ~1666), adicionar:

```js
    const naoCompensar = document.getElementById('expNaoCompensar').checked;
```

Depois, substituir o bloco de compensação por:

```js
        if (!naoCompensar) {
            let devidasRestantes = tDev;
            if (devidasRestantes > 0) {
                const abate50  = Math.min(tEx50,  devidasRestantes); tEx50  -= abate50;  devidasRestantes -= abate50;
                const abate100 = Math.min(tEx100, devidasRestantes); tEx100 -= abate100; devidasRestantes -= abate100;
                tDev = Math.max(0, devidasRestantes);
            }
        }
```

- [ ] **Step 2: Commit**

```
git add "Projeto RH/script.js"
git commit -m "feat: modo não compensar em _construirConteudoTXTExportacao"
```

---

### Task 6: Verificação manual

- [ ] Abrir o app no navegador
- [ ] Processar uma folha com horas extras e horas faltantes no mesmo período
- [ ] Abrir modal individual → verificar que checkbox aparece desmarcado, label "Atraso" visível
- [ ] Marcar checkbox → verificar que label muda para "Horas Faltantes"
- [ ] Gerar prévia com compensação (desmarcado): extras reduzidas, atraso = devidas pós-compensação
- [ ] Gerar prévia sem compensação (marcado): extras cheias, faltantes = bruto
- [ ] Fechar e reabrir modal → confirmar que checkbox volta desmarcado e label volta "Atraso"
- [ ] Repetir os mesmos testes no modal de exportação em lote
