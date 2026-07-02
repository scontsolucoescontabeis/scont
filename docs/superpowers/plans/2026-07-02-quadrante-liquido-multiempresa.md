# Relatório Líquido — Seletor de Empresa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Step 6 (Relatório Líquido) do wizard `quadrante.html` deixa de estar preso à empresa Quadrante (código `453` hardcoded) e passa a gerar o relatório para qualquer empresa cadastrada em `rh_empresas`, com o cabeçalho do PDF montado a partir dos dados reais da empresa selecionada.

**Architecture:** Duas edições em arquivos existentes (`quadrante.html`, `quadrante.js`). Sem novo arquivo, sem migração de schema — `rh_empresas` já tem as colunas necessárias (`cnpj`, `inscricao_estadual`, `endereco`, `cep`, `cidade`) e `fechamento_dados_bancarios` já é multi-empresa.

**Tech Stack:** Vanilla JS/HTML, Supabase JS v2, jsPDF + AutoTable (já carregados). Sem build step, sem framework de testes automatizados neste projeto.

## Global Constraints

- Nenhuma mudança de schema Supabase — `rh_empresas.cnpj/inscricao_estadual/endereco/cep/cidade` já existem; `fechamento_dados_bancarios` já é multi-empresa via chave `(codigo_empresa, codigo_empregado)`.
- Só as 4 funções do Relatório Líquido que hoje usam `CODIGO_EMPRESA` diretamente são tocadas (`carregarDadosBancariosDB`, `sincronizarDadosBancarios`, `salvarTipoConta`, `salvarDadosBancariosManual`) — nenhuma outra função do arquivo (fluxo de folha/TXT, alheio ao Relatório Líquido) é modificada.
- Verificação: `node --check "Projeto Fechamento Folha/quadrante.js"` deve passar após cada task — não há suite de testes automatizados neste projeto, esse é o único checador disponível.
- Trocar a empresa selecionada no Step 6 deve limpar qualquer importação em memória (evita misturar dados líquidos de uma empresa/competência com dados bancários de outra).

---

## File Map

```
Projeto Fechamento Folha/
├── quadrante.html   ← MODIFICAR: novo <select> de empresa no Step 6
└── quadrante.js     ← MODIFICAR: estado/loader/handler de empresa, 4 swaps de CODIGO_EMPRESA,
                        cabeçalho do PDF dinâmico
```

---

## Task 1: Seletor de empresa e escopo por empresa nas chamadas Supabase

**Files:**
- Modify: `Projeto Fechamento Folha/quadrante.html`
- Modify: `Projeto Fechamento Folha/quadrante.js`

**Interfaces:**
- Consumes: `CODIGO_EMPRESA` (constante já existente, `'453'`), `supabaseClient` (já existente), `mostrarMensagem`, `mostrarStep`, `mostrarPainelLiquido` (já existentes).
- Produces: estado `empresaLiquido` (objeto `{codigo_empresa, nome_empresa, cnpj, inscricao_estadual, endereco, cep, cidade}` ou `null`), `_empresasLiquido` (array, cache); funções `carregarEmpresasLiquido()`, `onEmpresaLiquidoAlterada()` — a Task 2 consome `empresaLiquido` para montar o cabeçalho do PDF.

- [ ] **Passo 1 — `quadrante.html`: adicionar o seletor de empresa no topo do painel de upload.**

O trecho atual é:

```html
            <!-- Painel: Upload -->
            <div id="painelUploadLiquido">
                <div class="alert alert-info">
                    Faça o upload da planilha com a aba "Líquido" (obrigatória). A aba "Informações bancárias" é opcional — se não vier na planilha, o relatório usa os dados bancários já salvos de importações anteriores. Quando presente, os dados bancários são atualizados e reaproveitados nas competências seguintes.
                </div>

                <label style="font-weight:600; font-size:13px; display:block; margin-bottom:8px;">
                    Planilha de Líquido, com Informações Bancárias opcional (Excel) *
                </label>
```

Substituir por:

