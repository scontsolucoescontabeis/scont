# Quadrante — Redireciona Programação de Férias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a implementação duplicada e inferior de "Programação de Férias" (Step 4/5) do wizard `quadrante.html`/`quadrante.js`, e apontar os dois botões existentes diretamente para a ferramenta standalone `ferias.html`, que já é genérica e mais completa.

**Architecture:** Duas edições em arquivos existentes (`quadrante.html`, `quadrante.js`), sem novos arquivos. `ferias.html` não é alterado — já funciona standalone e já tem link de volta para `quadrante.html` no seu próprio sidebar.

**Tech Stack:** Vanilla JS/HTML, sem build step, sem framework de testes automatizados neste projeto.

## Global Constraints

- Todo o código removido deve ser confirmado como não-referenciado por nenhuma outra parte do arquivo antes da remoção (verificação por `grep`, já feita na fase de design — ver seção 4 do spec).
- O Step 6 (Relatório Líquido, já implementado e em produção) não deve ser renumerado nem ter nenhuma linha tocada por este plano.
- `ferias.html` não é modificado.
- Verificação: `node --check "Projeto Fechamento Folha/quadrante.js"` deve passar (não há suite de testes automatizados neste projeto — esse é o único checador disponível).

---

## Task 1: Remover Step 4/5 do wizard e redirecionar para `ferias.html`

**Files:**
- Modify: `Projeto Fechamento Folha/quadrante.html`
- Modify: `Projeto Fechamento Folha/quadrante.js`

**Interfaces:**
- Consumes: nenhuma interface nova — apenas remove código existente e ajusta 2 `onclick` attributes.
- Produces: nada consumido por outro código — este é o único task do plano.

- [ ] **Passo 1 — `quadrante.html`: trocar os 2 botões de férias para navegação direta.**

No Step 2 (dentro do `.btn-group` que também tem "← Voltar" e "▶ Gerar TXT"), o bloco atual é:

```html
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="voltarStep(1)">← Voltar</button>
                <button class="btn btn-primary" onclick="irStep3()">▶ Gerar TXT</button>
                <button class="btn btn-info" onclick="irStep4()">📅 Programação de Férias</button>
            </div>
        </div>

        <!-- STEP 3: TXT -->
```

Substituir por:

```html
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="voltarStep(1)">← Voltar</button>
                <button class="btn btn-primary" onclick="irStep3()">▶ Gerar TXT</button>
                <button class="btn btn-info" onclick="window.location.href='ferias.html'">📅 Programação de Férias</button>
            </div>
        </div>

        <!-- STEP 3: TXT -->
```

No Step 3 (dentro do `.btn-group` que tem "← Voltar", "⬇ Baixar TXT" e "🏷️ Etiquetas Bancárias"), o bloco atual é:

```html
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="voltarStep(2)">← Voltar</button>
                <button class="btn btn-success" onclick="baixarTXT()">⬇ Baixar TXT</button>
                <button class="btn btn-info" onclick="irStep4()">📅 Programação de Férias</button>
                <button class="btn btn-info" onclick="irStep6()">🏷️ Etiquetas Bancárias</button>
            </div>
        </div>

        <!-- STEP 4: UPLOAD FÉRIAS -->
```

Substituir por:

```html
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="voltarStep(2)">← Voltar</button>
                <button class="btn btn-success" onclick="baixarTXT()">⬇ Baixar TXT</button>
                <button class="btn btn-info" onclick="window.location.href='ferias.html'">📅 Programação de Férias</button>
                <button class="btn btn-info" onclick="irStep6()">🏷️ Etiquetas Bancárias</button>
            </div>
        </div>

```

(Repare que a linha `<!-- STEP 4: UPLOAD FÉRIAS -->` some daqui — ela é removida junto com o bloco inteiro no próximo passo, então não a reescreva.)

- [ ] **Passo 2 — `quadrante.html`: remover os blocos Step 4 e Step 5 inteiros.**

O trecho abaixo (do comentário `<!-- STEP 4: UPLOAD FÉRIAS -->` até o `</div>` que fecha o Step 5, imediatamente antes do comentário `<!-- STEP 6: RELATÓRIO LÍQUIDO -->`) deve ser **removido por completo**:

```html
        <!-- STEP 4: UPLOAD FÉRIAS -->
        <div class="step-card" id="step4" style="display:none;">
            <div class="step-title">
                <div class="step-number">4</div>
                Programação de Férias – Upload
            </div>

            <div class="alert alert-info">
                Faça o upload da planilha de programação de férias. A ferramenta ordenará os registros pela data de início do gozo.
            </div>

            <label style="font-weight:600; font-size:13px; display:block; margin-bottom:8px;">
                Planilha de Férias (Excel) *
            </label>
            <div class="upload-area" id="uploadAreaFerias" onclick="document.getElementById('inputFerias').click()">
                <div class="upload-icon">🏖️</div>
                <div class="upload-text">
                    Arraste o arquivo aqui ou <strong>clique para selecionar</strong>
                </div>
                <div class="upload-filename" id="filenameFerias"></div>
                <input type="file" id="inputFerias" accept=".xlsx,.xls">
            </div>

            <div style="margin-top:16px;">
                <label style="font-weight:600; font-size:13px; display:block; margin-bottom:5px;">
                    Coluna de ordenação (data de gozo)
                </label>
                <select id="colunaOrdenacao" style="padding:9px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; min-width:250px;">
                    <option value="">— Detectar automaticamente —</option>
                </select>
                <small style="color:var(--text-secondary); font-size:12px; display:block; margin-top:4px;">
                    Após selecionar o arquivo, as colunas disponíveis serão listadas aqui.
                </small>
            </div>

            <div class="btn-group">
                <button class="btn btn-secondary" onclick="voltarStep(2)">← Voltar ao Relatório</button>
                <button class="btn btn-primary" onclick="processarFerias()">▶ Gerar Relatório de Férias</button>
            </div>
        </div>

        <!-- STEP 5: RELATÓRIO FÉRIAS -->
        <div class="step-card" id="step5" style="display:none;">
            <div class="step-title">
                <div class="step-number">5</div>
                Programação de Férias – Ordenado por Data de Gozo
            </div>

            <div class="ferias-stats" id="feriasStats"></div>

            <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
                <input type="text" id="buscaFerias" placeholder="Filtrar por funcionário..."
                       oninput="filtrarFerias()" style="flex:1; min-width:220px; padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; font-size:13px;">
            </div>

            <div class="table-wrapper">
                <table id="tabelaFerias">
                    <thead id="headFerias"></thead>
                    <tbody id="bodyFerias"></tbody>
                </table>
            </div>

            <div class="btn-group">
                <button class="btn btn-secondary" onclick="voltarStep(4)">← Voltar</button>
                <button class="btn btn-primary" onclick="imprimirFerias()">🖨️ Imprimir / Salvar PDF</button>
            </div>
        </div>

```

Depois da remoção, o arquivo deve ir direto do `</div>` que fecha o Step 3 (que já ficou intacto no Passo 1) para o comentário `<!-- STEP 6: RELATÓRIO LÍQUIDO -->` (não tocado por este plano).

- [ ] **Passo 3 — `quadrante.js`: remover as 3 variáveis de estado de férias.**

Em `quadrante.js`, o bloco de estado global (linhas 12-24 aproximadamente) atualmente é:

```javascript
// Estado global
let planilhaData      = []; // [{nome, funcao, colunas: {colNome: valorBruto}}]
let funcionariosMap   = {}; // nome_normalizado → codigo_empregado
let rubricasConfig    = []; // [{coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao}]
let rhRubricasData    = []; // [{descricao_rubrica, codigo_rubrica}] — fallback de resolução
let linhasTxt         = []; // linhas válidas para o TXT
let tipoFolhaAtual    = '11'; // tipo_folha pré-selecionado no modal de TXT
let feriasData        = []; // dados brutos da planilha de férias
let feriasHeaders     = []; // cabeçalhos da planilha de férias
let feriasSorted      = []; // dados ordenados
let empregadosConfig  = {}; // nome_normalizado → codigo_empregado (config desta ferramenta)
let rubricasIgnoradas = new Set(); // normalizarNome(coluna_planilha) → excluir do TXT
let faltaDatasMap     = {}; // `${codEmpregado}::${normColuna}` → string raw de datas inseridas
```

Substituir por (remove só as 3 linhas de `feriasData`/`feriasHeaders`/`feriasSorted`, mantém o resto igual):

