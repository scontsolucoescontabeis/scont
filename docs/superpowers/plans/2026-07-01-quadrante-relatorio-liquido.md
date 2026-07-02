# Quadrante — Relatório Líquido (Etiquetas Bancárias) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o Step 6 ao `quadrante.html` que importa a planilha "Informações Bancárias / Líquido", persiste os dados bancários no Supabase (reaproveitados nas competências seguintes), e gera um PDF com identidade visual SCONT no molde de `Quadrante Etiquetas - Relatório Líquido.docx`.

**Architecture:** Extensão do wizard existente de `quadrante.html`/`quadrante.js` (mesmo padrão dos Steps 1-5 já implementados). Sem novo arquivo — tudo entra nos arquivos existentes do módulo Quadrante. Persistência via nova tabela Supabase `fechamento_dados_bancarios`. PDF gerado client-side com jsPDF + AutoTable (mesma dependência já usada em `ferias.html`).

**Tech Stack:** Vanilla JS ES2020+, SheetJS/xlsx (já carregado), jsPDF 2.5.1 + jspdf-autotable 3.8.2 (CDN, novo), Supabase JS v2 (já carregado).

## Global Constraints

- Empresa fixa: `CODIGO_EMPRESA = '453'` (já definida em `quadrante.js:6`).
- Tabela Supabase nova: `fechamento_dados_bancarios`, unique em `(codigo_empresa, codigo_empregado)`.
- A aba "Líquido" da planilha **nunca é persistida** — só usada em memória para montar o relatório do mês corrente.
- `tipo_conta` de um empregado já cadastrado **nunca é sobrescrito** por uma nova importação — só editável manualmente pela tela de revisão.
- Sem framework de testes automatizados neste projeto (HTML/JS puro rodando no navegador) — verificação é manual, no navegador, seguindo o padrão já usado nos demais planos deste repositório (`docs/superpowers/plans/2026-06-10-beneficios-va-vt.md`).
- Dados de referência já disponíveis em `Projeto Fechamento Folha/`: `Quadrante Etiquetas - Relatório Líquido.docx` (modelo visual) e `Relação de Líquidos - Informações Bancárias_quadrante.xls` (planilha real de teste, competência 04/2026).

---

## File Map

```
Projeto Fechamento Folha/
├── schema_fechamento.sql   ← MODIFICAR: adicionar CREATE TABLE fechamento_dados_bancarios
├── styles.css              ← MODIFICAR: 1 regra nova (.banco-row)
├── quadrante.html          ← MODIFICAR: CDN jsPDF/AutoTable, botão Step 3, markup Step 6
└── quadrante.js            ← MODIFICAR: constantes, parsing, sync Supabase, revisão, PDF
```

---

## Task 1: Schema Supabase — `fechamento_dados_bancarios`

**Files:**
- Modify: `Projeto Fechamento Folha/schema_fechamento.sql`

**Interfaces:**
- Produces: tabela `public.fechamento_dados_bancarios` com colunas `id, codigo_empresa, codigo_empregado, cpf, nome_empregado, cargo, centro_custo, banco_codigo, agencia, conta, tipo_conta, atualizado_em`, constraint única `fechamento_dados_bancarios_unique (codigo_empresa, codigo_empregado)`.

- [ ] **Adicionar ao final de `schema_fechamento.sql`:**

```sql

-- ============================================================
-- DADOS BANCÁRIOS — Relatório Líquido / Etiquetas Bancárias
-- Persiste a aba "Informações bancárias" entre competências.
-- tipo_conta é gerenciado manualmente na tela de revisão e
-- NUNCA é sobrescrito por uma nova importação.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fechamento_dados_bancarios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa   TEXT NOT NULL,
    codigo_empregado TEXT NOT NULL,
    cpf              TEXT,
    nome_empregado   TEXT,
    cargo            TEXT,
    centro_custo     TEXT,
    banco_codigo     TEXT,
    agencia          TEXT,
    conta            TEXT,
    tipo_conta       TEXT NOT NULL DEFAULT 'C.Corrente',
    atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fechamento_dados_bancarios_unique UNIQUE (codigo_empresa, codigo_empregado)
);

CREATE INDEX IF NOT EXISTS idx_fech_dados_bancarios_empresa
    ON public.fechamento_dados_bancarios (codigo_empresa);

ALTER TABLE public.fechamento_dados_bancarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_dados_bancarios: leitura autenticado" ON public.fechamento_dados_bancarios;
DROP POLICY IF EXISTS "fechamento_dados_bancarios: escrita autenticado"  ON public.fechamento_dados_bancarios;

CREATE POLICY "fechamento_dados_bancarios: leitura autenticado"
    ON public.fechamento_dados_bancarios FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_dados_bancarios: escrita autenticado"
    ON public.fechamento_dados_bancarios FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

- [ ] **Executar o SQL acima no SQL Editor do Supabase** (projeto Portal Scont, mesmo projeto usado pelas demais tabelas `fechamento_*`).
- [ ] **Verificar:** no Table Editor do Supabase, a tabela `fechamento_dados_bancarios` aparece com as 12 colunas listadas acima e RLS habilitado.
- [ ] **Commit:**

```bash
git add "Projeto Fechamento Folha/schema_fechamento.sql"
git commit -m "feat: schema fechamento_dados_bancarios — Relatório Líquido Quadrante"
```

---

## Task 2: HTML — CDN, botão de acesso e markup do Step 6

**Files:**
- Modify: `Projeto Fechamento Folha/quadrante.html`
- Modify: `Projeto Fechamento Folha/styles.css`

**Interfaces:**
- Produces (IDs/handlers consumidos pelo JS nas Tasks 3-6): `uploadAreaLiquido`, `inputLiquido`, `filenameLiquido`, `labelCompetencia6`, `painelUploadLiquido`, `painelRevisaoLiquido`, `bodyLiquido`, `blocoPendenciasLiquido`, `bodyPendenciasLiquido`, `btnGerarPdfLiquido`; handlers `processarLiquido()`, `irStep6()`, `voltarParaUploadLiquido()`, `gerarPDFLiquido()`.

- [ ] **Em `quadrante.html`, logo após a linha do SheetJS (linha 12: `<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>`), adicionar:**

```html
    <!-- jsPDF + AutoTable (Relatório Líquido) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
