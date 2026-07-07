# Aviso de Descontos VA/VT ao Baixar TXT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar em "Baixar TXT" na tela de Resultados, se algum empregado tiver falta e/ou atestado médico no período, mostrar um modal de confirmação com a tabela de dias a descontar de VA/VT antes de baixar o arquivo.

**Architecture:** Toda a mudança está em `Projeto RH/script.js` (nova função pura de cálculo + refactor de `gerarTXTResultados` em duas funções) e `Projeto RH/index.html` (novo modal). Sem framework, sem build step, sem dependências novas. Não há test runner no projeto (app HTML/JS puro rodado no navegador), então a função pura de cálculo é testada com Node simples (`assert`) e o restante (modal/DOM) é verificado manualmente no navegador ao final.

**Tech Stack:** JavaScript vanilla, HTML inline, Node (só para o teste da função pura, não faz parte do app).

## Global Constraints

- Não alterar o fluxo de Exportação da tela inicial (`gerarArquivoTXT` / `exportTxtModal`).
- Não alterar a lógica de cálculo de `calcularFolha` nem o formato do TXT gerado.
- Contagem de dias a descontar considera apenas `flagFalta` e `flagAtestado` (não `flagAtestadoComparecimento`, não `flagLiberacaoMeioExpediente`).
- Quando nenhum empregado tem dias a descontar, o comportamento deve ser idêntico ao atual (download direto, sem modal extra).
- Seguir o padrão visual dos modais existentes (`.modal` / `.modal-content` / `.modal-header` / `.modal-body` / `.modal-footer`, ver `index.html:500-506`).

---

## Arquivos Impactados

- Modify: `Projeto RH/script.js`
  - Nova função `_calcularDiasDescontoVAVT` (pura, sem DOM)
  - Refactor de `gerarTXTResultados` (linhas 2870-2887) em `_efetivarDownloadTXTResultados` + nova `gerarTXTResultados`
  - Novas funções `_abrirModalAvisoDescontos`, `_fecharModalAvisoDescontos`, `_continuarDownloadAposAviso`
- Modify: `Projeto RH/index.html`
  - Novo modal `avisoDescontosModal` (inserido após o modal `txtRubricasModal`, que fecha por volta da linha 625)

---

## Task 1: Função pura de cálculo — `_calcularDiasDescontoVAVT`

**Files:**
- Modify: `Projeto RH/script.js` (adicionar função antes de `_construirConteudoTXTResultados`, ~linha 2795)
- Test: `scratchpad/test_calcular_dias_desconto.js` (script Node temporário, não faz parte do app)

**Interfaces:**
- Produces: `_calcularDiasDescontoVAVT(resultados: Array<{nome: string, empregadoId: string, dias: Array<{flagFalta?: boolean, flagAtestado?: boolean}>}>) => Array<{nome: string, empregadoId: string, dias: number}>` — usado pela Task 3.

- [ ] **Step 1: Escrever o script de teste em Node**

Criar `C:\Users\HERBER~1\AppData\Local\Temp\claude\C--Users-Herbert-G-L-J-Desktop-Projetos-HTML-Projeto-Portal-Scont-Projeto-RH\324947fc-bd8d-4d72-b05e-67d6df476bc9\scratchpad\test_calcular_dias_desconto.js`:

```js
const assert = require('assert');

// cole aqui a função _calcularDiasDescontoVAVT para rodar isolada (sem DOM)
function _calcularDiasDescontoVAVT(resultados) {
    return (resultados || [])
        .map(res => {
            const dias = (res.dias || []).filter(d => d.flagFalta || d.flagAtestado).length;
            return { nome: res.nome, empregadoId: res.empregadoId, dias };
        })
        .filter(item => item.dias > 0);
}

// Caso 1: empregado com 2 faltas e 1 atestado médico -> 3 dias
const r1 = _calcularDiasDescontoVAVT([
    { nome: 'João', empregadoId: '001', dias: [
        { flagFalta: true }, { flagFalta: true }, { flagAtestado: true }, {}
    ]}
]);
assert.deepStrictEqual(r1, [{ nome: 'João', empregadoId: '001', dias: 3 }]);

// Caso 2: nenhum empregado com falta/atestado -> lista vazia
const r2 = _calcularDiasDescontoVAVT([
    { nome: 'Maria', empregadoId: '002', dias: [{ flagFolga: true }, {}] }
]);
assert.deepStrictEqual(r2, []);

// Caso 3: atestado de comparecimento e liberação meio expediente NÃO contam
const r3 = _calcularDiasDescontoVAVT([
    { nome: 'Ana', empregadoId: '003', dias: [
        { flagAtestadoComparecimento: true }, { flagLiberacaoMeioExpediente: true }
    ]}
]);
assert.deepStrictEqual(r3, []);

// Caso 4: múltiplos empregados, só um com dias > 0
const r4 = _calcularDiasDescontoVAVT([
    { nome: 'João', empregadoId: '001', dias: [{ flagFalta: true }] },
    { nome: 'Maria', empregadoId: '002', dias: [{}] }
]);
assert.deepStrictEqual(r4, [{ nome: 'João', empregadoId: '001', dias: 1 }]);

console.log('OK: todos os casos passaram');
```

