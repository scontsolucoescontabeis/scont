# Grade de Empregados × Rubricas com Valores Individualizados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No Passo 3 de Lançamentos em Lote, substituir "uma rubrica + um valor único aplicado a todos" por uma grade (matriz empregado × rubrica) onde o usuário adiciona várias rubricas, escolhe quem recebe cada uma e individualiza o valor por empregado.

**Architecture:** Estado novo em memória (`rubricasGrid`, `valoresGrid`) representa as colunas (rubricas) e os valores por célula (empregado × rubrica) da grade do Passo 3. Ao gerar, cada coluna vira uma "parametrização" independente (mesma estrutura de `parametrizacoesAcumuladas` de hoje, mas com `itens: [{empregado, valor, nomeEmpregado}]` no lugar de um valor único). O restante do fluxo (Passo 3.5, Passo 4, exportação TXT) é reaproveitado quase sem mudança.

**Tech Stack:** HTML/CSS/JS vanilla (sem framework, sem bundler), funções globais chamadas via `onclick`/`onchange` inline — mesmo padrão já usado no arquivo.

## Global Constraints

- Layout binário do TXT exportado (posições fixas, paddings, ordem dos campos) não muda — mesma lógica de `gerarConteudoTXT` de hoje, só passa a iterar por item em vez de valor único.
- Sem persistência entre sessões — grade e parametrizações continuam vivendo em memória (nenhuma tabela nova no Supabase).
- Passo 1 (competência/empresas) e Passo 2 (seleção de empregados) não são alterados.
- Seguir a convenção existente do arquivo: funções globais no escopo do módulo, chamadas via atributos `onclick`/`onchange`/`oninput` inline no HTML.
- Célula vazia na grade = empregado não recebe aquela rubrica (não existe checkbox de inclusão separado).

---

## Mapeamento de Arquivos

| Arquivo | Mudança |
|---|---|
| `lancamentos.html` | Passo 3 (grade) reescrito; novos estilos CSS no `<style>` inline |
| `lancamentos.js` | Novo estado da grade, novas funções de montagem/renderização/geração, ajustes em funções existentes que referenciavam os campos únicos removidos |

---

### Task 1: HTML — novo layout do Passo 3 (grade)

**Files:**
- Modify: `lancamentos.html:132-170`

- [ ] **Step 1: Substituir o bloco do Passo 3**

Localizar o trecho exato:
```html
        <!-- PASSO 3: PARÂMETROS DO EVENTO -->
        <div class="step-card" id="step3" style="display: none; opacity: 0.5; pointer-events: none;">
            <div class="step-title"><div class="step-number">3</div> Parâmetros do Lançamento</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                <div class="form-group">
                    <label for="lanTipoProcesso">Tipo do Processo *</label>
                    <select id="lanTipoProcesso" required>
                        <option value="">Selecione...</option>
                        <option value="11">11 - Mensal</option>
                        <option value="41">41 - Adiantamento</option>
                        <option value="42">42 - Complementar</option>
                        <option value="51">51 - Adiantamento 13º</option>
                        <option value="52">52 - 13º Salário</option>
                        <option value="70">70 - Participação de Lucros</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="lanRubrica">Código da Rubrica *</label>
                    <input type="text" id="lanRubrica" placeholder="Ex: 1285" maxlength="9" oninput="this.value = this.value.replace(/\D/g, '')">
                    <small>Máximo 9 dígitos numéricos</small>
                </div>
                <div class="form-group">
                    <label for="lanTipoValor">Tipo do Valor *</label>
                    <select id="lanTipoValor" onchange="atualizarPlaceholderValor()">
                        <option value="horas">Horas (HH:MM)</option>
                        <option value="monetario">Monetário (R$ 0,00)</option>
                        <option value="dias">Dias (inteiro)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="lanValor">Valor do Evento *</label>
                    <input type="text" id="lanValor" placeholder="Ex: 01:30" maxlength="9">
                    <small id="lanValorDica">Formato HH:MM (ex: 01:30)</small>
                </div>
            </div>
            <button type="button" class="btn btn-primary" onclick="gerarPrevia()" style="margin-top: 20px; width: 100%;">
                ✅ Adicionar Parametrização
            </button>
        </div>
```