```html
            <!-- Painel: Upload -->
            <div id="painelUploadLiquido">
                <div class="form-group" style="max-width:320px;">
                    <label for="selectEmpresaLiquido">Empresa *</label>
                    <select id="selectEmpresaLiquido" onchange="onEmpresaLiquidoAlterada()">
                        <option value="">Selecione a empresa...</option>
                    </select>
                </div>

                <div class="alert alert-info">
                    Faça o upload da planilha com a aba "Líquido" (obrigatória). A aba "Informações bancárias" é opcional — se não vier na planilha, o relatório usa os dados bancários já salvos de importações anteriores. Quando presente, os dados bancários são atualizados e reaproveitados nas competências seguintes.
                </div>

                <label style="font-weight:600; font-size:13px; display:block; margin-bottom:8px;">
                    Planilha de Líquido, com Informações Bancárias opcional (Excel) *
                </label>
```

- [ ] **Passo 2 — `quadrante.js`: adicionar o novo estado.**

O trecho atual (linhas 24-29) é:

```javascript
let dadosBancariosDB   = {};                // codigo_empregado → registro de fechamento_dados_bancarios
let linhasLiquido      = [];                // [{codigo_empregado, cpf, nome, valorInt}] da aba Líquido do mês
let gruposLiquido      = [];                // [{bancoCodigo, bancoNome, linhas:[...], totalInt}]
let pendenciasLiquido  = [];                // linhas de linhasLiquido sem dados bancários
let excluidosDoRelatorio = new Set();       // codigo_empregado excluídos manualmente do relatório do mês

// ──────────────────────────────────────────────
// UTILITÁRIOS
// ──────────────────────────────────────────────
```

Substituir por:

```javascript
let dadosBancariosDB   = {};                // codigo_empregado → registro de fechamento_dados_bancarios
let linhasLiquido      = [];                // [{codigo_empregado, cpf, nome, valorInt}] da aba Líquido do mês
let gruposLiquido      = [];                // [{bancoCodigo, bancoNome, linhas:[...], totalInt}]
let pendenciasLiquido  = [];                // linhas de linhasLiquido sem dados bancários
let excluidosDoRelatorio = new Set();       // codigo_empregado excluídos manualmente do relatório do mês
let empresaLiquido     = null;              // registro completo de rh_empresas da empresa selecionada no Step 6
let _empresasLiquido   = [];                // cache da lista completa (codigo_empresa, nome_empresa, cnpj, inscricao_estadual, endereco, cep, cidade)

// ──────────────────────────────────────────────
// UTILITÁRIOS
// ──────────────────────────────────────────────
```

- [ ] **Passo 3 — `quadrante.js`: adicionar `carregarEmpresasLiquido()` e `onEmpresaLiquidoAlterada()`.**

Localize a função `irStep6()` (busque por `function irStep6()` no arquivo). O trecho atual é:

```javascript
function irStep6() {
    const comp = document.getElementById('competencia').value.trim();
    if (!/^\d{2}\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Preencha a Competência no Step 1 (formato MM/AAAA) antes de acessar o Relatório Líquido.');
        return;
    }
    document.getElementById('labelCompetencia6').textContent = 'Competência: ' + comp;
    mostrarPainelLiquido('upload');
    mostrarStep(6);
}
```

Substituir por (adiciona 2 funções novas antes de `irStep6`, e torna `irStep6` assíncrona):