- [ ] **Step 2: Rodar o script e confirmar que passa**

Run: `node "C:\Users\HERBER~1\AppData\Local\Temp\claude\C--Users-Herbert-G-L-J-Desktop-Projetos-HTML-Projeto-Portal-Scont-Projeto-RH\324947fc-bd8d-4d72-b05e-67d6df476bc9\scratchpad\test_calcular_dias_desconto.js"`

Expected: `OK: todos os casos passaram`

Isso valida a lógica antes de colar no `script.js`. Se algum `assert` falhar, corrigir a função no script de teste e rodar de novo até passar.

- [ ] **Step 3: Adicionar a função validada em `script.js`**

Localizar a linha `function _construirConteudoTXTResultados(salvar = false) {` (por volta da linha 2797) e inserir imediatamente antes:

```js
function _calcularDiasDescontoVAVT(resultados) {
    return (resultados || [])
        .map(res => {
            const dias = (res.dias || []).filter(d => d.flagFalta || d.flagAtestado).length;
            return { nome: res.nome, empregadoId: res.empregadoId, dias };
        })
        .filter(item => item.dias > 0);
}

```

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: adiciona calculo de dias a descontar de VA/VT por empregado"
```

---

## Task 2: Modal HTML de aviso de descontos

**Files:**
- Modify: `Projeto RH/index.html` (inserir após o fechamento do modal `txtRubricasModal`)

**Interfaces:**
- Consumes: nenhum (markup estático)
- Produces: elementos DOM `avisoDescontosModal`, `avisoDescontosTbody` — usados pela Task 3.

- [ ] **Step 1: Localizar o fechamento do modal `txtRubricasModal`**

Buscar em `index.html` o `</div>` que fecha a `<div id="txtRubricasModal" class="modal">` (verificar a estrutura de fechamento correspondente ao bloco iniciado na linha 501; o modal termina antes do próximo comentário `<!-- MODAL: ... -->` ou elemento irmão).

- [ ] **Step 2: Inserir o novo modal imediatamente após o fechamento de `txtRubricasModal`**

```html
    <!-- MODAL: AVISO DE DESCONTOS VA/VT -->
    <div id="avisoDescontosModal" class="modal">
        <div class="modal-content" style="max-width: 520px;">
            <div class="modal-header">
                <h3 style="color: var(--primary-color); margin: 0;">⚠️ Descontos de VA/VT</h3>
                <button type="button" class="modal-close" onclick="_fecharModalAvisoDescontos()">×</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin-bottom: 12px; font-size: 14px;">Devem ser feitos os descontos de VA e VT para os empregados abaixo:</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f8f9fa; text-align: left;">
                            <th style="padding: 8px; border-bottom: 2px solid #dee2e6;">Empregado</th>
                            <th style="padding: 8px; border-bottom: 2px solid #dee2e6; text-align: center;">Dias a Descontar</th>
                        </tr>
                    </thead>
                    <tbody id="avisoDescontosTbody"></tbody>
                </table>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px 20px; border-top: 1px solid #eee;">
                <button type="button" class="btn btn-secondary" onclick="_fecharModalAvisoDescontos()">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="_continuarDownloadAposAviso()">Continuar e Baixar TXT</button>
            </div>
        </div>
    </div>

```

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/index.html"
git commit -m "feat: adiciona modal de aviso de descontos VA/VT"
```

---

## Task 3: Refactor de `gerarTXTResultados` e integração

**Files:**
- Modify: `Projeto RH/script.js:2870-2887` (função `gerarTXTResultados`)

**Interfaces:**
- Consumes: `_calcularDiasDescontoVAVT` (Task 1), elementos DOM `avisoDescontosModal`/`avisoDescontosTbody` (Task 2), `state.resultados` (já existente, array de `{ nome, empregadoId, dias, totais, ... }`)
- Produces: `_efetivarDownloadTXTResultados()`, `_abrirModalAvisoDescontos(lista)`, `_fecharModalAvisoDescontos()`, `_continuarDownloadAposAviso()` — funções globais chamadas a partir do HTML.

### O que muda

Hoje (linhas 2870-2887):