Substituir por:
```html
        <!-- PASSO 3: PARÂMETROS DO EVENTO (GRADE EMPREGADO x RUBRICA) -->
        <div class="step-card" id="step3" style="display: none; opacity: 0.5; pointer-events: none;">
            <div class="step-title"><div class="step-number">3</div> Parâmetros do Lançamento</div>

            <div class="form-group" style="max-width: 260px;">
                <label for="lanTipoProcesso">Tipo do Processo *</label>
                <select id="lanTipoProcesso" required>
                    <option value="">Selecione...</option>
                    <option value="11">11 - Mensal</option>
                    <option value="41">41 - Adiantamento</option>
                    <option value="42">42 - Complementar</option>
                    <option value="51">51 - Adiantamento 13º</option>
                    <option value="52">52 - 13º Salário</option>
                    <option value="70">70 - Participação de Lucros</option>
                </select>
                <small>Aplica-se a todas as rubricas desta grade</small>
            </div>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin-top: 15px;">
                <label style="font-weight: 600; font-size: 13px; display: block; margin-bottom: 10px;">Adicionar Rubrica à Grade</label>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="gradeRubricaCodigo">Código da Rubrica *</label>
                        <input type="text" id="gradeRubricaCodigo" placeholder="Ex: 1285" maxlength="9" oninput="this.value = this.value.replace(/\D/g, '')">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="gradeRubricaTipoValor">Tipo do Valor *</label>
                        <select id="gradeRubricaTipoValor" onchange="atualizarPlaceholderValorPadrao()">
                            <option value="horas">Horas (HH:MM)</option>
                            <option value="monetario">Monetário (R$ 0,00)</option>
                            <option value="dias">Dias (inteiro)</option>
                        </select>
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

            <div style="margin-top: 20px;">
                <label style="font-weight: 600; font-size: 13px; display: block; margin-bottom: 5px;">Grade de Valores por Empregado</label>
                <input type="text" id="buscaEmpregadoGrade" class="search-input" placeholder="🔍 Buscar por código ou nome do empregado..." onkeyup="filtrarGrade()">
                <div id="gradeContainer" class="grade-table-container">
                    <div class="grade-empty-msg">Adicione ao menos uma rubrica acima para montar a grade.</div>
                </div>
            </div>

            <button type="button" class="btn btn-primary" onclick="gerarParametrizacoes()" style="margin-top: 20px; width: 100%;">
                ✅ Gerar Parametrizações
            </button>
        </div>
```

- [ ] **Step 2: Abrir `lancamentos.html` no navegador e verificar visualmente**

O Passo 3 ainda não fica funcional nesta etapa (funções JS referenciadas ainda não existem) — apenas confirme que a página carrega sem erro de HTML malformado e que o Passo 1/2 continuam funcionando normalmente (nenhum erro no Console relacionado a parsing de HTML).

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/lancamentos.html"
git commit -m "feat: novo layout do Passo 3 — grade empregado x rubrica em Lançamentos"
```

---

### Task 2: CSS — estilos da grade, chips e detalhes

**Files:**
- Modify: `lancamentos.html:71-72` (dentro do `<style>` inline do `<head>`)

- [ ] **Step 1: Inserir estilos novos**

Localizar o trecho exato:
```html
        .header-actions { display: flex; gap: 10px; }
    </style>