```javascript
async function carregarEmpresasLiquido() {
    if (_empresasLiquido.length) return;
    const { data, error } = await supabaseClient
        .from('rh_empresas')
        .select('codigo_empresa, nome_empresa, cnpj, inscricao_estadual, endereco, cep, cidade')
        .order('nome_empresa');
    if (error) { console.error('Erro ao carregar empresas (Relatório Líquido):', error); return; }
    _empresasLiquido = data || [];

    const sel = document.getElementById('selectEmpresaLiquido');
    sel.innerHTML = '<option value="">Selecione a empresa...</option>' +
        _empresasLiquido.map(e => `<option value="${e.codigo_empresa}">${e.codigo_empresa} — ${e.nome_empresa || ''}</option>`).join('');

    const padrao = _empresasLiquido.find(e => e.codigo_empresa === CODIGO_EMPRESA);
    if (padrao) {
        sel.value = padrao.codigo_empresa;
        empresaLiquido = padrao;
    }
}

function onEmpresaLiquidoAlterada() {
    const codigo = document.getElementById('selectEmpresaLiquido').value;
    empresaLiquido = _empresasLiquido.find(e => e.codigo_empresa === codigo) || null;

    // Troca de empresa invalida qualquer importação em memória
    arquivoLiquido    = null;
    dadosBancariosDB  = {};
    linhasLiquido     = [];
    gruposLiquido     = [];
    pendenciasLiquido = [];
    excluidosDoRelatorio.clear();
    document.getElementById('filenameLiquido').style.display = 'none';
    document.getElementById('inputLiquido').value = '';
    mostrarPainelLiquido('upload');
}

async function irStep6() {
    const comp = document.getElementById('competencia').value.trim();
    if (!/^\d{2}\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Preencha a Competência no Step 1 (formato MM/AAAA) antes de acessar o Relatório Líquido.');
        return;
    }
    document.getElementById('labelCompetencia6').textContent = 'Competência: ' + comp;
    await carregarEmpresasLiquido();
    mostrarPainelLiquido('upload');
    mostrarStep(6);
}
```

(Os dois `onclick="irStep6()"` já existentes em `quadrante.html` continuam funcionando sem alteração — `onclick` não precisa que o chamador dê `await`.)

- [ ] **Passo 4 — `quadrante.js`: `processarLiquido()` valida empresa selecionada.**

Localize a função `processarLiquido()`. O trecho atual do início da função é:

```javascript
async function processarLiquido() {
    const comp = document.getElementById('competencia').value.trim();
    if (!/^\d{2}\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Preencha a Competência no Step 1 (formato MM/AAAA) antes de gerar o Relatório Líquido.');
        return;
    }
    if (!arquivoLiquido) {
        mostrarMensagem('Atenção', 'Selecione a planilha de Informações Bancárias / Líquido.');
        return;
    }
```

Substituir por:

```javascript
async function processarLiquido() {
    const comp = document.getElementById('competencia').value.trim();
    if (!/^\d{2}\/\d{4}$/.test(comp)) {
        mostrarMensagem('Atenção', 'Preencha a Competência no Step 1 (formato MM/AAAA) antes de gerar o Relatório Líquido.');
        return;
    }
    if (!empresaLiquido) {
        mostrarMensagem('Atenção', 'Selecione a empresa antes de processar a planilha.');
        return;
    }
    if (!arquivoLiquido) {
        mostrarMensagem('Atenção', 'Selecione a planilha de Informações Bancárias / Líquido.');
        return;
    }
```

- [ ] **Passo 5 — `quadrante.js`: `carregarDadosBancariosDB()` usa a empresa selecionada.**

Código atual:

```javascript
async function carregarDadosBancariosDB() {
    const { data, error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .select('*')
        .eq('codigo_empresa', CODIGO_EMPRESA);
    if (error) throw error;
    dadosBancariosDB = {};
    (data || []).forEach(r => { dadosBancariosDB[r.codigo_empregado] = r; });
}
```

Novo:

```javascript
async function carregarDadosBancariosDB() {
    const { data, error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .select('*')
        .eq('codigo_empresa', empresaLiquido.codigo_empresa);
    if (error) throw error;
    dadosBancariosDB = {};
    (data || []).forEach(r => { dadosBancariosDB[r.codigo_empregado] = r; });
}
```

- [ ] **Passo 6 — `quadrante.js`: `sincronizarDadosBancarios()` usa a empresa selecionada.**

Localize, dentro de `sincronizarDadosBancarios(linhasPlanilha)`, o trecho:

```javascript
    const upsertRows = linhasPlanilha.map(l => {
        const existente = dadosBancariosDB[l.codigo_empregado];
        return {
            codigo_empresa:   CODIGO_EMPRESA,
            codigo_empregado: l.codigo_empregado,
```