```js
function gerarTXTResultados() {
    try {
        const { conteudoTXT } = _construirConteudoTXTResultados(true);
        if (!conteudoTXT.trim()) { mostrarMensagem('Aviso', 'Nenhum valor positivo encontrado para as rubricas configuradas.'); return; }
        const [mm, aaaa] = state.competencia.split('/');
        const blob = new Blob([conteudoTXT], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `Lancamentos_${state.empresaSelecionada.codigo_empresa}_${mm}-${aaaa}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fecharModalTxtResultados();
        mostrarMensagem('Sucesso', 'Arquivo TXT gerado com sucesso!');
    } catch (erro) {
        mostrarMensagem('Aviso', erro.message);
    }
}
```

- [ ] **Step 1: Substituir a função por duas funções + as três funções de modal**

Substituir o bloco inteiro (linhas 2870-2887) por:

```js
function gerarTXTResultados() {
    const listaDesconto = _calcularDiasDescontoVAVT(state.resultados);
    if (listaDesconto.length > 0) {
        _abrirModalAvisoDescontos(listaDesconto);
        return;
    }
    _efetivarDownloadTXTResultados();
}

function _abrirModalAvisoDescontos(lista) {
    const tbody = document.getElementById('avisoDescontosTbody');
    tbody.innerHTML = lista.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nome}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.dias}</td>
        </tr>
    `).join('');
    document.getElementById('avisoDescontosModal').classList.add('active');
}

function _fecharModalAvisoDescontos() {
    document.getElementById('avisoDescontosModal').classList.remove('active');
}

function _continuarDownloadAposAviso() {
    document.getElementById('avisoDescontosModal').classList.remove('active');
    _efetivarDownloadTXTResultados();
}

function _efetivarDownloadTXTResultados() {
    try {
        const { conteudoTXT } = _construirConteudoTXTResultados(true);
        if (!conteudoTXT.trim()) { mostrarMensagem('Aviso', 'Nenhum valor positivo encontrado para as rubricas configuradas.'); return; }
        const [mm, aaaa] = state.competencia.split('/');
        const blob = new Blob([conteudoTXT], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `Lancamentos_${state.empresaSelecionada.codigo_empresa}_${mm}-${aaaa}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        fecharModalTxtResultados();
        mostrarMensagem('Sucesso', 'Arquivo TXT gerado com sucesso!');
    } catch (erro) {
        mostrarMensagem('Aviso', erro.message);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: exibe aviso de descontos VA/VT antes de baixar TXT quando ha faltas ou atestados"
```

---

## Task 4: Verificação manual no navegador

**Files:** nenhum (só verificação, sem código novo)

- [ ] **Step 1: Abrir o app e localizar a tela de Resultados**

Usar a skill `run` (ou abrir `Projeto RH/index.html` direto no navegador) para carregar o app, selecionar uma empresa/competência com dados processados que tenham pelo menos um dia marcado como "Falta" ou "Atestado Médico" no período (usar dados de teste existentes ou marcar manualmente um dia como Falta na tabela de entrada).

- [ ] **Step 2: Cenário COM falta/atestado**

Ir em Resultados → "📄 Gerar TXT" → preencher ao menos uma rubrica → clicar "📄 Baixar TXT".

Esperado: modal "⚠️ Descontos de VA/VT" abre com a tabela listando o(s) empregado(s) com dias > 0 e o texto "Devem ser feitos os descontos de VA e VT para os empregados abaixo:". Nenhum download ocorre ainda.

- [ ] **Step 3: Cancelar não baixa nada**

Clicar "Cancelar" no modal de aviso.

Esperado: modal fecha, nenhum arquivo é baixado, o modal `txtRubricasModal` permanece aberto (usuário pode ajustar rubricas e tentar de novo).

- [ ] **Step 4: Continuar baixa o TXT**

Repetir o fluxo do Step 2, agora clicando "Continuar e Baixar TXT".

Esperado: modal de aviso fecha, arquivo `.txt` é baixado, modal `txtRubricasModal` fecha, aparece mensagem "Arquivo TXT gerado com sucesso!".

- [ ] **Step 5: Cenário SEM falta/atestado (regressão)**

Selecionar dados processados em que nenhum dia tenha Falta ou Atestado Médico (ex.: todos os dias normais/folga). Ir em Resultados → "📄 Gerar TXT" → preencher rubrica → "📄 Baixar TXT".

Esperado: nenhum modal de aviso aparece; o TXT baixa direto como no comportamento atual, com a mensagem de sucesso.

- [ ] **Step 6: Confirmar que o fluxo de Exportação da tela inicial não mudou**

Ir na tela inicial → "Exportar dados para lançamento na Folha (TXT)" → gerar um TXT normalmente.

Esperado: nenhum modal de aviso aparece nesse fluxo (fora de escopo desta feature), comportamento idêntico ao anterior.