```javascript
// Estado global
let planilhaData      = []; // [{nome, funcao, colunas: {colNome: valorBruto}}]
let funcionariosMap   = {}; // nome_normalizado → codigo_empregado
let rubricasConfig    = []; // [{coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao}]
let rhRubricasData    = []; // [{descricao_rubrica, codigo_rubrica}] — fallback de resolução
let linhasTxt         = []; // linhas válidas para o TXT
let tipoFolhaAtual    = '11'; // tipo_folha pré-selecionado no modal de TXT
let empregadosConfig  = {}; // nome_normalizado → codigo_empregado (config desta ferramenta)
let rubricasIgnoradas = new Set(); // normalizarNome(coluna_planilha) → excluir do TXT
let faltaDatasMap     = {}; // `${codEmpregado}::${normColuna}` → string raw de datas inseridas
```

- [ ] **Passo 4 — `quadrante.js`: ajustar `mostrarStep` para não referenciar os steps 4 e 5.**

Código atual:

```javascript
function mostrarStep(n) {
    [1,2,3,4,5,6].forEach(i => {
        const el = document.getElementById('step' + i);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

Novo:

```javascript
function mostrarStep(n) {
    [1,2,3,6].forEach(i => {
        const el = document.getElementById('step' + i);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

- [ ] **Passo 5 — `quadrante.js`: remover a chamada `configurarUploadArea` do upload de férias, dentro do `DOMContentLoaded`.**

O trecho atual (dentro do handler `DOMContentLoaded` já existente) é:

```javascript
    // Upload área – drag and drop folha
    configurarUploadArea('uploadAreaFolha', 'inputFolha', 'filenameFolha', onFolhaSelecionada);
    // Upload área – férias
    configurarUploadArea('uploadAreaFerias', 'inputFerias', 'filenameFerias', onFeriasSelecionada);

    // Upload área – relatório líquido (etiquetas bancárias)
    configurarUploadArea('uploadAreaLiquido', 'inputLiquido', 'filenameLiquido', onLiquidoSelecionado);
```

Substituir por (remove a linha do comentário "férias" e a chamada correspondente):

```javascript
    // Upload área – drag and drop folha
    configurarUploadArea('uploadAreaFolha', 'inputFolha', 'filenameFolha', onFolhaSelecionada);

    // Upload área – relatório líquido (etiquetas bancárias)
    configurarUploadArea('uploadAreaLiquido', 'inputLiquido', 'filenameLiquido', onLiquidoSelecionado);
```

- [ ] **Passo 6 — `quadrante.js`: remover o bloco inteiro "STEP 4 – UPLOAD FÉRIAS".**

O bloco abaixo (10 funções + 1 variável de estado, do comentário de seção `// STEP 4 – UPLOAD FÉRIAS` até a linha em branco imediatamente antes do próximo comentário de seção `// SIDEBAR + NAVEGAÇÃO`) deve ser **removido por completo**:

```javascript
// ──────────────────────────────────────────────
// STEP 4 – UPLOAD FÉRIAS
// ──────────────────────────────────────────────

let arquivoFerias = null;

function irStep4() { mostrarStep(4); }

function onFeriasSelecionada(file, filenameId) {
    arquivoFerias = file;
    const el = document.getElementById(filenameId);
    el.textContent = '✔ ' + file.name;
    el.style.display = 'block';
    preCarregarColunas(file);
}

function detectarCabecalhoFerias(rows) {
    // Procura a linha que contém "Código" ou "Empregado" (linha de dados do cabeçalho)
    for (let r = 0; r < Math.min(15, rows.length); r++) {
        if (!rows[r]) continue;
        const textos = rows[r].map(c => String(c).trim());
        if (textos.some(t => /^c[oó]digo$/i.test(t) || /^empregado/i.test(t))) {
            // Combinar com a linha anterior (sub-cabeçalho) se existir
            const cabMerge = textos.map((t, i) => {
                if (t) return t;
                const anterior = rows[r - 1] ? String(rows[r - 1][i] || '').trim() : '';
                return anterior;
            });
            return { cabIdx: r, headers: cabMerge };
        }
    }
    // Fallback: primeira linha com 3+ células não-vazias
    for (let r = 0; r < Math.min(15, rows.length); r++) {
        if (!rows[r]) continue;
        if (rows[r].filter(c => String(c).trim() !== '').length >= 3) {
            return { cabIdx: r, headers: rows[r].map(c => String(c).trim()) };
        }
    }
    return null;
}

async function preCarregarColunas(file) {
    try {
        const buffer   = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const resultado = detectarCabecalhoFerias(rows);
        if (!resultado) return;
        feriasHeaders = resultado.headers;

        const sel = document.getElementById('colunaOrdenacao');
        sel.innerHTML = '<option value="">— Detectar automaticamente —</option>';
        feriasHeaders.forEach((h, i) => {
            if (!h) return;
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = h;
            if (/gozo|in[ií]cio.*gozo|gozo.*fer/i.test(h)) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (err) {
        console.error('Pré-carga colunas férias:', err);
    }
}

async function processarFerias() {
    if (!arquivoFerias) {
        mostrarMensagem('Atenção', 'Selecione a planilha de programação de férias.');
        return;
    }

    try {
        const buffer   = await arquivoFerias.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Detectar cabeçalho
        const deteccao = detectarCabecalhoFerias(rows);
        if (!deteccao) {
            mostrarMensagem('Atenção', 'Não foi possível detectar o cabeçalho da planilha de férias. Verifique o arquivo.');
            return;
        }
        const { cabIdx } = deteccao;
        feriasHeaders = deteccao.headers;

        // Dados: linhas após o cabeçalho, ignorar linhas totalmente vazias e placeholders
        feriasData = rows.slice(cabIdx + 1).filter(r =>
            Array.isArray(r) && r.some(c => {
                const s = String(c).trim();
                return s !== '' && !/^\.+$/.test(s); // ignora "...." e "..../..../......"
            })
        );

        // Coluna de ordenação: preferir "Início gozo férias" (col 22, índice base-0)
        let colOrd = parseInt(document.getElementById('colunaOrdenacao').value, 10);
        if (isNaN(colOrd)) {
            colOrd = feriasHeaders.findIndex(h => /gozo/i.test(h));
            if (colOrd < 0) colOrd = feriasHeaders.findIndex(h => /in[ií]cio/i.test(h));
            if (colOrd < 0) colOrd = 0;
        }

        // Ordenar
        feriasSorted = [...feriasData].sort((a, b) => {
            const va = parseDataFerias(a[colOrd]);
            const vb = parseDataFerias(b[colOrd]);
            return va - vb;
        });

        renderizarFerias();
        mostrarStep(5);

    } catch (err) {
        console.error(err);
        mostrarMensagem('Erro', 'Falha ao processar férias: ' + err.message);
    }
}

function parseDataFerias(val) {
    if (!val) return new Date(9999, 0);
    if (val instanceof Date) return isNaN(val.getTime()) ? new Date(9999, 0) : val;
    const s = String(val).trim();
    if (!s || /^[.\/ ]+$/.test(s)) return new Date(9999, 0); // placeholder ..../..../......
    // DD/MM/AAAA
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    // Número serial do Excel
    const n = parseFloat(s);
    if (!isNaN(n) && n > 1000) return new Date(Math.round((n - 25569) * 86400 * 1000));
    return new Date(9999, 0);
}

function formatarDataFerias(val) {
    const d = parseDataFerias(val);
    if (!d || isNaN(d.getTime()) || d.getFullYear() > 9000) return String(val || '–');
    return d.toLocaleDateString('pt-BR');
}

function renderizarFerias() {
    // Header
    const thead = document.getElementById('headFerias');
    thead.innerHTML = '<tr>' + feriasHeaders.map(h => `<th>${h}</th>`).join('') + '</tr>';

    // Detectar índices de colunas de data para formatar
    const colOrd = parseInt(document.getElementById('colunaOrdenacao').value, 10);
    const idxDatas = new Set();
    feriasHeaders.forEach((h, i) => {
        if (/data|gozo|in[ií]cio|fim|per[ií]odo/i.test(h)) idxDatas.add(i);
    });
    if (!isNaN(colOrd)) idxDatas.add(colOrd);

    renderizarBodyFerias(feriasSorted, idxDatas);

    // Stats
    const total = feriasSorted.length;
    const anos  = new Set(feriasSorted.map(r => parseDataFerias(r[isNaN(colOrd) ? 0 : colOrd]).getFullYear())).size;
    document.getElementById('feriasStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${total}</div>
            <div class="stat-label">Programações</div>
        </div>`;
}

function renderizarBodyFerias(dados, idxDatas) {
    const tbody = document.getElementById('bodyFerias');
    tbody.innerHTML = '';
    dados.forEach(row => {
        const td = feriasHeaders.map((_, i) => {
            const val = row[i];
            const txt = idxDatas.has(i) ? formatarDataFerias(val) : (val !== undefined ? val : '–');
            return `<td>${txt}</td>`;
        }).join('');
        tbody.innerHTML += `<tr>${td}</tr>`;
    });
}

function filtrarFerias() {
    const termo = normalizarNome(document.getElementById('buscaFerias').value);
    const colOrd = parseInt(document.getElementById('colunaOrdenacao').value, 10);
    const idxDatas = new Set(feriasHeaders.reduce((acc, h, i) => {
        if (/data|gozo|in[ií]cio|fim|per[ií]odo/i.test(h)) acc.push(i);
        return acc;
    }, []));
    if (!isNaN(colOrd)) idxDatas.add(colOrd);

    const filtrados = termo
        ? feriasSorted.filter(r => r.some(c => normalizarNome(String(c)).includes(termo)))
        : feriasSorted;
    renderizarBodyFerias(filtrados, idxDatas);
}

function imprimirFerias() {
    window.print();
}

```

Depois da remoção, o arquivo deve ir direto da última linha da função anterior a este bloco para o comentário `// SIDEBAR + NAVEGAÇÃO` (não tocado por este plano), com uma única linha em branco entre os dois — igual ao espaçamento já usado entre as outras seções do arquivo.

- [ ] **Passo 7 — Verificar sintaxe.**

Run: `node --check "Projeto Fechamento Folha/quadrante.js"`
Expected: nenhuma saída, exit code 0.

- [ ] **Passo 8 — Verificar que não sobrou nenhuma referência às funções/variáveis removidas.**

Run: `grep -n "irStep4\|processarFerias\|feriasData\|feriasHeaders\|feriasSorted\|arquivoFerias\|detectarCabecalhoFerias\|preCarregarColunas\|onFeriasSelecionada\|renderizarFerias\|renderizarBodyFerias\|filtrarFerias\|imprimirFerias\|parseDataFerias\|formatarDataFerias\|uploadAreaFerias\|colunaOrdenacao\|buscaFerias\|feriasStats\|tabelaFerias\|headFerias\|bodyFerias\|filenameFerias\|inputFerias\|id=\"step4\"\|id=\"step5\"" "Projeto Fechamento Folha/quadrante.html" "Projeto Fechamento Folha/quadrante.js"`

Expected: nenhuma saída (nenhum match) — se aparecer algo, significa que uma referência ficou órfã e precisa ser removida também.

- [ ] **Passo 9 — Verificação manual (sem automação de navegador disponível neste ambiente):** anotar no relatório da task que este passo requer que um humano abra `quadrante.html` logado, clique nos dois botões "📅 Programação de Férias" (Step 2 e Step 3) e confirme que ambos navegam para `ferias.html`, e que o Step 6 (Relatório Líquido) continua acessível e funcional normalmente a partir do Step 3.

- [ ] **Passo 10 — Commit.**

```bash
git add "Projeto Fechamento Folha/quadrante.html" "Projeto Fechamento Folha/quadrante.js"
git commit -m "refactor: Programação de Férias do Quadrante redireciona para ferias.html"
```

---

## Self-Review

- **Cobertura da spec:** seção 3 (remoções em HTML) → Passos 1-2; seção 4 (remoções em JS, incluindo `mostrarStep`) → Passos 3-6; seção 5 (`ferias.html` inalterado) → nenhum passo toca esse arquivo, confirmado; seção 6 (casos de borda) → Passo 9 cobre a navegação manual, o caso de rascunho/progresso preservado não exige código novo (mecanismo já existente e não tocado). Todos os itens do spec têm passo correspondente.
- **Placeholders:** nenhum `TBD`/`TODO` — todos os blocos antes/depois são o texto exato encontrado no arquivo real nesta sessão.
- **Consistência:** `mostrarStep` passa a usar `[1,2,3,6]`, consistente com a remoção dos IDs `step4`/`step5`; nenhuma outra função referencia esses IDs (confirmado por grep antes de escrever este plano, e o Passo 8 formaliza essa verificação para quem executar o plano).