Substituir por:

```javascript
    const upsertRows = linhasPlanilha.map(l => {
        const existente = dadosBancariosDB[l.codigo_empregado];
        return {
            codigo_empresa:   empresaLiquido.codigo_empresa,
            codigo_empregado: l.codigo_empregado,
```

- [ ] **Passo 7 — `quadrante.js`: `salvarTipoConta()` usa a empresa selecionada.**

Código atual:

```javascript
async function salvarTipoConta(selectEl) {
    const codigo = selectEl.dataset.codigo;
    const tipo   = selectEl.value;

    const { error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .update({ tipo_conta: tipo, atualizado_em: new Date().toISOString() })
        .eq('codigo_empresa', CODIGO_EMPRESA)
        .eq('codigo_empregado', codigo);
```

Novo:

```javascript
async function salvarTipoConta(selectEl) {
    const codigo = selectEl.dataset.codigo;
    const tipo   = selectEl.value;

    const { error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .update({ tipo_conta: tipo, atualizado_em: new Date().toISOString() })
        .eq('codigo_empresa', empresaLiquido.codigo_empresa)
        .eq('codigo_empregado', codigo);
```

- [ ] **Passo 8 — `quadrante.js`: `salvarDadosBancariosManual()` usa a empresa selecionada.**

Localize, dentro de `salvarDadosBancariosManual(codigo)`, o trecho:

```javascript
    const linha = linhasLiquido.find(l => l.codigo_empregado === codigo);
    const registro = {
        codigo_empresa:   CODIGO_EMPRESA,
        codigo_empregado: codigo,
```

Substituir por:

```javascript
    const linha = linhasLiquido.find(l => l.codigo_empregado === codigo);
    const registro = {
        codigo_empresa:   empresaLiquido.codigo_empresa,
        codigo_empregado: codigo,
```

- [ ] **Passo 9 — Verificar sintaxe.**

Run: `node --check "Projeto Fechamento Folha/quadrante.js"`
Expected: nenhuma saída, exit code 0.

- [ ] **Passo 10 — Verificar que nenhuma outra função foi tocada por engano.**

Run: `grep -n "CODIGO_EMPRESA" "Projeto Fechamento Folha/quadrante.js"`

Expected: a constante `const CODIGO_EMPRESA = '453';` continua existindo (linha 6, não removida — ainda é usada pelo restante do wizard de folha/TXT e como padrão de seleção em `carregarEmpresasLiquido`), e as únicas ocorrências de `CODIGO_EMPRESA` dentro do bloco do Relatório Líquido devem ser exatamente essas duas: a comparação em `carregarEmpresasLiquido` (`e.codigo_empresa === CODIGO_EMPRESA`) e nenhuma outra — as 4 funções do Passo 5-8 não devem mais conter `CODIGO_EMPRESA` isoladamente, só `empresaLiquido.codigo_empresa`.

- [ ] **Passo 11 — Commit.**

```bash
git add "Projeto Fechamento Folha/quadrante.html" "Projeto Fechamento Folha/quadrante.js"
git commit -m "feat: seletor de empresa no Relatório Líquido — Quadrante"
```

---

## Task 2: Cabeçalho do PDF dinâmico por empresa

**Files:**
- Modify: `Projeto Fechamento Folha/quadrante.js`

**Interfaces:**
- Consumes: `empresaLiquido` (produzido pela Task 1 — objeto `{codigo_empresa, nome_empresa, cnpj, inscricao_estadual, endereco, cep, cidade}`), `periodoCompetencia(comp)` (já existente), `formatarCpf` (já existente, não relacionado a este cabeçalho mas presente no mesmo arquivo).
- Produces: `formatarEnderecoEmpresa(empresa)` — função pura, não consumida por nenhuma task futura (este é o último task do plano).

- [ ] **Passo 1 — Localizar e substituir o bloco das 4 constantes fixas + `gerarPDFLiquido()`.**