```

- [ ] **No Step 3 (`<div class="step-card" id="step3" ...>`), dentro do `.btn-group` existente, adicionar um quarto botão.** O bloco atual é:

```html
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="voltarStep(2)">← Voltar</button>
                <button class="btn btn-success" onclick="baixarTXT()">⬇ Baixar TXT</button>
                <button class="btn btn-info" onclick="irStep4()">📅 Programação de Férias</button>
            </div>
        </div>

        <!-- STEP 4: UPLOAD FÉRIAS -->
```

Substituir por:

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

- [ ] **Logo após o fechamento do Step 5** (o bloco termina em `</div>` seguido de `</div>` e `</div><!-- /telaProcessamento -->`, por volta da linha 286-289), inserir o novo Step 6 **antes** do primeiro `</div>` de fechamento:

```html
        <div class="step-card" id="step5" style="display:none;">
            ...
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="voltarStep(4)">← Voltar</button>
                <button class="btn btn-primary" onclick="imprimirFerias()">🖨️ Imprimir / Salvar PDF</button>
            </div>
        </div>

        <!-- STEP 6: RELATÓRIO LÍQUIDO -->
        <div class="step-card" id="step6" style="display:none;">
            <div class="step-title">
                <div class="step-number">6</div>
                Relatório Líquido — Etiquetas Bancárias
                <span id="labelCompetencia6" style="font-size:12px; font-weight:400; color:var(--text-secondary); margin-left:10px;"></span>
            </div>

            <!-- Painel: Upload -->
            <div id="painelUploadLiquido">
                <div class="alert alert-info">
                    Faça o upload da planilha com as abas "Informações bancárias" e "Líquido". Os dados bancários ficam salvos e são reaproveitados nas competências seguintes — só a aba "Líquido" é específica deste mês.
                </div>

                <label style="font-weight:600; font-size:13px; display:block; margin-bottom:8px;">
                    Planilha de Informações Bancárias / Líquido (Excel) *
                </label>
                <div class="upload-area" id="uploadAreaLiquido" onclick="document.getElementById('inputLiquido').click()">
                    <div class="upload-icon">🏷️</div>
                    <div class="upload-text">
                        Arraste o arquivo aqui ou <strong>clique para selecionar</strong>
                    </div>
                    <div class="upload-text" style="font-size:11px; margin-top:4px;">
                        Abas esperadas: "Informações bancárias" e "Líquido"
                    </div>
                    <div class="upload-filename" id="filenameLiquido"></div>
                    <input type="file" id="inputLiquido" accept=".xlsx,.xls">
                </div>

                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="voltarStep(3)">← Voltar</button>
                    <button class="btn btn-primary" onclick="processarLiquido()">▶ Processar Planilha</button>
                </div>
            </div>

            <!-- Painel: Revisão -->
            <div id="painelRevisaoLiquido" style="display:none;">
                <div class="table-wrapper">
                    <table id="tabelaLiquido">
                        <thead>
                            <tr>
                                <th>Código</th><th>Funcionário</th><th>CPF</th>
                                <th>Agência / Conta</th><th>Tipo de Conta</th><th>Valor Líquido</th>
                            </tr>
                        </thead>
                        <tbody id="bodyLiquido"></tbody>
                    </table>
                </div>

                <div id="blocoPendenciasLiquido" style="display:none; margin-top:20px;">
                    <div class="alert alert-warning">
                        ⚠️ Empregados da aba Líquido sem dados bancários cadastrados. Complete os dados abaixo ou marque para excluir deste relatório — o botão de gerar PDF fica bloqueado até resolver todos.
                    </div>
                    <div class="table-wrapper">
                        <table id="tabelaPendenciasLiquido">
                            <thead><tr><th>Empregados pendentes</th></tr></thead>
                            <tbody id="bodyPendenciasLiquido"></tbody>
                        </table>
                    </div>
                </div>

                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="voltarParaUploadLiquido()">← Nova Importação</button>
                    <button class="btn btn-primary" id="btnGerarPdfLiquido" onclick="gerarPDFLiquido()">📄 Gerar PDF</button>
                </div>
            </div>
        </div>

    </div>
    </div><!-- /telaProcessamento -->