```

Substituir por:
```html
        .header-actions { display: flex; gap: 10px; }

        /* ✅ NOVO: Grade Empregado x Rubrica (Passo 3) */
        .chip-rubrica { display: inline-flex; align-items: center; gap: 8px; background: white; border: 1px solid var(--border-color); border-radius: 20px; padding: 6px 12px; margin: 4px 6px 4px 0; font-size: 12px; }
        .chip-rubrica .chip-remove { cursor: pointer; color: #d32f2f; font-weight: bold; }
        .chip-rubrica .chip-remove:hover { text-decoration: underline; }
        .grade-table-container { overflow: auto; border: 1px solid var(--border-color); border-radius: 6px; margin-top: 10px; max-height: 400px; }
        .grade-table { border-collapse: collapse; width: 100%; font-size: 12px; }
        .grade-table th, .grade-table td { border: 1px solid var(--border-color); padding: 6px 8px; text-align: left; white-space: nowrap; }
        .grade-table th { background: var(--background-color); position: sticky; top: 0; z-index: 1; }
        .grade-table th.grade-emp-col, .grade-table td.grade-emp-col { position: sticky; left: 0; background: white; z-index: 2; min-width: 220px; }
        .grade-input { width: 90px; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 12px; }
        .grade-empty-msg { padding: 20px; text-align: center; color: #999; }
        .detalhes-toggle { cursor: pointer; color: var(--info-color); font-size: 12px; font-weight: 600; margin-top: 8px; }
        .detalhes-toggle:hover { text-decoration: underline; }
        .detalhes-table { width: 100%; margin-top: 8px; font-size: 12px; border-collapse: collapse; }
        .detalhes-table td, .detalhes-table th { padding: 4px 8px; border-bottom: 1px solid #eee; text-align: left; }
    </style>
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/lancamentos.html"
git commit -m "feat: estilos da grade empregado x rubrica em Lançamentos"
```

---

### Task 3: JS — estado da grade e reinício ao entrar no Passo 3

**Files:**
- Modify: `lancamentos.js:10-14` (estado global)
- Modify: `lancamentos.js:220-233` (`avancarParaParametros`)

**Interfaces:**
- Produces: `rubricasGrid` (`[{id, codigo, tipoValor}]`), `valoresGrid` (`{[rubricaId]: {[empKey]: valorString}}`), `empregadosInfoAtual` (`{[empKey]: nomeExibicao}`) — usados por todas as tasks seguintes.

- [ ] **Step 1: Adicionar estado da grade**

Localizar o trecho exato:
```js
// ✅ NOVO: Array que acumula todas as parametrizações da sessão
let parametrizacoesAcumuladas = [];

// ✅ NOVO: Referência aos empregados selecionados (mantém entre ciclos)
let empregadosSelecionadosAtual = [];
```

Substituir por:
```js
// ✅ NOVO: Array que acumula todas as parametrizações da sessão
let parametrizacoesAcumuladas = [];

// ✅ NOVO: Referência aos empregados selecionados (mantém entre ciclos)
let empregadosSelecionadosAtual = [];

// ✅ NOVO: Nome de exibição de cada empregado selecionado, para uso na grade e nos detalhes
let empregadosInfoAtual = {};

// ✅ NOVO: Grade Empregado x Rubrica (Passo 3)
let rubricasGrid = [];   // [{ id, codigo, tipoValor }]
let valoresGrid = {};    // valoresGrid[rubricaId][empregadoKey] = "valor digitado"
```

- [ ] **Step 2: Capturar nomes e reiniciar a grade ao avançar para o Passo 3**

Localizar o trecho exato:
```js
function avancarParaParametros() {
    const checkboxesEmpregados = document.querySelectorAll('#listaEmpregados input[type="checkbox"]:checked');

    if (checkboxesEmpregados.length === 0) {
        mostrarMensagem('Atenção', 'Selecione pelo menos um empregado para continuar.');
        return;
    }

    // ✅ NOVO: Armazenar empregados selecionados para uso posterior
    empregadosSelecionadosAtual = Array.from(checkboxesEmpregados).map(cb => cb.value);

    // ✅ CORRIGIDO: Usar ativarStep em vez de apenas adicionar classe
    ativarStep('step3');
}
```

Substituir por:
```js
function avancarParaParametros() {
    const checkboxesEmpregados = document.querySelectorAll('#listaEmpregados input[type="checkbox"]:checked');

    if (checkboxesEmpregados.length === 0) {
        mostrarMensagem('Atenção', 'Selecione pelo menos um empregado para continuar.');
        return;
    }

    // ✅ NOVO: Armazenar empregados selecionados para uso posterior
    empregadosSelecionadosAtual = Array.from(checkboxesEmpregados).map(cb => cb.value);

    // ✅ NOVO: Guardar o nome de exibição de cada empregado (usado na grade e nos detalhes)
    empregadosInfoAtual = {};
    checkboxesEmpregados.forEach(cb => {
        const label = document.querySelector(`label[for="${cb.id}"]`);
        empregadosInfoAtual[cb.value] = label ? label.textContent.trim().replace(/\s+/g, ' ') : cb.value;
    });

    // ✅ NOVO: Reinicia a grade empregado x rubrica para esta leva
    rubricasGrid = [];
    valoresGrid = {};
    renderGrade();

    // ✅ CORRIGIDO: Usar ativarStep em vez de apenas adicionar classe
    ativarStep('step3');
}
```

*(`renderGrade` ainda não existe — será criada na Task 6. Como é uma função global (`function renderGrade() {}`), o hoisting do JavaScript garante que a chamada funcione assim que o arquivo inteiro for carregado; não é necessário reordenar.)*

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/lancamentos.js"
git commit -m "feat: estado da grade empregado x rubrica e nomes de exibicao"
```

---

### Task 4: JS — helpers de tipo de valor e validação de formato

**Files:**
- Modify: `lancamentos.js:254-268` (substitui `atualizarPlaceholderValor`)

**Interfaces:**
- Produces: `infoTipoValor(tipo)` → `{placeholder, dica}`; `atualizarPlaceholderValorPadrao()`; `validarFormatoValor(valor, tipoValor)` → `boolean`. Usadas pelas Tasks 6 e 7.

- [ ] **Step 1: Substituir `atualizarPlaceholderValor` por helpers reutilizáveis**

Localizar o trecho exato:
```js
function atualizarPlaceholderValor() {
    const tipo = document.getElementById('lanTipoValor').value;
    const input = document.getElementById('lanValor');
    const dica = document.getElementById('lanValorDica');
    if (tipo === 'horas') {
        input.placeholder = 'Ex: 01:30';
        dica.textContent = 'Formato HH:MM (ex: 01:30 = 1 hora e 30 minutos)';
    } else if (tipo === 'monetario') {
        input.placeholder = 'Ex: 150,50';
        dica.textContent = 'Valor em reais com centavos (ex: 150,50)';
    } else {
        input.placeholder = 'Ex: 3';
        dica.textContent = 'Número inteiro de dias';
    }
}
```

Substituir por:
```js
function infoTipoValor(tipo) {
    if (tipo === 'horas') {
        return { placeholder: 'Ex: 01:30', dica: 'Formato HH:MM (ex: 01:30 = 1 hora e 30 minutos)' };
    }
    if (tipo === 'monetario') {
        return { placeholder: 'Ex: 150,50', dica: 'Valor em reais com centavos (ex: 150,50)' };
    }
    return { placeholder: 'Ex: 3', dica: 'Número inteiro de dias' };
}

function atualizarPlaceholderValorPadrao() {
    const tipo = document.getElementById('gradeRubricaTipoValor').value;
    const input = document.getElementById('gradeRubricaValorPadrao');
    const dica = document.getElementById('gradeRubricaValorPadraoDica');
    const info = infoTipoValor(tipo);
    input.placeholder = info.placeholder;
    dica.textContent = info.dica;
}

function validarFormatoValor(valor, tipoValor) {
    const v = String(valor).trim();
    if (!v) return false;
    if (tipoValor === 'horas') {
        return /^\d{1,2}:\d{2}$/.test(v);
    }
    // monetário e dias: precisa ter ao menos um dígito
    return /\d/.test(v);
}
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/lancamentos.js"
git commit -m "feat: helpers de tipo de valor e validacao de formato por celula"
```

---

### Task 5: JS — `gerarConteudoTXT` com itens individualizados

**Files:**
- Modify: `lancamentos.js:270-288`

**Interfaces:**
- Consumes: `encodeValorParaTipo(valor, tipoValor)` (já existe, inalterada).
- Produces: `gerarConteudoTXT(comp, tipoProcesso, rubrica, tipoValor, itens)` → `string`, onde `itens` é `[{empregado: "codEmpresa|codEmpregado", valor: "..."}]`. Usada pela Task 7.

- [ ] **Step 1: Trocar assinatura para receber lista de itens em vez de um valor único**

Localizar o trecho exato:
```js
function gerarConteudoTXT(comp, tipoProcesso, rubrica, valor, tipoValor, empregados) {
    const fixo = "10";
    const compParts = comp.split('/');
    const compFormatada = compParts[1] + compParts[0]; // AAAA + MM
    const tipoProcFormatado = String(tipoProcesso).padStart(2, '0');
    const rubFormatada = String(rubrica).padStart(9, '0');
    const valorInt = encodeValorParaTipo(valor, tipoValor);
    const valFormatado = String(valorInt).padStart(9, '0');

    let conteudo = '';
    empregados.forEach(empData => {
        const [codEmpresa, codEmpregado] = empData.split('|');
        const codEmpregadoFormatado = String(codEmpregado).padStart(10, '0');
        const codEmpresaFormatada = String(codEmpresa).padStart(10, '0');
        conteudo += `${fixo}${codEmpregadoFormatado}${compFormatada}${rubFormatada}${tipoProcFormatado}${valFormatado}${codEmpresaFormatada}\n`;
    });

    return conteudo;
}
```

Substituir por:
```js
function gerarConteudoTXT(comp, tipoProcesso, rubrica, tipoValor, itens) {
    const fixo = "10";
    const compParts = comp.split('/');
    const compFormatada = compParts[1] + compParts[0]; // AAAA + MM
    const tipoProcFormatado = String(tipoProcesso).padStart(2, '0');
    const rubFormatada = String(rubrica).padStart(9, '0');

    let conteudo = '';
    itens.forEach(item => {
        const [codEmpresa, codEmpregado] = item.empregado.split('|');
        const codEmpregadoFormatado = String(codEmpregado).padStart(10, '0');
        const codEmpresaFormatada = String(codEmpresa).padStart(10, '0');
        const valorInt = encodeValorParaTipo(item.valor, tipoValor);
        const valFormatado = String(valorInt).padStart(9, '0');
        conteudo += `${fixo}${codEmpregadoFormatado}${compFormatada}${rubFormatada}${tipoProcFormatado}${valFormatado}${codEmpresaFormatada}\n`;
    });

    return conteudo;
}
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/lancamentos.js"
git commit -m "feat: gerarConteudoTXT passa a receber valores individualizados por item"
```

---

### Task 6: JS — montagem e renderização da grade

**Files:**
- Modify: `lancamentos.js:290-343` (substitui `gerarPrevia`)

**Interfaces:**
- Consumes: `infoTipoValor` (Task 4), `rubricasGrid`/`valoresGrid`/`empregadosSelecionadosAtual`/`empregadosInfoAtual` (Task 3), `mostrarMensagem` (já existe).
- Produces: `adicionarRubricaGrade()`, `removerRubricaGrade(id)`, `renderGrade()`, `atualizarValorCelula(rubricaId, empKey, valor)`, `filtrarGrade()`. `renderGrade` é consumida pela Task 3 (já referenciada) e pela Task 7.

- [ ] **Step 1: Substituir `gerarPrevia` pelas funções da grade**

Localizar o trecho exato:
```js
function gerarPrevia() {
    const comp = document.getElementById('lanCompetencia').value;
    const tipoProcesso = document.getElementById('lanTipoProcesso').value;
    const rubrica = document.getElementById('lanRubrica').value.trim();
    const valor = document.getElementById('lanValor').value.trim();
    const tipoValor = document.getElementById('lanTipoValor').value;

    // Validações
    if (!tipoProcesso) {
        mostrarMensagem('Atenção', 'Selecione o Tipo do Processo.');
        return;
    }

    if (!rubrica || !/^\d+$/.test(rubrica)) {
        mostrarMensagem('Atenção', 'Informe um Código de Rubrica válido (apenas números).');
        return;
    }

    if (!valor) {
        mostrarMensagem('Atenção', 'Informe um Valor.');
        return;
    }

    if (empregadosSelecionadosAtual.length === 0) {
        mostrarMensagem('Atenção', 'Nenhum empregado selecionado. Volte ao passo 2.');
        return;
    }

    // ✅ NOVO: Gerar TXT para esta parametrização
    const conteudoTXT = gerarConteudoTXT(comp, tipoProcesso, rubrica, valor, tipoValor, empregadosSelecionadosAtual);

    // ✅ NOVO: Armazenar parametrização
    const parametrizacao = {
        id: Date.now(),
        competencia: comp,
        tipoProcesso: tipoProcesso,
        rubrica: rubrica,
        valor: valor,
        tipoValor: tipoValor,
        empregados: empregadosSelecionadosAtual,
        conteudoTXT: conteudoTXT,
        dataHora: new Date().toLocaleString('pt-BR')
    };

    parametrizacoesAcumuladas.push(parametrizacao);

    // ✅ NOVO: Mostrar prévia e opções
    document.getElementById('previaTxt').textContent = conteudoTXT;
    ativarStep('step3-5');
    atualizarListaParametrizacoes();

    // Feedback visual
    mostrarMensagem('Sucesso', `Parametrização adicionada! Total: ${parametrizacoesAcumuladas.length}`);
}
```

Substituir por:
```js
function adicionarRubricaGrade() {
    const codigo = document.getElementById('gradeRubricaCodigo').value.trim();
    const tipoValor = document.getElementById('gradeRubricaTipoValor').value;
    const valorPadrao = document.getElementById('gradeRubricaValorPadrao').value.trim();

    if (!codigo || !/^\d+$/.test(codigo)) {
        mostrarMensagem('Atenção', 'Informe um Código de Rubrica válido (apenas números).');
        return;
    }

    if (empregadosSelecionadosAtual.length === 0) {
        mostrarMensagem('Atenção', 'Nenhum empregado selecionado. Volte ao passo 2.');
        return;
    }

    const id = Date.now();
    rubricasGrid.push({ id, codigo, tipoValor });
    valoresGrid[id] = {};

    if (valorPadrao) {
        empregadosSelecionadosAtual.forEach(empKey => {
            valoresGrid[id][empKey] = valorPadrao;
        });
    }

    document.getElementById('gradeRubricaCodigo').value = '';
    document.getElementById('gradeRubricaValorPadrao').value = '';

    renderGrade();
}

function removerRubricaGrade(id) {
    const rubrica = rubricasGrid.find(r => r.id === id);
    if (!rubrica) return;

    const temValores = valoresGrid[id] && Object.values(valoresGrid[id]).some(v => v && v.trim());
    if (temValores && !confirm(`A rubrica ${rubrica.codigo} já tem valores preenchidos. Remover mesmo assim?`)) {
        return;
    }

    rubricasGrid = rubricasGrid.filter(r => r.id !== id);
    delete valoresGrid[id];
    renderGrade();
}

function atualizarValorCelula(rubricaId, empKey, valor) {
    if (!valoresGrid[rubricaId]) valoresGrid[rubricaId] = {};
    valoresGrid[rubricaId][empKey] = valor;
}

function renderGrade() {
    const chipsContainer = document.getElementById('chipsRubricas');
    const gradeContainer = document.getElementById('gradeContainer');
    if (!chipsContainer || !gradeContainer) return;

    // Chips das rubricas adicionadas
    chipsContainer.innerHTML = rubricasGrid.map(r => `
        <span class="chip-rubrica">
            Rubrica ${r.codigo} (${r.tipoValor})
            <span class="chip-remove" onclick="removerRubricaGrade(${r.id})">×</span>
        </span>
    `).join('');

    if (rubricasGrid.length === 0 || empregadosSelecionadosAtual.length === 0) {
        gradeContainer.innerHTML = '<div class="grade-empty-msg">Adicione ao menos uma rubrica acima para montar a grade.</div>';
        return;
    }

    let html = '<table class="grade-table"><thead><tr><th class="grade-emp-col">Empregado</th>';
    rubricasGrid.forEach(r => {
        html += `<th>Rubrica ${r.codigo}<br><small>${infoTipoValor(r.tipoValor).placeholder}</small></th>`;
    });
    html += '</tr></thead><tbody>';

    empregadosSelecionadosAtual.forEach(empKey => {
        const nome = empregadosInfoAtual[empKey] || empKey;
        const buscaAttr = nome.toLowerCase().replace(/"/g, '');
        html += `<tr data-emp-busca="${buscaAttr}"><td class="grade-emp-col">${nome}</td>`;
        rubricasGrid.forEach(r => {
            const valorAtual = (valoresGrid[r.id] && valoresGrid[r.id][empKey]) || '';
            html += `<td><input type="text" class="grade-input" placeholder="${infoTipoValor(r.tipoValor).placeholder}" value="${valorAtual}" onchange="atualizarValorCelula(${r.id}, '${empKey}', this.value)"></td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    gradeContainer.innerHTML = html;
}

function filtrarGrade() {
    const termo = document.getElementById('buscaEmpregadoGrade').value.toLowerCase();
    document.querySelectorAll('#gradeContainer tbody tr').forEach(row => {
        const alvo = row.getAttribute('data-emp-busca') || '';
        row.style.display = alvo.includes(termo) ? '' : 'none';
    });
}
```

- [ ] **Step 2: Abrir `lancamentos.html` no navegador e verificar no Console**

Fazer login, avançar até o Passo 3 (competência + empresa + empregados). Confirmar que:
- A grade aparece com a mensagem "Adicione ao menos uma rubrica..." antes de qualquer rubrica ser adicionada.
- Ao preencher Código da Rubrica + clicar "➕ Adicionar Rubrica à Grade", aparece um chip e a tabela com uma linha por empregado do Passo 2 e uma coluna para a rubrica.
- Digitar um valor numa célula e sair do campo (blur) não gera erro no Console.
- Nenhum erro JavaScript aparece no Console do navegador.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/lancamentos.js"
git commit -m "feat: montagem e renderizacao da grade empregado x rubrica"
```

---

### Task 7: JS — `gerarParametrizacoes` (substitui o botão único de parametrização)

**Files:**
- Modify: `lancamentos.js` — inserir logo após a função `filtrarGrade` adicionada na Task 6 (mesma região onde estava `gerarPrevia`)

**Interfaces:**
- Consumes: `rubricasGrid`, `valoresGrid`, `empregadosSelecionadosAtual`, `empregadosInfoAtual` (Task 3); `validarFormatoValor` (Task 4); `gerarConteudoTXT` (Task 5); `renderGrade` (Task 6); `atualizarListaParametrizacoes` (Task 8 — só é chamada, ainda existe da versão antiga até a Task 8 rodar).
- Produces: `gerarParametrizacoes()`, chamada pelo botão do Passo 3 (Task 1). Cada parametrização empilhada em `parametrizacoesAcumuladas` agora tem o formato `{id, competencia, tipoProcesso, rubrica, tipoValor, itens: [{empregado, valor, nomeEmpregado}], conteudoTXT, dataHora}`.

- [ ] **Step 1: Localizar o final de `filtrarGrade` (fim da Task 6) e inserir `gerarParametrizacoes` logo depois**

Localizar o trecho exato (fim de `filtrarGrade`, já existente após a Task 6):
```js
function filtrarGrade() {
    const termo = document.getElementById('buscaEmpregadoGrade').value.toLowerCase();
    document.querySelectorAll('#gradeContainer tbody tr').forEach(row => {
        const alvo = row.getAttribute('data-emp-busca') || '';
        row.style.display = alvo.includes(termo) ? '' : 'none';
    });
}
```

Inserir **logo após** esse bloco:
```js

function gerarParametrizacoes() {
    const comp = document.getElementById('lanCompetencia').value;
    const tipoProcesso = document.getElementById('lanTipoProcesso').value;

    if (!tipoProcesso) {
        mostrarMensagem('Atenção', 'Selecione o Tipo do Processo.');
        return;
    }

    if (rubricasGrid.length === 0) {
        mostrarMensagem('Atenção', 'Adicione ao menos uma rubrica à grade.');
        return;
    }

    if (empregadosSelecionadosAtual.length === 0) {
        mostrarMensagem('Atenção', 'Nenhum empregado selecionado. Volte ao passo 2.');
        return;
    }

    const novasParametrizacoes = [];
    const rubricasIgnoradas = [];

    for (const r of rubricasGrid) {
        const valoresColuna = valoresGrid[r.id] || {};
        const itens = [];

        for (const empKey of Object.keys(valoresColuna)) {
            const valor = valoresColuna[empKey];
            if (!valor || !valor.trim()) continue;

            if (!validarFormatoValor(valor, r.tipoValor)) {
                const nomeEmp = empregadosInfoAtual[empKey] || empKey;
                mostrarMensagem('Atenção', `Valor inválido para "${nomeEmp}" na rubrica ${r.codigo}: "${valor}". Corrija antes de gerar.`);
                return;
            }

            itens.push({
                empregado: empKey,
                valor: valor.trim(),
                nomeEmpregado: empregadosInfoAtual[empKey] || empKey
            });
        }

        if (itens.length === 0) {
            rubricasIgnoradas.push(r.codigo);
            continue;
        }

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
    }

    if (novasParametrizacoes.length === 0) {
        mostrarMensagem('Atenção', 'Nenhuma rubrica da grade tem valores preenchidos.');
        return;
    }

    parametrizacoesAcumuladas.push(...novasParametrizacoes);

    // ✅ Reinicia a grade para a próxima leva de rubricas
    rubricasGrid = [];
    valoresGrid = {};
    renderGrade();

    document.getElementById('previaTxt').textContent = novasParametrizacoes[novasParametrizacoes.length - 1].conteudoTXT;
    ativarStep('step3-5');
    atualizarListaParametrizacoes();

    let msg = `${novasParametrizacoes.length} parametrização(ões) adicionada(s)! Total: ${parametrizacoesAcumuladas.length}`;
    if (rubricasIgnoradas.length > 0) {
        msg += `\nRubricas ignoradas (sem valores): ${rubricasIgnoradas.join(', ')}`;
    }
    mostrarMensagem('Sucesso', msg);
}
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/lancamentos.js"
git commit -m "feat: gerarParametrizacoes monta uma parametrizacao por rubrica da grade"
```

---

### Task 8: JS — revisão no Passo 3.5 com valores individualizados

**Files:**
- Modify: `lancamentos.js:345-376` (`atualizarListaParametrizacoes`)

**Interfaces:**
- Consumes: `parametrizacoesAcumuladas` (agora com `itens` em vez de `valor`/`empregados`).
- Produces: `alternarDetalhesParametrizacao(id)`, chamada pelo HTML gerado dentro de `atualizarListaParametrizacoes`.

- [ ] **Step 1: Substituir `atualizarListaParametrizacoes` e adicionar o toggle de detalhes**

Localizar o trecho exato:
```js
function atualizarListaParametrizacoes() {
    const container = document.getElementById('listaParametrizacoes');
    const totalSpan = document.getElementById('totalParametrizacoes');

    totalSpan.textContent = parametrizacoesAcumuladas.length;

    if (parametrizacoesAcumuladas.length === 0) {
        container.innerHTML = '<div class="parametrizacao-empty">Nenhuma parametrização adicionada ainda.</div>';
        return;
    }

    container.innerHTML = parametrizacoesAcumuladas.map((param, index) => `
        <div class="parametrizacao-item">
            <div class="parametrizacao-header">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <div class="parametrizacao-counter">${index + 1}</div>
                    <div>
                        <span class="parametrizacao-badge rubrica">Rubrica: ${param.rubrica}</span>
                        <span class="parametrizacao-badge valor">R$ ${param.valor}</span>
                        <span class="parametrizacao-badge empregados">${param.empregados.length} empr.</span>
                    </div>
                </div>
                <button type="button" class="btn-remove" onclick="removerParametrizacao(${param.id})">
                    🗑️ Remover
                </button>
            </div>
            <div class="parametrizacao-info">
                ${param.dataHora} | Competência: <strong>${param.competencia}</strong> | Tipo: <strong>${param.tipoProcesso}</strong>
            </div>
        </div>
    `).join('');
}
```

Substituir por:
```js
function atualizarListaParametrizacoes() {
    const container = document.getElementById('listaParametrizacoes');
    const totalSpan = document.getElementById('totalParametrizacoes');

    totalSpan.textContent = parametrizacoesAcumuladas.length;

    if (parametrizacoesAcumuladas.length === 0) {
        container.innerHTML = '<div class="parametrizacao-empty">Nenhuma parametrização adicionada ainda.</div>';
        return;
    }

    container.innerHTML = parametrizacoesAcumuladas.map((param, index) => `
        <div class="parametrizacao-item">
            <div class="parametrizacao-header">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <div class="parametrizacao-counter">${index + 1}</div>
                    <div>
                        <span class="parametrizacao-badge rubrica">Rubrica: ${param.rubrica}</span>
                        <span class="parametrizacao-badge empregados">${param.itens.length} empr. com valor individual</span>
                    </div>
                </div>
                <button type="button" class="btn-remove" onclick="removerParametrizacao(${param.id})">
                    🗑️ Remover
                </button>
            </div>
            <div class="parametrizacao-info">
                ${param.dataHora} | Competência: <strong>${param.competencia}</strong> | Tipo: <strong>${param.tipoProcesso}</strong>
            </div>
            <div class="detalhes-toggle" onclick="alternarDetalhesParametrizacao(${param.id})">Ver detalhes ▾</div>
            <div id="detalhes_${param.id}" style="display: none;"></div>
        </div>
    `).join('');
}

function alternarDetalhesParametrizacao(id) {
    const container = document.getElementById(`detalhes_${id}`);
    if (!container) return;

    if (container.style.display === 'none') {
        const param = parametrizacoesAcumuladas.find(p => p.id === id);
        if (!param) return;

        container.innerHTML = `
            <table class="detalhes-table">
                <thead><tr><th>Empregado</th><th>Valor</th></tr></thead>
                <tbody>
                    ${param.itens.map(item => `
                        <tr>
                            <td>${item.nomeEmpregado}</td>
                            <td>${item.valor}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/lancamentos.js"
git commit -m "feat: revisao do Passo 3.5 mostra valores individualizados por empregado"
```

---

### Task 9: JS — corrigir referências a campos removidos (`novaParametrizacao`, `baixarTXT`)

**Files:**
- Modify: `lancamentos.js:378-388` (`novaParametrizacao`)
- Modify: `lancamentos.js:418-451` (`baixarTXT`)

- [ ] **Step 1: Corrigir `novaParametrizacao`**

Localizar o trecho exato:
```js
function novaParametrizacao() {
    // Limpar formulário
    document.getElementById('lanTipoProcesso').value = '';
    document.getElementById('lanRubrica').value = '';
    document.getElementById('lanValor').value = '';
    document.getElementById('lanTipoValor').value = 'horas';
    atualizarPlaceholderValor();

    // Voltar ao Step 3 para nova parametrização
    ativarStep('step1');
}
```

Substituir por:
```js
function novaParametrizacao() {
    // Limpar formulário
    document.getElementById('lanTipoProcesso').value = '';
    document.getElementById('gradeRubricaCodigo').value = '';
    document.getElementById('gradeRubricaValorPadrao').value = '';
    document.getElementById('gradeRubricaTipoValor').value = 'horas';
    atualizarPlaceholderValorPadrao();

    // Voltar ao Step 1 para nova leva (nova seleção de empresas/empregados)
    ativarStep('step1');
}
```

- [ ] **Step 2: Corrigir o reset de formulário em `baixarTXT`**

Localizar o trecho exato:
```js
    // ✅ NOVO: Limpar após exportação e reiniciar
    parametrizacoesAcumuladas = [];
    empregadosSelecionadosAtual = [];
    mostrarMensagem('Sucesso', 'Arquivo TXT baixado com sucesso! Sessão reiniciada.');
    
    // Limpar formulários
    document.getElementById('lanCompetencia').value = '';
    document.getElementById('lanTipoProcesso').value = '';
    document.getElementById('lanRubrica').value = '';
    document.getElementById('lanValor').value = '';
    document.getElementById('lanTipoValor').value = 'horas';
    document.getElementById('buscaEmpresa').value = '';
    document.getElementById('buscaEmpregado').value = '';
    atualizarPlaceholderValor();
    
    ativarStep('step1');
```

Substituir por:
```js
    // ✅ NOVO: Limpar após exportação e reiniciar
    parametrizacoesAcumuladas = [];
    empregadosSelecionadosAtual = [];
    empregadosInfoAtual = {};
    rubricasGrid = [];
    valoresGrid = {};
    mostrarMensagem('Sucesso', 'Arquivo TXT baixado com sucesso! Sessão reiniciada.');
    
    // Limpar formulários
    document.getElementById('lanCompetencia').value = '';
    document.getElementById('lanTipoProcesso').value = '';
    document.getElementById('gradeRubricaCodigo').value = '';
    document.getElementById('gradeRubricaValorPadrao').value = '';
    document.getElementById('gradeRubricaTipoValor').value = 'horas';
    document.getElementById('buscaEmpresa').value = '';
    document.getElementById('buscaEmpregado').value = '';
    atualizarPlaceholderValorPadrao();
    renderGrade();
    
    ativarStep('step1');
```

- [ ] **Step 3: Verificar no Console**

Abrir `lancamentos.html` no navegador, DevTools > Console. Não deve haver nenhum erro `Cannot read properties of null` relacionado a `lanRubrica`, `lanValor` ou `lanTipoValor` (todos os usos foram removidos).

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/lancamentos.js"
git commit -m "fix: remove referencias a campos antigos do Passo 3 em novaParametrizacao e baixarTXT"
```

---

### Task 10: Teste manual end-to-end completo

- [ ] **Step 1: Fluxo básico com uma rubrica, valores individualizados**

1. Abrir `lancamentos.html`, informar competência (ex: `07/2026`), selecionar uma empresa com empregados cadastrados, clicar "🔍 Buscar Empregados".
2. No Passo 2, selecionar 3+ empregados, clicar "➡️ Continuar para Parâmetros".
3. No Passo 3, selecionar Tipo do Processo (ex: "11 - Mensal").
4. Adicionar rubrica (ex: código `1285`, Tipo do Valor "Horas", Valor Padrão `01:00`) → clicar "➕ Adicionar Rubrica à Grade".
5. Confirmar que a grade aparece com uma linha por empregado, coluna da rubrica já preenchida com `01:00` em todas as células.
6. Editar manualmente o valor de 1 empregado para `02:30` e apagar o valor de outro empregado (deixando a célula vazia).
7. Clicar "✅ Gerar Parametrizações".
8. Confirmar mensagem de sucesso e que o Passo 3.5 mostra 1 parametrização com "N-1 empr. com valor individual" (N = total de empregados menos o que foi deixado vazio).
9. Clicar "Ver detalhes ▾" e confirmar que a tabela mostra nome + valor de cada empregado, incluindo o valor customizado `02:30`, e que o empregado com célula vazia **não aparece** na lista.

- [ ] **Step 2: Múltiplas rubricas na mesma grade**

1. A partir do Passo 3.5, clicar "➕ Adicionar Nova Parametrização" (volta ao Passo 1 — reconfirmar competência/empresa/empregados).
2. No Passo 3, adicionar 2 rubricas diferentes (ex: uma "Horas" e uma "Monetário"), cada uma com valor padrão distinto.
3. Preencher/editar algumas células em cada coluna.
4. Clicar "✅ Gerar Parametrizações" e confirmar que **2** parametrizações novas foram criadas (uma por rubrica), refletidas no contador total do Passo 3.5.

- [ ] **Step 3: Rubrica sem nenhum valor preenchido**

1. No Passo 3, adicionar uma rubrica sem valor padrão e sem editar nenhuma célula (todas vazias).
2. Adicionar uma segunda rubrica com ao menos um valor preenchido.
3. Clicar "✅ Gerar Parametrizações" e confirmar que a mensagem de sucesso menciona a rubrica ignorada, e que apenas a rubrica com valor gerou parametrização.

- [ ] **Step 4: Validação de formato inválido**

1. No Passo 3, adicionar uma rubrica com Tipo do Valor "Horas".
2. Editar uma célula com um valor fora do formato `HH:MM` (ex: `abc` ou `130`).
3. Clicar "✅ Gerar Parametrizações" e confirmar que aparece aviso apontando o empregado e a rubrica, e que **nenhuma** parametrização é criada até corrigir.

- [ ] **Step 5: Busca na grade**

1. Com uma grade grande (5+ empregados), digitar parte de um nome no campo de busca acima da grade.
2. Confirmar que apenas as linhas correspondentes ficam visíveis, e que os valores já digitados nas linhas escondidas não são perdidos (reexibir limpando a busca e conferir).

- [ ] **Step 6: Remoção de coluna de rubrica**

1. Com uma rubrica que já tem valores preenchidos, clicar no × do chip dela.
2. Confirmar que aparece um `confirm()` de aviso; cancelar e confirmar que a coluna permanece.
3. Repetir e confirmar — a coluna deve desaparecer da grade.

- [ ] **Step 7: Exportação final**

1. Com 2+ parametrizações acumuladas (de rubricas/levas diferentes), avançar para "✅ Finalizar e Exportar".
2. Conferir a prévia do TXT no Passo 4: uma linha por item de cada parametrização, com os valores individualizados corretos (conferir manualmente o valor codificado de 1-2 linhas, ex: horas `02:30` → `00000230` na posição de valor).
3. Clicar "📥 Baixar Arquivo TXT", confirmar o download e que a sessão é reiniciada (Passo 1 limpo, grade vazia).

- [ ] **Step 8: Commit final (se houver ajustes)**

```bash
git add "Projeto RH/lancamentos.html" "Projeto RH/lancamentos.js"
git commit -m "fix: ajustes pos-teste manual da grade empregado x rubrica"
```

*(Só necessário se o Passo 1-7 revelar algo a corrigir; se tudo passou sem mudanças, pular este commit.)*