Busque por `const QUADRANTE_RAZAO_SOCIAL` no arquivo. O trecho atual (da declaração das constantes até o fim de `gerarPDFLiquido()`) é:

```javascript
const QUADRANTE_RAZAO_SOCIAL = 'QUADRANTE ETIQUETAS INDÚSTRIA E COMÉRCIO';
const QUADRANTE_CNPJ         = '24.862.830/0001-96';
const QUADRANTE_INSCRICAO    = '140866668111';
const QUADRANTE_ENDERECO     = 'Rua Soldado Antônio Aparecido, Nº 296 - GALPAO, Parque Novo, São Paulo - SP';

// "04/2026" → "01/04/2026 a 30/04/2026"
function periodoCompetencia(comp) {
    const [mm, aaaa] = comp.split('/');
    const ultimoDia  = new Date(parseInt(aaaa, 10), parseInt(mm, 10), 0).getDate();
    return `01/${mm}/${aaaa} a ${String(ultimoDia).padStart(2, '0')}/${mm}/${aaaa}`;
}

function gerarPDFLiquido() {
    if (pendenciasLiquido.length > 0) {
        mostrarMensagem('Atenção', 'Complete ou exclua os empregados sem dados bancários antes de gerar o PDF.');
        return;
    }
    if (!gruposLiquido.length) {
        mostrarMensagem('Atenção', 'Nenhum lançamento para gerar o relatório.');
        return;
    }

    const comp   = document.getElementById('competencia').value.trim();
    const { jsPDF } = window.jspdf;
    const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const MARGEM = 10;
    const pageW  = doc.internal.pageSize.getWidth();

    // Cabeçalho — identidade SCONT
    doc.setFillColor(139, 58, 58); // --primary-color
    doc.roundedRect(MARGEM, MARGEM, pageW - MARGEM * 2, 24, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(QUADRANTE_RAZAO_SOCIAL, MARGEM + 4, MARGEM + 6);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${QUADRANTE_CNPJ}   Inscrição: ${QUADRANTE_INSCRICAO}`, MARGEM + 4, MARGEM + 11);
    doc.text(QUADRANTE_ENDERECO, MARGEM + 4, MARGEM + 16);
    doc.text(`Período de: ${periodoCompetencia(comp)}`, MARGEM + 4, MARGEM + 21);

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Relação de Lançamentos Bancários', pageW - MARGEM - 4, MARGEM + 8, { align: 'right' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), pageW - MARGEM - 4, MARGEM + 13, { align: 'right' });

    // Corpo — uma "seção" por banco (linha de destaque + linhas de empregados + linha de total)
    const body = [];
    gruposLiquido.forEach(g => {
        body.push([{ content: 'Banco: ' + g.bancoNome, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [44, 62, 80], textColor: 255 } }]);
        g.linhas.forEach(l => {
            body.push([
                l.codigo_empregado,
                l.nome,
                formatarCpf(l.cpf),
                `${l.agencia} / ${l.conta} / ${l.tipoConta}`,
                'R$ ' + (l.valorInt / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            ]);
        });
        body.push([
            { content: 'Total:', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: 'R$ ' + (g.totalInt / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), styles: { fontStyle: 'bold' } },
        ]);
    });

    doc.autoTable({
        head: [['Código', 'Funcionário', 'CPF', 'Agência / Conta / Tipo Conta', 'Valor Líquido']],
        body,
        startY: MARGEM + 28,
        margin: { left: MARGEM, right: MARGEM },
        styles: { fontSize: 7.5, cellPadding: 1.8, valign: 'middle' },
        headStyles: { fillColor: [139, 58, 58], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    doc.save(`Relacao_Bancaria_Quadrante_${comp.replace('/', '-')}.pdf`);
}
```

Substituir o bloco inteiro acima (das 4 constantes até o fechamento de `gerarPDFLiquido()`) por:

```javascript
// "04/2026" → "01/04/2026 a 30/04/2026"
function periodoCompetencia(comp) {
    const [mm, aaaa] = comp.split('/');
    const ultimoDia  = new Date(parseInt(aaaa, 10), parseInt(mm, 10), 0).getDate();
    return `01/${mm}/${aaaa} a ${String(ultimoDia).padStart(2, '0')}/${mm}/${aaaa}`;
}

function formatarEnderecoEmpresa(empresa) {
    if (!empresa.endereco) return '';
    let end = empresa.endereco;
    if (empresa.cidade) end += ', ' + empresa.cidade;
    if (empresa.cep) end += ' - CEP ' + empresa.cep;
    return end;
}

function gerarPDFLiquido() {
    if (pendenciasLiquido.length > 0) {
        mostrarMensagem('Atenção', 'Complete ou exclua os empregados sem dados bancários antes de gerar o PDF.');
        return;
    }
    if (!gruposLiquido.length) {
        mostrarMensagem('Atenção', 'Nenhum lançamento para gerar o relatório.');
        return;
    }

    const comp   = document.getElementById('competencia').value.trim();
    const { jsPDF } = window.jspdf;
    const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const MARGEM = 10;
    const pageW  = doc.internal.pageSize.getWidth();

    // Cabeçalho — identidade SCONT, montado dinamicamente a partir da empresa selecionada
    const linhasCabecalho = [];
    linhasCabecalho.push({ texto: empresaLiquido.nome_empresa || empresaLiquido.codigo_empresa, tamanho: 11, negrito: true });

    const cnpjInsc = [];
    if (empresaLiquido.cnpj) cnpjInsc.push('CNPJ: ' + empresaLiquido.cnpj);
    if (empresaLiquido.inscricao_estadual) cnpjInsc.push('Inscrição: ' + empresaLiquido.inscricao_estadual);
    if (cnpjInsc.length) linhasCabecalho.push({ texto: cnpjInsc.join('   '), tamanho: 7, negrito: false });

    const endereco = formatarEnderecoEmpresa(empresaLiquido);
    if (endereco) linhasCabecalho.push({ texto: endereco, tamanho: 7, negrito: false });

    linhasCabecalho.push({ texto: `Período de: ${periodoCompetencia(comp)}`, tamanho: 7, negrito: false });

    const alturaBarra = 6 + linhasCabecalho.length * 5;

    doc.setFillColor(139, 58, 58); // --primary-color
    doc.roundedRect(MARGEM, MARGEM, pageW - MARGEM * 2, alturaBarra, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    linhasCabecalho.forEach((linha, i) => {
        doc.setFontSize(linha.tamanho);
        doc.setFont('helvetica', linha.negrito ? 'bold' : 'normal');
        doc.text(linha.texto, MARGEM + 4, MARGEM + 6 + i * 5);
    });

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Relação de Lançamentos Bancários', pageW - MARGEM - 4, MARGEM + 8, { align: 'right' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), pageW - MARGEM - 4, MARGEM + 13, { align: 'right' });

    // Corpo — uma "seção" por banco (linha de destaque + linhas de empregados + linha de total)
    const body = [];
    gruposLiquido.forEach(g => {
        body.push([{ content: 'Banco: ' + g.bancoNome, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [44, 62, 80], textColor: 255 } }]);
        g.linhas.forEach(l => {
            body.push([
                l.codigo_empregado,
                l.nome,
                formatarCpf(l.cpf),
                `${l.agencia} / ${l.conta} / ${l.tipoConta}`,
                'R$ ' + (l.valorInt / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            ]);
        });
        body.push([
            { content: 'Total:', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: 'R$ ' + (g.totalInt / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), styles: { fontStyle: 'bold' } },
        ]);
    });

    doc.autoTable({
        head: [['Código', 'Funcionário', 'CPF', 'Agência / Conta / Tipo Conta', 'Valor Líquido']],
        body,
        startY: MARGEM + alturaBarra + 4,
        margin: { left: MARGEM, right: MARGEM },
        styles: { fontSize: 7.5, cellPadding: 1.8, valign: 'middle' },
        headStyles: { fillColor: [139, 58, 58], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    const nomeArquivoSeguro = (empresaLiquido.nome_empresa || empresaLiquido.codigo_empresa)
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    doc.save(`Relacao_Bancaria_${nomeArquivoSeguro}_${comp.replace('/', '-')}.pdf`);
}
```

**Nota sobre o regex de remoção de acentos:** use exatamente `/[̀-ͯ]/g` (a forma com escape Unicode) — não a variante com o caractere literal usada em outras partes do arquivo, para evitar problemas de encoding ao copiar/colar este bloco específico. O comportamento é idêntico: remove os diacríticos (combining marks) deixados por `.normalize('NFD')`.

- [ ] **Passo 2 — Verificar sintaxe.**

Run: `node --check "Projeto Fechamento Folha/quadrante.js"`
Expected: nenhuma saída, exit code 0.

- [ ] **Passo 3 — Verificar que as constantes antigas sumiram e nada mais as referencia.**

Run: `grep -n "QUADRANTE_RAZAO_SOCIAL\|QUADRANTE_CNPJ\|QUADRANTE_INSCRICAO\|QUADRANTE_ENDERECO" "Projeto Fechamento Folha/quadrante.js" "Projeto Fechamento Folha/quadrante.html"`

Expected: nenhuma saída (nenhum match) — se aparecer algo, sobrou uma referência órfã às constantes removidas.

- [ ] **Passo 4 — Verificação manual (sem automação de navegador disponível neste ambiente):** anotar no relatório da task que um humano precisa, logado, entrar no Step 6, selecionar ao menos duas empresas diferentes (uma com CNPJ/Inscrição/Endereço preenchidos em `rh_empresas`, outra sem) e gerar o PDF de cada uma, confirmando visualmente que: (a) a razão social/CNPJ/endereço mudam conforme a empresa; (b) quando a empresa não tem CNPJ/Inscrição nem Endereço, essas linhas somem do cabeçalho sem deixar espaço em branco estranho; (c) o nome do arquivo baixado reflete o nome da empresa.

- [ ] **Passo 5 — Commit.**

```bash
git add "Projeto Fechamento Folha/quadrante.js"
git commit -m "feat: cabeçalho do PDF do Relatório Líquido montado por empresa"
```

---

## Self-Review

- **Cobertura da spec:** seção 2 (comportamento do seletor + reset ao trocar empresa) → Task 1 Passos 1-3; seção 3 (novo estado, `carregarEmpresasLiquido`, `onEmpresaLiquidoAlterada`, `irStep6` assíncrona, validação em `processarLiquido`, as 4 substituições de `CODIGO_EMPRESA`) → Task 1 Passos 2-8; seção 3 (cabeçalho dinâmico, `formatarEnderecoEmpresa`, nome de arquivo seguro) → Task 2 Passo 1; seção 4 (HTML do seletor) → Task 1 Passo 1; seção 5 (casos de borda: CNPJ/Inscrição/Endereço vazios, troca de empresa limpa estado, validação de empresa ausente, cache-guard) → cobertos respectivamente em Task 2 Passo 1 (`linhasCabecalho`/`cnpjInsc`/condicionais), Task 1 Passo 3 (`onEmpresaLiquidoAlterada`), Task 1 Passo 4, Task 1 Passo 3 (`if (_empresasLiquido.length) return;`). Todos os itens do spec têm passo correspondente.
- **Placeholders:** nenhum `TBD`/`TODO` — todo código é completo e executável, incluindo o bloco antes/depois de `gerarPDFLiquido()` na íntegra (não só o diff).
- **Consistência de tipos/nomes:** `empresaLiquido` é o mesmo objeto (`{codigo_empresa, nome_empresa, cnpj, inscricao_estadual, endereco, cep, cidade}`) produzido em `carregarEmpresasLiquido`/`onEmpresaLiquidoAlterada` (Task 1) e consumido em `gerarPDFLiquido`/`formatarEnderecoEmpresa` (Task 2) — mesmos nomes de campo em ambas as tasks, confirmados contra as colunas reais de `rh_empresas` (`codigo_empresa, nome_empresa, cnpj, inscricao_estadual, endereco, cep, cidade`).