```

(A última linha `<div class="step-card" id="step5" ...> ... </div>` acima é só contexto — não duplicar; edite apenas inserindo o bloco `<!-- STEP 6 ... -->` entre o `</div>` que fecha o Step 5 e o `</div>\n</div><!-- /telaProcessamento -->` que já existe no arquivo.)

- [ ] **Em `styles.css`, logo após a regra `.badge-booleano` (bloco de badges, por volta da linha 334), adicionar:**

```css
/* Linha de agrupamento por banco — Relatório Líquido */
tbody tr.banco-row td {
    background: var(--text-primary);
    color: white;
    font-weight: 700;
    padding: 8px 12px;
}
```

- [ ] **Verificar:** abrir `quadrante.html` no navegador logado, ir até o Step 3 (ou navegar diretamente alterando `display:none` via devtools se preferir) e confirmar que o botão "🏷️ Etiquetas Bancárias" aparece e que, ao clicar, nada quebra no console (o Step 6 pode ainda não abrir porque `irStep6()`/`processarLiquido()` só serão implementados na Task 5 — nesta task, é esperado um erro `irStep6 is not defined` no console, o que é aceitável até a Task 5).
- [ ] **Commit:**

```bash
git add "Projeto Fechamento Folha/quadrante.html" "Projeto Fechamento Folha/styles.css"
git commit -m "feat: HTML/CSS do Step 6 (Relatório Líquido) — Quadrante"
```

---

## Task 3: JS — Constantes, estado e parsing das abas

**Files:**
- Modify: `Projeto Fechamento Folha/quadrante.js`

**Interfaces:**
- Consumes: `normalizarNome(s)` (já existe em `quadrante.js:58`).
- Produces: estado `arquivoLiquido, dadosBancariosDB, linhasLiquido, gruposLiquido, pendenciasLiquido, excluidosDoRelatorio`; constantes `BANCOS_FEBRABAN`, `MAPA_BANCARIA`, `MAPA_LIQUIDO`; funções `nomeBanco(codigo)`, `escHtml(s)`, `chaveColuna(h)`, `normalizarCodigo(v)`, `formatarCpf(digits)`, `encontrarAba(workbook, candidatos)`, `lerAbaComoObjetos(sheet, mapaColunas)`, `dedupeBancaria(linhas)` — todas usadas pelas Tasks 4-6.

- [ ] **No bloco de estado global (após a linha `let faltaDatasMap = {};`, linha 24 de `quadrante.js`), adicionar:**

```javascript
let arquivoLiquido     = null;              // File selecionado no Step 6
let dadosBancariosDB   = {};                // codigo_empregado → registro de fechamento_dados_bancarios
let linhasLiquido      = [];                // [{codigo_empregado, cpf, nome, valorInt}] da aba Líquido do mês
let gruposLiquido      = [];                // [{bancoCodigo, bancoNome, linhas:[...], totalInt}]
let pendenciasLiquido  = [];                // linhas de linhasLiquido sem dados bancários
let excluidosDoRelatorio = new Set();       // codigo_empregado excluídos manualmente do relatório do mês
```

- [ ] **Na função `mostrarStep` (linha 40-46 de `quadrante.js`), trocar o array de steps:**

Código atual:
```javascript
function mostrarStep(n) {
    [1,2,3,4,5].forEach(i => {
        const el = document.getElementById('step' + i);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

Novo:
```javascript
function mostrarStep(n) {
    [1,2,3,4,5,6].forEach(i => {
        const el = document.getElementById('step' + i);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

- [ ] **No `DOMContentLoaded` (linha 283-301 de `quadrante.js`), logo após a linha `configurarUploadArea('uploadAreaFerias', 'inputFerias', 'filenameFerias', onFeriasSelecionada);`, adicionar:**

```javascript
    // Upload área – relatório líquido (etiquetas bancárias)
    configurarUploadArea('uploadAreaLiquido', 'inputLiquido', 'filenameLiquido', onLiquidoSelecionado);
```

- [ ] **Ao final de `quadrante.js`, adicionar o novo bloco de utilitários e parsing:**

```javascript
// ══════════════════════════════════════════════
// RELATÓRIO LÍQUIDO — ETIQUETAS BANCÁRIAS (STEP 6)
// ══════════════════════════════════════════════

// ── Mapa de bancos FEBRABAN ──────────────────────────────
const BANCOS_FEBRABAN = {
    '001': 'BANCO DO BRASIL', '033': 'BANCO SANTANDER', '077': 'BANCO INTER',
    '104': 'CAIXA ECONÔMICA FEDERAL', '208': 'BANCO BTG PACTUAL', '212': 'BANCO ORIGINAL',
    '237': 'BANCO BRADESCO', '260': 'NU PAGAMENTOS (NUBANK)', '318': 'BANCO BMG',
    '336': 'BANCO C6', '341': 'BANCO ITAÚ', '399': 'HSBC', '422': 'BANCO SAFRA',
    '623': 'BANCO PAN', '655': 'BANCO VOTORANTIM', '748': 'SICREDI', '756': 'SICOOB',
};

function nomeBanco(codigo) {
    const c = String(codigo || '').replace(/\D/g, '').padStart(3, '0');
    return BANCOS_FEBRABAN[c] || ('BANCO ' + c);
}

// ── Utilitários de texto/planilha ────────────────────────
function escHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Normaliza cabeçalho de coluna para comparação robusta (remove pontuação, °/º etc.)
function chaveColuna(h) {
    return normalizarNome(h).replace(/[^a-z0-9 ]/g, '');
}

// "32.0" ou 32 (número do Excel) → "32"
function normalizarCodigo(v) {
    if (v === '' || v === null || v === undefined) return '';
    const n = Number(v);
    return isNaN(n) ? String(v).trim() : String(Math.trunc(n));
}

function formatarCpf(digits) {
    const d = String(digits || '').replace(/\D/g, '');
    if (d.length !== 11) return digits || '';
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
}

// Encontra a aba do workbook cujo nome normalizado bate com um dos candidatos
function encontrarAba(workbook, candidatosNormalizados) {
    const nomeEncontrado = workbook.SheetNames.find(n => candidatosNormalizados.includes(normalizarNome(n)));
    return nomeEncontrado ? workbook.Sheets[nomeEncontrado] : null;
}

// Lê uma aba usando a primeira linha como cabeçalho, mapeando colunas por nome normalizado.
// mapaColunas: { chaveDestino: [candidatosNormalizadosViaChaveColuna] }
function lerAbaComoObjetos(sheet, mapaColunas) {
    const rows    = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headers = (rows[0] || []).map(chaveColuna);
    const idx = {};
    Object.entries(mapaColunas).forEach(([chave, candidatos]) => {
        idx[chave] = headers.findIndex(h => candidatos.includes(h));
    });

    const out = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every(c => c === '')) continue;
        const obj = {};
        Object.entries(idx).forEach(([chave, i]) => { obj[chave] = i >= 0 ? row[i] : ''; });
        out.push(obj);
    }
    return out;
}

const MAPA_BANCARIA = {
    codigo:      ['codigo'],
    nome:        ['nome do empregado'],
    cargo:       ['cargo'],
    centroCusto: ['ccusto', 'centro de custo'],
    cpf:         ['cpf'],
    banco:       ['banco'],
    agencia:     ['agencia'],
    conta:       ['n conta', 'no conta'],
};

const MAPA_LIQUIDO = {
    codigo: ['codigo'],
    nome:   ['nome do empregado'],
    cpf:    ['cpf'],
    valor:  ['valor'],
};

// Deduplica linhas da aba bancária por código do empregado (última ocorrência vence)
function dedupeBancaria(linhas) {
    const map = {};
    linhas.forEach(l => {
        const cod = normalizarCodigo(l.codigo);
        if (!cod) return;
        map[cod] = {
            codigo_empregado: cod,
            cpf:              String(l.cpf || '').replace(/\D/g, ''),
            nome_empregado:   String(l.nome || '').trim(),
            cargo:            String(l.cargo || '').trim(),
            centro_custo:     String(l.centroCusto || '').trim(),
            banco_codigo:     l.banco === '' ? '' : String(Math.trunc(Number(l.banco))).padStart(3, '0'),
            agencia:          String(l.agencia || '').trim(),
            conta:            String(l.conta || '').trim(),
        };
    });
    return Object.values(map);
}
```

- [ ] **Verificar:** recarregar `quadrante.html` no navegador com o DevTools aberto — nenhum erro de sintaxe no console (a única pendência esperada até a Task 5 é `irStep6`/`processarLiquido` ainda não existirem, o que só aparece se o botão for clicado).
- [ ] **Commit:**

```bash
git add "Projeto Fechamento Folha/quadrante.js"
git commit -m "feat: constantes e parsing das abas — Relatório Líquido Quadrante"
```

---

## Task 4: JS — Sincronização com Supabase (`fechamento_dados_bancarios`)

**Files:**
- Modify: `Projeto Fechamento Folha/quadrante.js`

**Interfaces:**
- Consumes: `supabaseClient`, `CODIGO_EMPRESA` (já existem), `mostrarMensagem`, `encontrarAba`, `lerAbaComoObjetos`, `dedupeBancaria`, `MAPA_BANCARIA`, `MAPA_LIQUIDO`, `normalizarCodigo`, `parseMoney` (todos de tasks anteriores / já existentes em `quadrante.js`), `dadosBancariosDB`, `linhasLiquido`, `excluidosDoRelatorio`, `arquivoLiquido`.
- Produces: `onLiquidoSelecionado(file, filenameId)`, `carregarDadosBancariosDB()`, `sincronizarDadosBancarios(linhasPlanilha)`, `processarLiquido()` — a última chama `montarGruposLiquido()`, `renderizarRevisaoLiquido()` e `mostrarPainelLiquido('revisao')` que serão definidas na Task 5 (declarações de função são hoisted, então a ordem no arquivo não impede o funcionamento em runtime).

- [ ] **Adicionar ao final de `quadrante.js` (após o bloco da Task 3):**

```javascript
function onLiquidoSelecionado(file, filenameId) {
    arquivoLiquido = file;
    const el = document.getElementById(filenameId);
    el.textContent = '✔ ' + file.name;
    el.style.display = 'block';
}

async function carregarDadosBancariosDB() {
    const { data, error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .select('*')
        .eq('codigo_empresa', CODIGO_EMPRESA);
    if (error) throw error;
    dadosBancariosDB = {};
    (data || []).forEach(r => { dadosBancariosDB[r.codigo_empregado] = r; });
}

// Faz upsert dos dados bancários da planilha preservando o tipo_conta já
// salvo (nunca sobrescrito pela importação), e recarrega o estado local.
async function sincronizarDadosBancarios(linhasPlanilha) {
    await carregarDadosBancariosDB();

    const upsertRows = linhasPlanilha.map(l => {
        const existente = dadosBancariosDB[l.codigo_empregado];
        return {
            codigo_empresa:   CODIGO_EMPRESA,
            codigo_empregado: l.codigo_empregado,
            cpf:              l.cpf,
            nome_empregado:   l.nome_empregado,
            cargo:            l.cargo,
            centro_custo:     l.centro_custo,
            banco_codigo:     l.banco_codigo,
            agencia:          l.agencia,
            conta:            l.conta,
            tipo_conta:       existente ? existente.tipo_conta : 'C.Corrente',
        };
    });

    if (upsertRows.length) {
        const { error } = await supabaseClient
            .from('fechamento_dados_bancarios')
            .upsert(upsertRows, { onConflict: 'codigo_empresa,codigo_empregado' });
        if (error) throw error;
    }

    await carregarDadosBancariosDB();
}

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

    try {
        const buffer   = await arquivoLiquido.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        const sheetBancaria = encontrarAba(workbook, ['informacoes bancarias']);
        const sheetLiquido  = encontrarAba(workbook, ['liquido']);

        if (!sheetBancaria || !sheetLiquido) {
            mostrarMensagem('Erro', 'A planilha precisa conter as abas "Informações bancárias" e "Líquido".');
            return;
        }

        const linhasBancariaPlanilha = dedupeBancaria(lerAbaComoObjetos(sheetBancaria, MAPA_BANCARIA));
        const linhasLiquidoPlanilha  = lerAbaComoObjetos(sheetLiquido, MAPA_LIQUIDO);

        await sincronizarDadosBancarios(linhasBancariaPlanilha);

        linhasLiquido = linhasLiquidoPlanilha
            .map(l => ({
                codigo_empregado: normalizarCodigo(l.codigo),
                cpf:              String(l.cpf || '').replace(/\D/g, ''),
                nome:             String(l.nome || '').trim(),
                valorInt:         parseMoney(l.valor),
            }))
            .filter(l => l.codigo_empregado && l.valorInt > 0);

        excluidosDoRelatorio.clear();
        montarGruposLiquido();
        renderizarRevisaoLiquido();
        document.getElementById('labelCompetencia6').textContent = 'Competência: ' + comp;
        mostrarPainelLiquido('revisao');
    } catch (e) {
        console.error('Erro ao processar planilha do Relatório Líquido:', e);
        mostrarMensagem('Erro', 'Falha ao processar a planilha: ' + e.message);
    }
}
```

- [ ] **Verificar:** com a Task 5 ainda não implementada, este código não deve ser exercitado ainda — apenas confirmar no DevTools que não há erro de sintaxe ao recarregar a página.
- [ ] **Commit:**

```bash
git add "Projeto Fechamento Folha/quadrante.js"
git commit -m "feat: sincronização Supabase e leitura da planilha — Relatório Líquido Quadrante"
```

---

## Task 5: JS — Matching, agrupamento e tela de revisão

**Files:**
- Modify: `Projeto Fechamento Folha/quadrante.js`

**Interfaces:**
- Consumes: `linhasLiquido`, `dadosBancariosDB`, `excluidosDoRelatorio`, `gruposLiquido`, `pendenciasLiquido`, `nomeBanco`, `escHtml`, `formatarCpf`, `CODIGO_EMPRESA`, `supabaseClient`, `mostrarMensagem`, `mostrarStep` (todos já definidos nas tasks anteriores).
- Produces: `buscarDadosBancarios(linha)`, `montarGruposLiquido()`, `atualizarBotaoPdfLiquido()`, `renderizarRevisaoLiquido()`, `salvarTipoConta(selectEl)`, `marcarExcluido(codigo, excluir)`, `salvarDadosBancariosManual(codigo)`, `mostrarPainelLiquido(nome)`, `irStep6()`, `voltarParaUploadLiquido()` — `gerarPDFLiquido()` (Task 6) consome `gruposLiquido` e `pendenciasLiquido` produzidos aqui.

- [ ] **Adicionar ao final de `quadrante.js` (após o bloco da Task 4):**

```javascript
function buscarDadosBancarios(linha) {
    if (dadosBancariosDB[linha.codigo_empregado]) return dadosBancariosDB[linha.codigo_empregado];
    if (linha.cpf) {
        return Object.values(dadosBancariosDB).find(d => d.cpf === linha.cpf) || null;
    }
    return null;
}

function montarGruposLiquido() {
    const porBanco = {};
    pendenciasLiquido = [];

    linhasLiquido.forEach(linha => {
        if (excluidosDoRelatorio.has(linha.codigo_empregado)) return;

        const banco = buscarDadosBancarios(linha);
        if (!banco || !banco.banco_codigo) {
            pendenciasLiquido.push(linha);
            return;
        }

        if (!porBanco[banco.banco_codigo]) {
            porBanco[banco.banco_codigo] = {
                bancoCodigo: banco.banco_codigo,
                bancoNome:   nomeBanco(banco.banco_codigo),
                linhas:      [],
                totalInt:    0,
            };
        }
        porBanco[banco.banco_codigo].linhas.push({
            codigo_empregado: linha.codigo_empregado,
            nome:             banco.nome_empregado || linha.nome,
            cpf:              banco.cpf || linha.cpf,
            agencia:          banco.agencia,
            conta:            banco.conta,
            tipoConta:        banco.tipo_conta,
            valorInt:         linha.valorInt,
        });
        porBanco[banco.banco_codigo].totalInt += linha.valorInt;
    });

    gruposLiquido = Object.values(porBanco).sort((a, b) => a.bancoNome.localeCompare(b.bancoNome, 'pt-BR'));
    atualizarBotaoPdfLiquido();
}

function atualizarBotaoPdfLiquido() {
    const btn = document.getElementById('btnGerarPdfLiquido');
    if (!btn) return;
    btn.disabled = pendenciasLiquido.length > 0;
    btn.title = pendenciasLiquido.length > 0
        ? 'Complete ou exclua os empregados sem dados bancários antes de gerar o PDF'
        : '';
}

function renderizarRevisaoLiquido() {
    const tbody = document.getElementById('bodyLiquido');

    if (!gruposLiquido.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:16px;">Nenhum lançamento com dados bancários completos.</td></tr>';
    } else {
        tbody.innerHTML = gruposLiquido.map(g => {
            const linhasHtml = g.linhas.map(l => `
                <tr>
                    <td>${l.codigo_empregado}</td>
                    <td>${escHtml(l.nome)}</td>
                    <td>${formatarCpf(l.cpf)}</td>
                    <td>${escHtml(l.agencia)} / ${escHtml(l.conta)}</td>
                    <td>
                        <select class="tipo-select" data-codigo="${l.codigo_empregado}" onchange="salvarTipoConta(this)">
                            <option value="C.Corrente" ${l.tipoConta === 'C.Corrente' ? 'selected' : ''}>C.Corrente</option>
                            <option value="C.Salário" ${l.tipoConta === 'C.Salário' ? 'selected' : ''}>C.Salário</option>
                            <option value="Poupança" ${l.tipoConta === 'Poupança' ? 'selected' : ''}>Poupança</option>
                        </select>
                    </td>
                    <td>R$ ${(l.valorInt / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>`).join('');

            return `
                <tr class="banco-row"><td colspan="6">🏦 Banco: ${escHtml(g.bancoNome)}</td></tr>
                ${linhasHtml}
                <tr class="total-row">
                    <td colspan="5">Total ${escHtml(g.bancoNome)}</td>
                    <td>R$ ${(g.totalInt / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>`;
        }).join('');
    }

    const bloco     = document.getElementById('blocoPendenciasLiquido');
    const tbodyPend = document.getElementById('bodyPendenciasLiquido');

    if (!pendenciasLiquido.length) {
        bloco.style.display = 'none';
        tbodyPend.innerHTML = '';
    } else {
        bloco.style.display = 'block';
        tbodyPend.innerHTML = pendenciasLiquido.map(l => `
            <tr>
                <td>
                    <div class="inline-register-form">
                        <span style="font-weight:600;font-size:12px;color:var(--primary-color);">
                            ${l.codigo_empregado} — ${escHtml(l.nome)} — sem dados bancários:
                        </span>
                        <input type="text" class="pend-banco" data-codigo="${l.codigo_empregado}" placeholder="Cód. Banco (ex: 341)"
                            style="width:130px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                        <input type="text" class="pend-agencia" data-codigo="${l.codigo_empregado}" placeholder="Agência"
                            style="width:90px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                        <input type="text" class="pend-conta" data-codigo="${l.codigo_empregado}" placeholder="Conta"
                            style="width:110px;padding:6px 10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;">
                        <select class="pend-tipo tipo-select" data-codigo="${l.codigo_empregado}">
                            <option value="C.Corrente">C.Corrente</option>
                            <option value="C.Salário">C.Salário</option>
                            <option value="Poupança">Poupança</option>
                        </select>
                        <button class="btn btn-primary btn-small" onclick="salvarDadosBancariosManual('${l.codigo_empregado}')">💾 Salvar</button>
                        <label style="font-size:12px;display:flex;align-items:center;gap:4px;">
                            <input type="checkbox" onchange="marcarExcluido('${l.codigo_empregado}', this.checked)"> Excluir deste relatório
                        </label>
                    </div>
                </td>
            </tr>`).join('');
    }
}

async function salvarTipoConta(selectEl) {
    const codigo = selectEl.dataset.codigo;
    const tipo   = selectEl.value;

    const { error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .update({ tipo_conta: tipo, atualizado_em: new Date().toISOString() })
        .eq('codigo_empresa', CODIGO_EMPRESA)
        .eq('codigo_empregado', codigo);

    if (error) { mostrarMensagem('Erro', 'Falha ao salvar tipo de conta: ' + error.message); return; }

    if (dadosBancariosDB[codigo]) dadosBancariosDB[codigo].tipo_conta = tipo;
    gruposLiquido.forEach(g => g.linhas.forEach(l => { if (l.codigo_empregado === codigo) l.tipoConta = tipo; }));
}

function marcarExcluido(codigo, excluir) {
    if (excluir) excluidosDoRelatorio.add(codigo);
    else excluidosDoRelatorio.delete(codigo);
    montarGruposLiquido();
    renderizarRevisaoLiquido();
}

async function salvarDadosBancariosManual(codigo) {
    const bancoInput   = document.querySelector(`.pend-banco[data-codigo="${codigo}"]`);
    const agenciaInput = document.querySelector(`.pend-agencia[data-codigo="${codigo}"]`);
    const contaInput   = document.querySelector(`.pend-conta[data-codigo="${codigo}"]`);
    const tipoSelect   = document.querySelector(`.pend-tipo[data-codigo="${codigo}"]`);

    const bancoCodigo = String(bancoInput.value || '').replace(/\D/g, '').padStart(3, '0');
    const agencia      = agenciaInput.value.trim();
    const conta        = contaInput.value.trim();
    const tipoConta     = tipoSelect.value;

    if (!bancoCodigo || bancoCodigo === '000' || !agencia || !conta) {
        mostrarMensagem('Atenção', 'Preencha Banco, Agência e Conta antes de salvar.');
        return;
    }

    const linha = linhasLiquido.find(l => l.codigo_empregado === codigo);
    const registro = {
        codigo_empresa:   CODIGO_EMPRESA,
        codigo_empregado: codigo,
        cpf:              linha ? linha.cpf : '',
        nome_empregado:   linha ? linha.nome : '',
        cargo:            '',
        centro_custo:     '',
        banco_codigo:     bancoCodigo,
        agencia,
        conta,
        tipo_conta:       tipoConta,
    };

    const { error } = await supabaseClient
        .from('fechamento_dados_bancarios')
        .upsert(registro, { onConflict: 'codigo_empresa,codigo_empregado' });

    if (error) { mostrarMensagem('Erro', 'Falha ao salvar dados bancários: ' + error.message); return; }

    dadosBancariosDB[codigo] = registro;
    montarGruposLiquido();
    renderizarRevisaoLiquido();
}

function mostrarPainelLiquido(nome) {
    document.getElementById('painelUploadLiquido').style.display  = nome === 'upload'  ? 'block' : 'none';
    document.getElementById('painelRevisaoLiquido').style.display = nome === 'revisao' ? 'block' : 'none';
}

function voltarParaUploadLiquido() { mostrarPainelLiquido('upload'); }

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

- [ ] **Verificar (fluxo completo até a revisão, sem PDF ainda):**
  1. Abrir `quadrante.html` logado, preencher Competência `04/2026` no Step 1.
  2. Subir a planilha de fechamento normal e avançar até o Step 3 (ou simplesmente digitar a competência e ir direto ao botão, já que `irStep6` só valida a competência).
  3. Clicar em "🏷️ Etiquetas Bancárias" → deve abrir o Step 6, painel de Upload.
  4. Selecionar o arquivo `Relação de Líquidos - Informações Bancárias_quadrante.xls` (está na pasta do projeto) e clicar "▶ Processar Planilha".
  5. Confirmar: tabela de revisão aparece agrupada por banco (Banco Santander, Banco Itaú), com linhas de Total por grupo; a seção de pendências aparece para empregados sem banco cadastrado (ex.: DANIELA APARECIDA FONSECA, que na planilha de teste está com banco/agência/conta em branco).
  6. Trocar o Tipo de Conta de um empregado no select → recarregar a página, repetir o processamento → confirmar que o valor escolhido foi mantido (não voltou para "C.Corrente").
  7. Preencher os campos de um empregado pendente e clicar "💾 Salvar" → ele deve sair da lista de pendências e entrar no grupo do banco informado.
  8. Marcar "Excluir deste relatório" em outro pendente → ele deve sumir da lista de pendências.
  9. Confirmar que o botão "📄 Gerar PDF" fica habilitado quando não há mais pendências.
- [ ] **Commit:**

```bash
git add "Projeto Fechamento Folha/quadrante.js"
git commit -m "feat: matching, agrupamento e tela de revisão — Relatório Líquido Quadrante"
```

---

## Task 6: JS — Geração do PDF (jsPDF + AutoTable)

**Files:**
- Modify: `Projeto Fechamento Folha/quadrante.js`

**Interfaces:**
- Consumes: `gruposLiquido`, `pendenciasLiquido`, `formatarCpf`, `mostrarMensagem` (das tasks anteriores), `window.jspdf` (CDN da Task 2).
- Produces: `QUADRANTE_RAZAO_SOCIAL`, `QUADRANTE_CNPJ`, `QUADRANTE_INSCRICAO`, `QUADRANTE_ENDERECO`, `periodoCompetencia(comp)`, `gerarPDFLiquido()`.

- [ ] **Adicionar ao final de `quadrante.js` (após o bloco da Task 5):**

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

- [ ] **Verificar:**
  1. Repetir o fluxo da Task 5 até deixar zero pendências (completando ou excluindo DANIELA e qualquer outro pendente da planilha de teste).
  2. Clicar em "📄 Gerar PDF" → um arquivo `Relacao_Bancaria_Quadrante_04-2026.pdf` deve ser baixado.
  3. Abrir o PDF gerado e comparar visualmente com `Quadrante Etiquetas - Relatório Líquido.docx`: cabeçalho com razão social/CNPJ/Inscrição/Endereço/Período, tabela agrupada por banco com linha "Banco: ..." em destaque, linhas de empregados com Código/Funcionário/CPF/Agência-Conta-Tipo/Valor Líquido, e linha "Total:" em negrito ao final de cada grupo.
  4. Testar o caso de bloqueio: reprocessar a planilha (gera pendências de novo) e confirmar que clicar em "📄 Gerar PDF" com o botão desabilitado não faz nada, e que forçar a chamada via console (`gerarPDFLiquido()`) mostra a mensagem de atenção em vez de gerar o PDF.
- [ ] **Commit:**

```bash
git add "Projeto Fechamento Folha/quadrante.js"
git commit -m "feat: geração de PDF (jsPDF + AutoTable) — Relatório Líquido Quadrante"
```

---

## Task 7: Verificação end-to-end com os arquivos reais do projeto

**Files:** nenhum arquivo novo — apenas verificação manual usando os arquivos já presentes em `Projeto Fechamento Folha/`.

- [ ] **Rodar o fluxo completo do zero**, com a tabela `fechamento_dados_bancarios` vazia (ou já populada pelas verificações anteriores):
  1. Preencher Competência `04/2026` no Step 1.
  2. Ir direto ao Step 6 (botão no Step 3, ou navegação manual) e importar `Relação de Líquidos - Informações Bancárias_quadrante.xls`.
  3. Resolver todas as pendências (a planilha de teste tem pelo menos DANIELA APARECIDA FONSECA sem banco/agência/conta — usar dados fictícios de teste, ex.: banco `033`, agência `1234`, conta `56789-0`, tipo `C.Corrente`, só para validar o fluxo).
  4. Gerar o PDF e conferir que os 2 grupos (Santander e Itaú) aparecem com os totais batendo com a soma manual dos valores da aba "Líquido" para os funcionários de cada banco.
- [ ] **Testar reaproveitamento entre competências:** sem limpar a tabela `fechamento_dados_bancarios`, voltar ao Step 1, trocar a competência para `05/2026`, ir ao Step 6 e reimportar a mesma planilha. Confirmar que nenhum empregado que já tinha dados completos vira pendência de novo, e que o Tipo de Conta editado manualmente na Task 5/6 continua com o valor escolhido (não voltou para "C.Corrente").
- [ ] **Conferir no Supabase Table Editor** que `fechamento_dados_bancarios` tem uma linha por `codigo_empregado` da empresa `453` (sem duplicatas), e que `tipo_conta` reflete as edições feitas na tela.
- [ ] **Revisar a spec** `docs/superpowers/specs/2026-07-01-quadrante-relatorio-liquido-design.md` seção por seção e confirmar que cada item foi implementado (checklist mental, não precisa editar o arquivo).
- [ ] Nenhum commit necessário nesta task — é só verificação. Se algum ajuste for necessário durante a verificação, corrigir no arquivo relevante e commitar separadamente com uma mensagem descrevendo o ajuste (ex.: `fix: ajusta matching por CPF quando código diverge — Relatório Líquido Quadrante`).

---

## Self-Review

- **Cobertura da spec:** Step 6 com upload → revisão → PDF (Tasks 2, 4, 5, 6); persistência com preservação de `tipo_conta` (Task 4, `sincronizarDadosBancarios`); mapa FEBRABAN (Task 3); dedupe de linhas duplicadas da aba bancária (Task 3, `dedupeBancaria`); matching por Código com fallback CPF (Task 5, `buscarDadosBancarios`); bloqueio de PDF com pendências + exclusão manual (Task 5/6); PDF com identidade SCONT no molde do DOCX (Task 6); validação de competência preenchida (Task 5, `irStep6`). Todos os itens da seção 5 (casos de borda) da spec têm tratamento correspondente.
- **Placeholders:** nenhum `TBD`/`TODO` — todo código é completo e executável.
- **Consistência de tipos/nomes:** `gruposLiquido[].linhas[].tipoConta` (camelCase, objeto em memória) é distinto de `banco.tipo_conta` (snake_case, linha do Supabase) — confirmado que `montarGruposLiquido` faz a tradução correta ao montar `linhas`. `nomeBanco`, `escHtml`, `formatarCpf`, `encontrarAba`, `dedupeBancaria` são usados com a mesma assinatura em todas as tasks que os consomem.
