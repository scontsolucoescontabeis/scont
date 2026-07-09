# Importação de Férias Calculadas e Exibição na Folha de Ponto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir importar o PDF "Relação de Férias Calculadas" (todas as empresas de uma vez), persistir os períodos de férias por empregado no Supabase, e exibir automaticamente um badge "FÉRIAS" — informativo, não editável — nos dias correspondentes durante a revisão da Folha de Ponto, sem impactar faltante/faltas quando não houver flag manual nem horas registradas.

**Architecture:** Parsing 100% client-side com PDF.js (extração de texto por posição `x`/`y`, reconstrução de linhas visuais, regex sobre as linhas). Persistência em uma tabela nova (`rh_ferias_calculadas`, upsert por empresa+empregado+início). Consumo em `calcularFolha` via um mapa em memória (`state.feriasCalculadas`) carregado por empresa nos dois pontos onde uma empresa é selecionada para edição (fluxo manual único e fila de lote de grupo).

**Tech Stack:** JavaScript vanilla, HTML inline, Supabase (Postgres) via `supabaseClient`, PDF.js 3.11.174 (UMD, via CDN) para extração de texto. Sem build step. A lógica pura de parsing (sem DOM/Supabase/PDF.js) ganha testes automatizados reais via `node:assert`, sem framework — mesma filosofia "sem framework de testes" do resto do projeto, mas cobrindo a parte de maior risco (regex sobre texto de PDF) com verificação automatizada em vez de só manual.

## Global Constraints

- Só a coluna **Férias Início/Fim** do PDF é extraída e usada. **Abono** é ignorado (não é dia de afastamento).
- Upsert por `(codigo_empresa, codigo_empregado, ferias_inicio)` — nunca apaga histórico, nunca duplica.
- Badge "FÉRIAS" é automático e não editável — não vira opção no dropdown manual de Folga/Falta.
- Dia de férias sem flag manual e sem horas registradas: **sem impacto** em `totalFaltante`/`totalFaltas` (mesmo tratamento que Folga já tem). Com flag manual ou horas registradas: cálculo não muda, badge aparece do mesmo jeito como alerta informativo.
- Férias **não** entram na contagem de desconto de VA/VT do modal de aviso existente (`_calcularDiasDescontoVAVT`) — permanece só Falta/Atestado.
- Sem tela de consulta/exclusão manual dos registros de férias nesta v1 — só upload + resumo pós-importação.
- **IMPORTANTE:** os números de linha citados abaixo refletem o estado dos arquivos no momento em que este plano foi escrito. Use sempre o bloco de código exato (`old_string`/trecho a localizar) para achar o ponto de edição — não confie apenas no número da linha.
- Spec completo: `Projeto RH/docs/superpowers/specs/2026-07-08-ferias-calculadas-folha-ponto-design.md`.

---

## Arquivos Impactados

- Create: `Projeto RH/ferias-parser.js` — módulo puro (reconstrução de linhas + parsing de registros), sem dependência de DOM/Supabase/PDF.js. Dual-compatível: funciona como `<script>` global no navegador e via `require()` em Node (para os testes).
- Create: `Projeto RH/test-ferias-parser.js` — testes automatizados (Node, `node:assert`, sem framework) do módulo acima, usando linhas reais extraídas do PDF de exemplo como fixture.
- Modify: `Projeto RH/schema_rh.sql` — nova tabela `rh_ferias_calculadas` + RLS.
- Modify: `Projeto RH/index.html` — scripts PDF.js (CDN) e `ferias-parser.js`; novo item de sidebar; tela `feriasScreen` (upload + resumo).
- Modify: `Projeto RH/script.js` — `state.feriasCalculadas`; `carregarFeriasCalculadas`; `_dataEmFerias`; handler de upload/parse/upsert do PDF; integração em `calcularFolha`; badges nas telas de edição/resultados/export Excel; hooks em `selecionarEmpresa` (fluxo único) e `processarLoteGrupo`/`_carregarProximaEmpresaFila` (fluxo de lote de grupo).

---

## Task 1: Tabela `rh_ferias_calculadas` no schema

**Files:**
- Modify: `Projeto RH/schema_rh.sql`

### Passos

- [ ] **Step 1: Adicionar a nova tabela ao final do schema**

Em `schema_rh.sql`, localizar o final do arquivo (últimas linhas, bloco de comentário do diagrama de dependências que termina em `rh_rubricas`). Adicionar, ao final do arquivo:

```sql

-- ============================================================
-- N. TABELA: rh_ferias_calculadas
--    Períodos de férias por empregado, importados do PDF
--    "Relação de Férias Calculadas" do sistema fonte.
--    Upsert por (codigo_empresa, codigo_empregado, ferias_inicio).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_ferias_calculadas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    codigo_empregado  TEXT NOT NULL,
    nome_empregado    TEXT NOT NULL,
    ferias_inicio     DATE NOT NULL,
    ferias_fim        DATE NOT NULL,
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rh_ferias_calc_uniq UNIQUE (codigo_empresa, codigo_empregado, ferias_inicio)
);

CREATE INDEX IF NOT EXISTS idx_rh_ferias_empresa_empregado
    ON public.rh_ferias_calculadas (codigo_empresa, codigo_empregado);

ALTER TABLE public.rh_ferias_calculadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_ferias_calculadas: leitura autenticado"
    ON public.rh_ferias_calculadas FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_ferias_calculadas: escrita autenticado"
    ON public.rh_ferias_calculadas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/schema_rh.sql"
git commit -m "feat: adiciona tabela rh_ferias_calculadas ao schema"
```

**Nota para o operador:** este `CREATE TABLE` precisa ser executado manualmente no SQL Editor do Supabase (mesmo projeto do restante do módulo RH — URL em `supabase-config.js`) antes da funcionalidade funcionar de ponta a ponta. O código de importação/leitura assume que a tabela já existe.

---

## Task 2: Módulo puro de parsing do PDF (`ferias-parser.js`) com testes automatizados

**Files:**
- Create: `Projeto RH/ferias-parser.js`
- Create: `Projeto RH/test-ferias-parser.js`

**Interfaces:**
- Produces: `_reconstruirLinhasPagina(items)` — `items`: array de `{ str: string, transform: number[] }` (formato de `pdfTextContent.items` do PDF.js); retorna `string[]` (linhas visuais reconstruídas, uma por posição vertical).
- Produces: `_dataBRparaISO(dataBR)` — `dataBR`: string `"DD/MM/AAAA"`; retorna string `"AAAA-MM-DD"`.
- Produces: `_parsearLinhasFerias(linhas)` — `linhas`: `string[]` (saída de `_reconstruirLinhasPagina`, todas as páginas concatenadas em ordem); retorna `{ registros: Array<{codigo_empresa, nome_empresa, codigo_empregado, nome_empregado, ferias_inicio, ferias_fim}>, avisos: Array<{linha: string, motivo: string}> }`.
- Consumes: nada (módulo puro, sem dependências).

### Passos

- [ ] **Step 1: Escrever o arquivo do módulo**

Create `Projeto RH/ferias-parser.js`:

```js
/**
 * Parsing do PDF "Relação de Férias Calculadas".
 * Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona como
 * <script> global no navegador (funções ficam em `window`/global
 * implícito) e via require() em Node (para os testes).
 */

function _reconstruirLinhasPagina(items) {
    const validos = (items || []).filter(it => it && it.str && it.str.length > 0);
    if (validos.length === 0) return [];

    const ordenadosPorY = validos.slice().sort((a, b) => b.transform[5] - a.transform[5]);
    const LIMIAR_Y = 1.0;

    const grupos = [];
    let grupoAtual = null;
    let anchorY = null;
    for (const item of ordenadosPorY) {
        const y = item.transform[5];
        if (grupoAtual === null || Math.abs(y - anchorY) > LIMIAR_Y) {
            grupoAtual = [];
            grupos.push(grupoAtual);
            anchorY = y;
        }
        grupoAtual.push(item);
    }

    return grupos
        .map(g => g.slice()
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map(it => it.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim())
        .filter(linha => linha.length > 0);
}

function _dataBRparaISO(dataBR) {
    const [d, m, a] = dataBR.split('/');
    return `${a}-${m}-${d}`;
}

const _RE_DATA = /\d{2}\/\d{2}\/\d{4}/g;
const _RE_EMPRESA = /^Empresa:\s*(\d+)\s*-\s*(.+)$/;
const _RE_IGNORAR = /^(Total da empresa:|Página:|Emissão:|Hora:|CNPJ:|Código|Nome do empregado|Início|Fim|Sistema licenciado|RELAÇÃO DE FÉRIAS|no período de)/;
const _RE_PRIMEIRA_LINHA = /^(\d+)\s+([^\d].*?)\s+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}\/\d{2}\/\d{4}){1,2})\s+[\d.,\s]+$/;
const _RE_LINHA_FIM = /^\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}\/\d{2}\/\d{4}){0,2}\s*[\d.,\s]*$/;

function _parsearLinhasFerias(linhas) {
    const registros = [];
    const avisos = [];
    let empresaAtual = null;
    let pendente = null;

    for (const linha of (linhas || [])) {
        const mEmpresa = linha.match(_RE_EMPRESA);
        if (mEmpresa) {
            if (pendente) {
                avisos.push({ linha: `${pendente.codigo_empregado} ${pendente.nome_empregado}`, motivo: 'Linha de fim não encontrada antes do próximo cabeçalho de empresa' });
            }
            empresaAtual = { codigo: mEmpresa[1].trim(), nome: mEmpresa[2].trim() };
            pendente = null;
            continue;
        }

        if (_RE_IGNORAR.test(linha)) {
            continue;
        }

        const mPrimeira = linha.match(_RE_PRIMEIRA_LINHA);
        if (mPrimeira) {
            if (pendente) {
                avisos.push({ linha: `${pendente.codigo_empregado} ${pendente.nome_empregado}`, motivo: 'Linha de fim não encontrada antes do próximo registro' });
            }
            if (!empresaAtual) {
                avisos.push({ linha, motivo: 'Registro de empregado antes de qualquer cabeçalho de empresa' });
                pendente = null;
                continue;
            }
            const datas = linha.match(_RE_DATA) || [];
            if (datas.length < 2) {
                avisos.push({ linha, motivo: 'Menos de 2 datas na linha de início' });
                pendente = null;
                continue;
            }
            pendente = {
                codigo_empregado: mPrimeira[1].trim(),
                nome_empregado: mPrimeira[2].trim(),
                feriasInicioISO: _dataBRparaISO(datas[1]),
                qtdDatas: datas.length
            };
            continue;
        }

        if (pendente && _RE_LINHA_FIM.test(linha)) {
            const datas = linha.match(_RE_DATA) || [];
            if (datas.length !== pendente.qtdDatas) {
                avisos.push({ linha, motivo: `Linha de fim com ${datas.length} data(s), esperado ${pendente.qtdDatas}` });
                pendente = null;
                continue;
            }
            registros.push({
                codigo_empresa: empresaAtual.codigo,
                nome_empresa: empresaAtual.nome,
                codigo_empregado: pendente.codigo_empregado,
                nome_empregado: pendente.nome_empregado,
                ferias_inicio: pendente.feriasInicioISO,
                ferias_fim: _dataBRparaISO(datas[1])
            });
            pendente = null;
            continue;
        }
    }

    if (pendente) {
        avisos.push({ linha: `${pendente.codigo_empregado} ${pendente.nome_empregado}`, motivo: 'Linha de fim não encontrada até o fim do documento' });
    }

    return { registros, avisos };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _reconstruirLinhasPagina, _dataBRparaISO, _parsearLinhasFerias };
}
```

- [ ] **Step 2: Escrever os testes automatizados**

Create `Projeto RH/test-ferias-parser.js`:

```js
const assert = require('node:assert');
const { _reconstruirLinhasPagina, _dataBRparaISO, _parsearLinhasFerias } = require('./ferias-parser.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// ===== _dataBRparaISO =====

teste('_dataBRparaISO converte DD/MM/AAAA para AAAA-MM-DD', () => {
    assert.strictEqual(_dataBRparaISO('16/07/2026'), '2026-07-16');
});

// ===== _reconstruirLinhasPagina =====

teste('_reconstruirLinhasPagina agrupa itens de mesmo y exato em uma linha, ordenados por x', () => {
    const items = [
        { str: 'SILVA', transform: [1, 0, 0, 1, 29.2, 718.4] },
        { str: '9', transform: [1, 0, 0, 1, 23.6, 718.4] },
        { str: '25/04/2025', transform: [1, 0, 0, 1, 167.0, 718.4] }
    ];
    const linhas = _reconstruirLinhasPagina(items);
    assert.deepStrictEqual(linhas, ['9 SILVA 25/04/2025']);
});

teste('_reconstruirLinhasPagina mantém separadas linhas cujo y difere mais que o limiar (rótulo/valor desalinhados)', () => {
    // Caso real do PDF: "Empresa:"/valor (y=833.2) vs "Página:"/valor (y=834.7) — 1.5pt de diferença.
    const items = [
        { str: 'Empresa:', transform: [1, 0, 0, 1, 0.7, 833.2] },
        { str: '2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA', transform: [1, 0, 0, 1, 38.2, 833.2] },
        { str: 'Página:', transform: [1, 0, 0, 1, 501.7, 834.7] },
        { str: '1/1', transform: [1, 0, 0, 1, 562.6, 834.7] }
    ];
    const linhas = _reconstruirLinhasPagina(items);
    assert.deepStrictEqual(linhas, [
        'Página: 1/1',
        'Empresa: 2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA'
    ]);
});

teste('_reconstruirLinhasPagina ignora itens com str vazio', () => {
    const items = [
        { str: '', transform: [1, 0, 0, 1, 0, 100] },
        { str: 'Total da empresa:', transform: [1, 0, 0, 1, 29.2, 100] }
    ];
    assert.deepStrictEqual(_reconstruirLinhasPagina(items), ['Total da empresa:']);
});

// ===== _parsearLinhasFerias =====

teste('_parsearLinhasFerias extrai um registro simples (2 datas, sem abono) — página 1 real do PDF de exemplo', () => {
    const linhas = [
        'Empresa: 2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA',
        'CNPJ: 10.912.505/0001-86',
        'Código Nome do empregado Aquisitivo Ferias Abono Vlor.Ferias Abo.Pecun. 1/3 Fer./Abono 13o.Adiant Outros Prov. Total Prov.',
        'Início Início Início Desc.Prev. Desc. IRRF Outros Desc. Líq. Férias',
        'Fim Fim Fim',
        '9 LUIZ FELIPE LUCENA SILVA 25/04/2025 16/07/2026 784,35 0,00 261,45 0,00 0,00 1.045,80',
        '24/04/2026 30/07/2026 78,43 0,00 0,00 967,37',
        'Total da empresa: 784,35 0,00 261,45 0,00 0,00 1.045,80',
        '78,43 0,00 0,00 967,37',
        'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
    ];
    const { registros, avisos } = _parsearLinhasFerias(linhas);
    assert.deepStrictEqual(avisos, []);
    assert.deepStrictEqual(registros, [{
        codigo_empresa: '2',
        nome_empresa: 'CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA',
        codigo_empregado: '9',
        nome_empregado: 'LUIZ FELIPE LUCENA SILVA',
        ferias_inicio: '2026-07-16',
        ferias_fim: '2026-07-30'
    }]);
});

teste('_parsearLinhasFerias extrai múltiplos empregados, com e sem Abono (3 datas) — página 8 real do PDF de exemplo', () => {
    const linhas = [
        'Empresa: 63 - AGUAS CLARAS COMERCIO DE SORVETES LTDA',
        'CNPJ: 51.149.684/0001-29',
        'Código Nome do empregado Aquisitivo Ferias Abono Vlor.Ferias Abo.Pecun. 1/3 Fer./Abono 13o.Adiant Outros Prov. Total Prov.',
        'Início Início Início Desc.Prev. Desc. IRRF Outros Desc. Líq. Férias',
        'Fim Fim Fim',
        '8 LETICIA DA SILVA CARVALHO 23/05/2025 08/07/2026 1.402,43 0,00 467,48 0,00 0,00 1.869,91',
        '22/05/2026 27/07/2026 0,00 143,97 0,00 1.725,94',
        '22 GABRIEL WILLIAN DE SOUZA ALVES 01/04/2025 11/06/2026 01/07/2026 1.427,28 690,64 705,97 0,00 0,00 2.823,89',
        '31/03/2026 30/06/2026 10/07/2026 146,95 0,00 402,37 2.274,57',
        '24 NATALIA CONCEICAO SILVA 14/06/2025 14/07/2026 03/08/2026 1.246,28 623,15 623,15 0,00 0,00 2.492,58',
        '13/06/2026 02/08/2026 12/08/2026 125,23 0,00 448,96 1.918,39',
        'Total da empresa: 4.075,99 1.313,79 1.796,60 0,00 0,00 7.186,38',
        '416,15 0,00 851,33 5.918,90',
        'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
    ];
    const { registros, avisos } = _parsearLinhasFerias(linhas);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(registros.length, 3);
    assert.deepStrictEqual(registros[0], {
        codigo_empresa: '63',
        nome_empresa: 'AGUAS CLARAS COMERCIO DE SORVETES LTDA',
        codigo_empregado: '8',
        nome_empregado: 'LETICIA DA SILVA CARVALHO',
        ferias_inicio: '2026-07-08',
        ferias_fim: '2026-07-27'
    });
    assert.deepStrictEqual(registros[1], {
        codigo_empresa: '63',
        nome_empresa: 'AGUAS CLARAS COMERCIO DE SORVETES LTDA',
        codigo_empregado: '22',
        nome_empregado: 'GABRIEL WILLIAN DE SOUZA ALVES',
        ferias_inicio: '2026-06-11',
        ferias_fim: '2026-06-30'
    });
    assert.deepStrictEqual(registros[2], {
        codigo_empresa: '63',
        nome_empresa: 'AGUAS CLARAS COMERCIO DE SORVETES LTDA',
        codigo_empregado: '24',
        nome_empregado: 'NATALIA CONCEICAO SILVA',
        ferias_inicio: '2026-07-14',
        ferias_fim: '2026-08-02'
    });
});

teste('_parsearLinhasFerias reporta aviso quando a linha de fim não aparece antes do próximo registro', () => {
    const linhas = [
        'Empresa: 5 - EMPRESA TESTE LTDA',
        '10 FULANO DE TAL 01/01/2025 01/07/2026 100,00 0,00 33,00 0,00 0,00 133,00',
        '11 CICLANO DA SILVA 01/01/2025 01/08/2026 100,00 0,00 33,00 0,00 0,00 133,00',
        '31/12/2025 15/08/2026 10,00 0,00 0,00 123,00'
    ];
    const { registros, avisos } = _parsearLinhasFerias(linhas);
    assert.strictEqual(registros.length, 1);
    assert.strictEqual(registros[0].codigo_empregado, '11');
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /Linha de fim não encontrada/);
});

teste('_parsearLinhasFerias reporta aviso quando não há empresa aberta para o registro', () => {
    const linhas = [
        '10 FULANO DE TAL 01/01/2025 01/07/2026 100,00 0,00 33,00 0,00 0,00 133,00',
        '31/12/2025 15/07/2026 10,00 0,00 0,00 123,00'
    ];
    const { registros, avisos } = _parsearLinhasFerias(linhas);
    assert.strictEqual(registros.length, 0);
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /antes de qualquer cabeçalho de empresa/);
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
```

- [ ] **Step 3: Rodar os testes e confirmar que todos passam**

Run: `node "Projeto RH/test-ferias-parser.js"`

Expected: cada linha `OK  <nome do teste>` impressa sem erro, terminando em `7 teste(s) passaram.` (sem stack trace/exceção).

Se algum teste falhar, o `assert` lança uma exceção com o valor esperado vs. recebido — ajustar `ferias-parser.js` até todos passarem antes de prosseguir.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/ferias-parser.js" "Projeto RH/test-ferias-parser.js"
git commit -m "feat: parser puro do PDF de férias calculadas com testes automatizados"
```

---

## Task 3: Dependências (PDF.js) e tela de upload em `index.html`

**Files:**
- Modify: `Projeto RH/index.html`

### Passos

- [ ] **Step 1: Adicionar os scripts do PDF.js e do módulo de parsing**

Em `index.html`, localizar (linha ~17-18):
```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```
Substituir por:
```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script src="ferias-parser.js"></script>
```

- [ ] **Step 2: Novo item na sidebar**

Localizar (linha ~50-52):
```html
        <button class="sidebar-item" onclick="mostrarTela('gruposScreen')">
            <span class="sidebar-item-icon">👥</span> Grupos de Empresas
        </button>
    </nav>
```
Substituir por:
```html
        <button class="sidebar-item" onclick="mostrarTela('gruposScreen')">
            <span class="sidebar-item-icon">👥</span> Grupos de Empresas
        </button>
        <button class="sidebar-item" onclick="mostrarTela('feriasScreen')">
            <span class="sidebar-item-icon">🏖️</span> Importar Férias
        </button>
    </nav>
```

- [ ] **Step 3: Tela `feriasScreen`**

Localizar (linha ~243-256, bloco `gruposScreen` completo até o fechamento antes de `</div><!-- /main-content -->`... na verdade localizar especificamente o fechamento da div de `gruposScreen`):
```html
        <!-- TELA DE GRUPOS DE EMPRESAS -->
        <div id="gruposScreen" style="display: none;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px;">
                <h2 style="color: var(--primary-color); margin:0;">👥 Grupos de Empresas</h2>
                <button type="button" class="btn btn-primary btn-small" onclick="novoGrupo()">➕ Novo Grupo</button>
            </div>
            <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;">
                <div style="flex: 0 0 260px; border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
                    <div id="listaGrupos"></div>
                </div>
                <div style="flex: 1 1 420px; border:1px solid var(--border-color); border-radius:8px; padding:16px;" id="grupoDetalhe">
                    <p style="color: var(--text-secondary); font-size:13px;">Selecione um grupo à esquerda ou clique em "Novo Grupo".</p>
                </div>
            </div>
        </div>

    </div>

</div><!-- /main-content -->
```
Substituir por:
```html
        <!-- TELA DE GRUPOS DE EMPRESAS -->
        <div id="gruposScreen" style="display: none;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px;">
                <h2 style="color: var(--primary-color); margin:0;">👥 Grupos de Empresas</h2>
                <button type="button" class="btn btn-primary btn-small" onclick="novoGrupo()">➕ Novo Grupo</button>
            </div>
            <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;">
                <div style="flex: 0 0 260px; border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
                    <div id="listaGrupos"></div>
                </div>
                <div style="flex: 1 1 420px; border:1px solid var(--border-color); border-radius:8px; padding:16px;" id="grupoDetalhe">
                    <p style="color: var(--text-secondary); font-size:13px;">Selecione um grupo à esquerda ou clique em "Novo Grupo".</p>
                </div>
            </div>
        </div>

        <!-- TELA DE IMPORTAÇÃO DE FÉRIAS CALCULADAS -->
        <div id="feriasScreen" style="display: none;">
            <div style="margin-bottom:20px;">
                <h2 style="color: var(--primary-color); margin:0;">🏖️ Importar Férias Calculadas</h2>
                <p style="color: var(--text-secondary); font-size:13px; margin-top:6px;">
                    Envie o PDF "Relação de Férias Calculadas" (todas as empresas). Os períodos de férias
                    encontrados ficam disponíveis automaticamente na Folha de Ponto de qualquer empresa/competência.
                </p>
            </div>
            <div style="border:1px solid var(--border-color); border-radius:8px; padding:16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <label for="feriasArquivoPdf" class="btn btn-secondary" style="cursor:pointer; margin:0;">📎 Selecionar arquivo PDF</label>
                <input type="file" id="feriasArquivoPdf" accept=".pdf" style="display:none">
                <span id="feriasArquivoNome" style="font-size:13px; color: var(--text-secondary);">Nenhum arquivo selecionado.</span>
                <button type="button" class="btn btn-primary" id="feriasProcessarBtn" disabled>📥 Processar PDF</button>
            </div>
            <div id="feriasResumoContainer" style="margin-top:20px;"></div>
        </div>

    </div>

</div><!-- /main-content -->
```

- [ ] **Step 4: Incluir `feriasScreen` no controle de visibilidade de telas**

Localizar em `script.js` (linha ~3150-3156):
```js
function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('gruposScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';
    if (telaId === 'gruposScreen') carregarGrupos();
```
Substituir por:
```js
function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('gruposScreen').style.display = 'none';
    document.getElementById('feriasScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';
    if (telaId === 'gruposScreen') carregarGrupos();
```

Localizar logo abaixo, na mesma função (linha ~3158-3159):
```js
    const pageHeader = document.getElementById('pageHeader');
    if (pageHeader) pageHeader.style.display = (telaId === 'selectionScreen' || telaId === 'gruposScreen') ? 'none' : 'block';
```
Substituir por:
```js
    const pageHeader = document.getElementById('pageHeader');
    if (pageHeader) pageHeader.style.display = (telaId === 'selectionScreen' || telaId === 'gruposScreen' || telaId === 'feriasScreen') ? 'none' : 'block';
```

Localizar, um pouco abaixo (linha ~3163):
```js
        if (telaId !== 'selectionScreen' && telaId !== 'gruposScreen' && state.empresaSelecionada) {
```
Substituir por:
```js
        if (telaId !== 'selectionScreen' && telaId !== 'gruposScreen' && telaId !== 'feriasScreen' && state.empresaSelecionada) {
```

Localizar, mais abaixo (linha ~3171-3174):
```js
    if (telaId === 'gruposScreen') {
        const obsBanner = document.getElementById('empresaObservacoesBanner');
        if (obsBanner) obsBanner.style.display = 'none';
    }
```
Substituir por:
```js
    if (telaId === 'gruposScreen' || telaId === 'feriasScreen') {
        const obsBanner = document.getElementById('empresaObservacoesBanner');
        if (obsBanner) obsBanner.style.display = 'none';
    }
```

- [ ] **Step 5: Verificação manual**

Abrir `Projeto RH/index.html` no navegador (com o Supabase configurado). Clicar em "🏖️ Importar Férias" na sidebar — confirmar que a tela aparece, com o botão "📥 Processar PDF" desabilitado, sem cabeçalho de página nem banner de observações, e que as demais telas (Folha de Ponto, Grupos de Empresas) continuam funcionando normalmente.

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: tela de importação de férias calculadas (upload de PDF)"
```

---

## Task 4: Upload, parsing (via PDF.js) e upsert em lote no Supabase

**Files:**
- Modify: `Projeto RH/script.js`

**Interfaces:**
- Consumes: `_reconstruirLinhasPagina(items)`, `_parsearLinhasFerias(linhas)` de `ferias-parser.js` (Task 2), globais no navegador via `<script>`.
- Produces: `state.feriasCalculadas` (mapa `codigo_empregado → [{inicio, fim}]`, inicializado vazio), `carregarFeriasCalculadas(codigoEmpresa)` (usado nas Tasks 5 e 6).

### Passos

- [ ] **Step 1: Adicionar `feriasCalculadas` ao estado global**

Em `script.js`, localizar (linha ~11-28):
```js
const state = {
    empresas: [],
    empregadosDisponiveis: [],
    empresaSelecionada: null,
    competencia: '',
    folhas: [], // Array de objetos: { empregadoId, nome, dados: [], dsrDias: [], flagsFolga: {} }
    abaAtivaIndex: 0,
    feriados: [],
    jornada: '08:00',
    jornadaSexta: '04:00',
    jornadaSextaAtiva: false,
    jornadaSabado: '04:00',
    jornadaSabadoAtiva: false,
    sabadoSempreExtra: false,
    ruleExtra100Optional: false,
    terceiroTurno: false,
    resultados: []
};
```
Substituir por:
```js
const state = {
    empresas: [],
    empregadosDisponiveis: [],
    empresaSelecionada: null,
    competencia: '',
    folhas: [], // Array de objetos: { empregadoId, nome, dados: [], dsrDias: [], flagsFolga: {} }
    abaAtivaIndex: 0,
    feriados: [],
    jornada: '08:00',
    jornadaSexta: '04:00',
    jornadaSextaAtiva: false,
    jornadaSabado: '04:00',
    jornadaSabadoAtiva: false,
    sabadoSempreExtra: false,
    ruleExtra100Optional: false,
    terceiroTurno: false,
    resultados: [],
    feriasCalculadas: {} // codigo_empregado -> [{ inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD' }, ...]
};
```

- [ ] **Step 2: Configurar o worker do PDF.js na inicialização**

Localizar (linha ~55-56):
```js
    await carregarEmpresas();
    await carregarFeriadosGlobais();
```
Substituir por:
```js
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    await carregarEmpresas();
    await carregarFeriadosGlobais();
```

- [ ] **Step 3: Função de carregamento por empresa (`carregarFeriasCalculadas`)**

Localizar a função `carregarEmpregados` (linha ~205-218):
```js
async function carregarEmpregados(codigoEmpresa) {
    try {
        const { data, error } = await supabaseClient
            .from('rh_empregados')
            .select('codigo_empregado, nome_empregado')
            .eq('codigo_empresa', codigoEmpresa)
            .order('nome_empregado', { ascending: true });
        if (error) throw error;
        state.empregadosDisponiveis = data || [];
    } catch (erro) {
        console.error('Erro ao carregar empregados:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar a lista de empregados.');
    }
}
```
Substituir por:
```js
async function carregarEmpregados(codigoEmpresa) {
    try {
        const { data, error } = await supabaseClient
            .from('rh_empregados')
            .select('codigo_empregado, nome_empregado')
            .eq('codigo_empresa', codigoEmpresa)
            .order('nome_empregado', { ascending: true });
        if (error) throw error;
        state.empregadosDisponiveis = data || [];
    } catch (erro) {
        console.error('Erro ao carregar empregados:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar a lista de empregados.');
    }
}

// ✅ Mapa codigo_empregado -> períodos de férias, para exibição na Folha de Ponto
async function carregarFeriasCalculadas(codigoEmpresa) {
    try {
        const { data, error } = await supabaseClient
            .from('rh_ferias_calculadas')
            .select('codigo_empregado, ferias_inicio, ferias_fim')
            .eq('codigo_empresa', codigoEmpresa);
        if (error) throw error;
        const mapa = {};
        (data || []).forEach(r => {
            if (!mapa[r.codigo_empregado]) mapa[r.codigo_empregado] = [];
            mapa[r.codigo_empregado].push({ inicio: r.ferias_inicio, fim: r.ferias_fim });
        });
        return mapa;
    } catch (erro) {
        console.error('Erro ao carregar férias calculadas:', erro);
        return {};
    }
}
```

Nota: a função retorna o mapa (em vez de gravar direto em `state.feriasCalculadas`) para poder ser reaproveitada tanto no fluxo único (Task 5, grava direto em `state.feriasCalculadas`) quanto no fluxo de lote de grupo (Task 6, guarda por item da fila antes de aplicar ao `state`).

- [ ] **Step 4: Handler de seleção de arquivo e habilitação do botão**

No final de `inicializarEventos()` (localizar o fechamento da função, linha ~263-269):
```js
    document.getElementById('importarExcelInput').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importarExcel(e.target.files[0]);
            e.target.value = '';
        }
    });
}
```
Substituir por:
```js
    document.getElementById('importarExcelInput').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importarExcel(e.target.files[0]);
            e.target.value = '';
        }
    });

    document.getElementById('feriasArquivoPdf').addEventListener('change', (e) => {
        const file = e.target.files[0];
        const nomeSpan = document.getElementById('feriasArquivoNome');
        const btn = document.getElementById('feriasProcessarBtn');
        if (file) {
            nomeSpan.textContent = file.name;
            btn.disabled = false;
        } else {
            nomeSpan.textContent = 'Nenhum arquivo selecionado.';
            btn.disabled = true;
        }
    });
    document.getElementById('feriasProcessarBtn').addEventListener('click', () => {
        const file = document.getElementById('feriasArquivoPdf').files[0];
        if (file) processarPdfFerias(file);
    });
}
```

- [ ] **Step 5: Função principal de processamento do PDF**

Adicionar ao final de `script.js` (após a última função do arquivo — usar o mesmo padrão de funções `async function nome(...) { ... }` já usado em todo o arquivo):

```js
// ===== IMPORTAÇÃO DE FÉRIAS CALCULADAS (PDF) =====

async function processarPdfFerias(file) {
    const btn = document.getElementById('feriasProcessarBtn');
    btn.disabled = true;
    mostrarMensagem('Processando', 'Lendo o PDF de férias calculadas...');
    try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        let todasLinhas = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            todasLinhas = todasLinhas.concat(_reconstruirLinhasPagina(content.items));
        }

        const { registros, avisos } = _parsearLinhasFerias(todasLinhas);
        fecharModalMensagem();

        if (registros.length === 0) {
            mostrarMensagem('Aviso', 'Nenhum registro de férias foi reconhecido neste PDF.');
            btn.disabled = false;
            return;
        }

        await _salvarFeriasCalculadas(registros, avisos);
    } catch (erro) {
        console.error('Erro ao processar PDF de férias:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao processar o PDF. Verifique se o arquivo é válido.');
    } finally {
        btn.disabled = false;
    }
}

async function _salvarFeriasCalculadas(registros, avisos) {
    const codigosEmpresas = [...new Set(registros.map(r => r.codigo_empresa))];

    const { data: existentesData, error: errExistentes } = await supabaseClient
        .from('rh_ferias_calculadas')
        .select('codigo_empresa, codigo_empregado, ferias_inicio')
        .in('codigo_empresa', codigosEmpresas);
    if (errExistentes) {
        mostrarMensagem('Erro', 'Falha ao consultar registros existentes antes de salvar.');
        return;
    }
    const chavesExistentes = new Set(
        (existentesData || []).map(r => `${r.codigo_empresa}|${r.codigo_empregado}|${r.ferias_inicio}`)
    );

    const porEmpresa = {}; // codigo_empresa -> { nome, novos, atualizados }
    registros.forEach(r => {
        if (!porEmpresa[r.codigo_empresa]) {
            porEmpresa[r.codigo_empresa] = { nome: r.nome_empresa, novos: 0, atualizados: 0 };
        }
        const chave = `${r.codigo_empresa}|${r.codigo_empregado}|${r.ferias_inicio}`;
        if (chavesExistentes.has(chave)) {
            porEmpresa[r.codigo_empresa].atualizados++;
        } else {
            porEmpresa[r.codigo_empresa].novos++;
        }
    });

    const LOTE = 200;
    for (let i = 0; i < registros.length; i += LOTE) {
        const pedaco = registros.slice(i, i + LOTE);
        const { error } = await supabaseClient
            .from('rh_ferias_calculadas')
            .upsert(pedaco, { onConflict: 'codigo_empresa,codigo_empregado,ferias_inicio' });
        if (error) {
            console.error('Erro ao salvar férias calculadas:', error);
            mostrarMensagem('Erro', `Falha ao salvar registros no banco: ${error.message}`);
            return;
        }
    }

    _renderizarResumoImportacaoFerias(porEmpresa, avisos, registros.length);
}

function _renderizarResumoImportacaoFerias(porEmpresa, avisos, totalRegistros) {
    const container = document.getElementById('feriasResumoContainer');
    const totalNovos = Object.values(porEmpresa).reduce((s, e) => s + e.novos, 0);
    const totalAtualizados = Object.values(porEmpresa).reduce((s, e) => s + e.atualizados, 0);

    let html = `
        <div style="border:1px solid var(--border-color); border-radius:8px; padding:16px;">
            <p style="margin:0 0 10px; font-weight:600;">
                ✅ ${totalRegistros} registro(s) salvos (${totalNovos} novo(s), ${totalAtualizados} atualizado(s))
            </p>
    `;

    if (avisos.length > 0) {
        html += `
            <details style="margin:10px 0;">
                <summary style="cursor:pointer; color:#92400e; font-weight:600;">⚠️ ${avisos.length} linha(s) não reconhecida(s)</summary>
                <ul style="font-size:12px; color:#78350f; margin-top:8px;">
                    ${avisos.map(a => `<li><strong>${a.motivo}:</strong> ${a.linha}</li>`).join('')}
                </ul>
            </details>
        `;
    }

    html += `
            <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:10px;">
                <thead>
                    <tr style="background:var(--background-color); text-align:left;">
                        <th style="padding:8px; border-bottom:2px solid var(--border-color);">Empresa</th>
                        <th style="padding:8px; border-bottom:2px solid var(--border-color); text-align:center;">Novos</th>
                        <th style="padding:8px; border-bottom:2px solid var(--border-color); text-align:center;">Atualizados</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(porEmpresa).map(([codigo, info]) => `
                        <tr>
                            <td style="padding:8px; border-bottom:1px solid #eee;">${codigo} - ${info.nome}</td>
                            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${info.novos}</td>
                            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${info.atualizados}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}
```

- [ ] **Step 6: Verificação manual com o PDF de exemplo real**

No navegador, abrir "🏖️ Importar Férias", selecionar `Projeto RH/Relação de Férias Calculadas.pdf` (já presente no repositório) e clicar em "Processar PDF". Confirmar:
- A mensagem de "Processando" aparece e depois some.
- O resumo mostra um total de registros (esperado: 39 registros — contar manualmente as linhas de empregado nas 32 páginas do PDF de exemplo — ajustar essa expectativa ao rodar, o importante é que o número bata com a soma das linhas de empregado visíveis no PDF), todos como "novos" na primeira importação, zero avisos.
- A tabela por empresa lista todas as 32 empresas do PDF de exemplo.
- Reprocessar o mesmo PDF uma segunda vez: o resumo agora mostra os mesmos registros como "atualizados" (não duplicados).
- No Supabase (SQL Editor), `SELECT COUNT(*) FROM rh_ferias_calculadas;` bate com o total do resumo.

- [ ] **Step 7: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: processa e importa PDF de férias calculadas para o Supabase"
```

---

## Task 5: Cruzamento com a Folha de Ponto — cálculo e badges

**Files:**
- Modify: `Projeto RH/script.js`

**Interfaces:**
- Consumes: `state.feriasCalculadas` (Task 4), `carregarFeriasCalculadas` (Task 4).
- Produces: `_dataEmFerias(dataBR, empregadoId)`; campo `flagFerias` no objeto de dia retornado por `calcularFolha`.

### Passos

- [ ] **Step 1: Função utilitária de checagem de intervalo**

Localizar a função `gerarDiasDoMes` (linha ~3257) e adicionar logo **antes** dela:
```js
// ===== FÉRIAS CALCULADAS =====

function _dataEmFerias(dataBR, empregadoId) {
    const periodos = state.feriasCalculadas[empregadoId];
    if (!periodos || periodos.length === 0) return false;
    const [d, m, a] = dataBR.split('/');
    const iso = `${a}-${m}-${d}`;
    return periodos.some(p => iso >= p.inicio && iso <= p.fim);
}

function gerarDiasDoMes(competencia) {
```
(A linha `function gerarDiasDoMes(competencia) {` já existe — este passo só insere o novo bloco imediatamente acima dela, sem duplicar a declaração.)

- [ ] **Step 2: Calcular `flagFerias` em `calcularFolha` e usar no ramo "sem registro"**

Localizar em `calcularFolha` (linha ~1328-1330):
```js
        let extra50 = 0, extra100 = 0, faltante = 0;
        let flagDSR = isDSRCustomizado;
        let flagFolga = false, flagFalta = false, flagAtestado = false, flagAtestadoComparecimento = false, flagLiberacaoMeioExpediente = false, flagSemRegistro = false, flagCompensacao = false;
```
Substituir por:
```js
        let extra50 = 0, extra100 = 0, faltante = 0;
        let flagDSR = isDSRCustomizado;
        let flagFolga = false, flagFalta = false, flagAtestado = false, flagAtestadoComparecimento = false, flagLiberacaoMeioExpediente = false, flagSemRegistro = false, flagCompensacao = false;
        const flagFerias = _dataEmFerias(dia.data, folha.empregadoId);
```

Localizar (linha ~1384-1397):
```js
        } else if (!isDiaDescanso) {
            // atestados e liberação já tratados acima; aqui só dias sem horas e sem atestado
            if (flagFolgaData === 'folga') {
                flagFolga = true;
            } else if (flagFolgaData === 'falta') {
                flagFalta = true;
                totalFaltas += 1;
            } else if (flagFolgaData === 'compensacao') {
                flagCompensacao = true;
                faltante = jornadaEfetiva;
            } else if (!isAtestado) {
                flagSemRegistro = true;
            }
        }
```
Substituir por:
```js
        } else if (!isDiaDescanso) {
            // atestados e liberação já tratados acima; aqui só dias sem horas e sem atestado
            if (flagFolgaData === 'folga') {
                flagFolga = true;
            } else if (flagFolgaData === 'falta') {
                flagFalta = true;
                totalFaltas += 1;
            } else if (flagFolgaData === 'compensacao') {
                flagCompensacao = true;
                faltante = jornadaEfetiva;
            } else if (!isAtestado) {
                if (!flagFerias) {
                    flagSemRegistro = true;
                }
                // dia de férias sem flag manual: sem impacto em totais, mesmo tratamento de Folga
            }
        }
```

- [ ] **Step 3: Incluir `flagFerias` no objeto de retorno do dia**

Localizar (linha ~1428-1436):
```js
            isDiaDescanso: isDiaDescanso,
            flagDSR: flagDSR,
            flagFolga: flagFolga,
            flagFalta: flagFalta,
            flagAtestado: flagAtestado,
            flagAtestadoComparecimento: flagAtestadoComparecimento,
            flagLiberacaoMeioExpediente: flagLiberacaoMeioExpediente,
            flagSemRegistro: flagSemRegistro,
            flagCompensacao: flagCompensacao
        };
    });
```
Substituir por:
```js
            isDiaDescanso: isDiaDescanso,
            flagDSR: flagDSR,
            flagFolga: flagFolga,
            flagFalta: flagFalta,
            flagAtestado: flagAtestado,
            flagAtestadoComparecimento: flagAtestadoComparecimento,
            flagLiberacaoMeioExpediente: flagLiberacaoMeioExpediente,
            flagSemRegistro: flagSemRegistro,
            flagCompensacao: flagCompensacao,
            flagFerias: flagFerias
        };
    });
```

- [ ] **Step 4: Badge na tela de resultados/revisão**

Localizar (linha ~1673-1678):
```js
            if (dia.flagSemRegistro) {
                flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">SEM REGISTRO</span>';
            }
            if (isFeriado) {
                flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px;">FERIADO</span>';
            }
```
Substituir por:
```js
            if (dia.flagSemRegistro) {
                flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">SEM REGISTRO</span>';
            }
            if (dia.flagFerias) {
                flags += '<span style="background: #fde68a; color: #78350f; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">FÉRIAS</span>';
            }
            if (isFeriado) {
                flags += '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px;">FERIADO</span>';
            }
```

- [ ] **Step 5: Rótulo informativo na tela de edição (`renderizarConteudoAba`)**

Localizar (linha ~809-813):
```js
    folha.dados.forEach((dia, diaIndex) => {
        const isFeriado = state.feriados.some(f => f.data === dia.data || f.data === dia.data.substring(0, 5));
        const isDSR = folha.dsrDias.includes(dia.data);
        const rowClass = (isFeriado || isDSR) ? 'holiday-row' : '';
        const infoExtra = isFeriado ? `<span style="color: var(--danger-color); font-size: 11px; display: block;">Feriado</span>` : '';
```
Substituir por:
```js
    folha.dados.forEach((dia, diaIndex) => {
        const isFeriado = state.feriados.some(f => f.data === dia.data || f.data === dia.data.substring(0, 5));
        const isDSR = folha.dsrDias.includes(dia.data);
        const rowClass = (isFeriado || isDSR) ? 'holiday-row' : '';
        const isFerias = _dataEmFerias(dia.data, folha.empregadoId);
        const infoExtra = isFeriado
            ? `<span style="color: var(--danger-color); font-size: 11px; display: block;">Feriado</span>`
            : (isFerias ? `<span style="color: #b45309; font-size: 11px; display: block;">Férias</span>` : '');
```

- [ ] **Step 6: Incluir no export Excel**

Localizar (linha ~1751-1759):
```js
        let flagsStr = '';
        if (dia.flagDSR) flagsStr += 'DSR ';
        if (dia.flagFolga) flagsStr += 'FOLGA ';
        if (dia.flagFalta) flagsStr += 'FALTA ';
        if (dia.flagAtestado) flagsStr += 'ATESTADO MÉDICO ';
        if (dia.flagAtestadoComparecimento) flagsStr += 'ATESTADO DE COMPARECIMENTO ';
        if (dia.flagLiberacaoMeioExpediente) flagsStr += 'LIBERAÇÃO MEIO EXPEDIENTE ';
        if (dia.flagSemRegistro) flagsStr += 'SEM REGISTRO ';
        if (isFeriado) flagsStr += 'FERIADO ';
```
Substituir por:
```js
        let flagsStr = '';
        if (dia.flagDSR) flagsStr += 'DSR ';
        if (dia.flagFolga) flagsStr += 'FOLGA ';
        if (dia.flagFalta) flagsStr += 'FALTA ';
        if (dia.flagAtestado) flagsStr += 'ATESTADO MÉDICO ';
        if (dia.flagAtestadoComparecimento) flagsStr += 'ATESTADO DE COMPARECIMENTO ';
        if (dia.flagLiberacaoMeioExpediente) flagsStr += 'LIBERAÇÃO MEIO EXPEDIENTE ';
        if (dia.flagSemRegistro) flagsStr += 'SEM REGISTRO ';
        if (dia.flagFerias) flagsStr += 'FÉRIAS ';
        if (isFeriado) flagsStr += 'FERIADO ';
```

- [ ] **Step 7: Carregar férias no fluxo de seleção única de empresa**

Localizar a função `selecionarEmpresa` (linha ~169-185):
```js
async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    _aplicarConfigEmpresaNaTelaEdicao(cfg);
    const obsBanner     = document.getElementById('empresaObservacoesBanner');
    const obsTexto      = document.getElementById('empresaObservacoesTexto');
    const observacoes = cfg?.['observacoes']?.cod?.trim() || '';
    if (obsBanner && obsTexto) {
        obsTexto.textContent = observacoes;
        obsBanner.dataset.temObservacao = observacoes ? '1' : '0';
    }
    atualizarBannerObservacoes();
}
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
    _aplicarConfigEmpresaNaTelaEdicao(cfg);
    state.feriasCalculadas = await carregarFeriasCalculadas(codigo);
    const obsBanner     = document.getElementById('empresaObservacoesBanner');
    const obsTexto      = document.getElementById('empresaObservacoesTexto');
    const observacoes = cfg?.['observacoes']?.cod?.trim() || '';
    if (obsBanner && obsTexto) {
        obsTexto.textContent = observacoes;
        obsBanner.dataset.temObservacao = observacoes ? '1' : '0';
    }
    atualizarBannerObservacoes();
}
```

- [ ] **Step 8: Verificação manual**

No navegador, com o PDF de exemplo já importado (Task 4), abrir "📋 Folha de Ponto", competência `07/2026`, empresa `2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA`. Selecionar o empregado `9 - LUIZ FELIPE LUCENA SILVA` (ou criar a aba manualmente escolhendo-o). Confirmar:
- Na tela de edição, os dias entre `16/07/2026` e `30/07/2026` mostram o rótulo "Férias" abaixo da data.
- Clicar em "✅ Processar e Salvar Folha" e ir para a tela de Resultados: os mesmos dias mostram o badge amarelo "FÉRIAS".
- Esses dias **não** aparecem com badge "SEM REGISTRO", e a coluna "Faltante" mostra "-" para eles (sem impacto em horas faltantes).
- O totalizador de "Faltas" da folha não conta nenhum dia dentro do período de férias.
- Selecionar uma empresa/empregado **sem** férias importadas: nenhum rótulo/badge extra aparece, comportamento idêntico ao anterior à mudança.

- [ ] **Step 9: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: exibe badge FERIAS na Folha de Ponto a partir da base importada"
```

---

## Task 6: Integração com a fila de processamento em lote do grupo

**Files:**
- Modify: `Projeto RH/script.js`

**Interfaces:**
- Consumes: `carregarFeriasCalculadas(codigoEmpresa)` (Task 4).

### Passos

- [ ] **Step 1: Buscar férias calculadas junto com a config, por empresa, dentro do loop de preparo da fila**

Localizar em `processarLoteGrupo` (linha ~2409-2421):
```js
            const cfg = await _buscarConfigRubricas(codigo);
            const comTerceiroTurno = cfg?.['terceiro_turno']?.cod === '1';

            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
            const { folhas, avisosAbas } = _parseExcelParaFolhas(wb, empregados, comTerceiroTurno, comp);

            if (folhas.length === 0) {
                resultadosIniciais.push({ codigo, status: 'erro', detalhe: 'Nenhum empregado correspondente encontrado no arquivo.' });
                continue;
            }

            itensFila.push({ codigo_empresa: codigo, nome_empresa: nomesEmpresas[codigo] || codigo, folhas, avisosAbas, cfg });
```
Substituir por:
```js
            const cfg = await _buscarConfigRubricas(codigo);
            const comTerceiroTurno = cfg?.['terceiro_turno']?.cod === '1';
            const feriasCalculadas = await carregarFeriasCalculadas(codigo);

            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
            const { folhas, avisosAbas } = _parseExcelParaFolhas(wb, empregados, comTerceiroTurno, comp);

            if (folhas.length === 0) {
                resultadosIniciais.push({ codigo, status: 'erro', detalhe: 'Nenhum empregado correspondente encontrado no arquivo.' });
                continue;
            }

            itensFila.push({ codigo_empresa: codigo, nome_empresa: nomesEmpresas[codigo] || codigo, folhas, avisosAbas, cfg, feriasCalculadas });
```

- [ ] **Step 2: Aplicar `feriasCalculadas` ao `state` ao carregar cada empresa da fila**

Localizar `_carregarProximaEmpresaFila` (linha ~2454-2469):
```js
function _carregarProximaEmpresaFila() {
    const fila = _filaLoteGrupo;
    if (!fila) return;
    const item = fila.itens[fila.indice];

    state.empresaSelecionada = { codigo_empresa: item.codigo_empresa, nome_empresa: item.nome_empresa };
    state.competencia = fila.competencia;
    state.folhas = item.folhas;
    state.abaAtivaIndex = 0;
    state.resultados = [];

    _aplicarConfigEmpresaNaTelaEdicao(item.cfg);

    mostrarTela('mainScreen');
    renderizarAbas();
}
```
Substituir por:
```js
function _carregarProximaEmpresaFila() {
    const fila = _filaLoteGrupo;
    if (!fila) return;
    const item = fila.itens[fila.indice];

    state.empresaSelecionada = { codigo_empresa: item.codigo_empresa, nome_empresa: item.nome_empresa };
    state.competencia = fila.competencia;
    state.folhas = item.folhas;
    state.abaAtivaIndex = 0;
    state.resultados = [];
    state.feriasCalculadas = item.feriasCalculadas || {};

    _aplicarConfigEmpresaNaTelaEdicao(item.cfg);

    mostrarTela('mainScreen');
    renderizarAbas();
}
```

- [ ] **Step 3: Verificação manual**

Pré-requisito: um grupo de empresas já cadastrado (tela "👥 Grupos de Empresas") contendo a empresa `2` (do PDF de exemplo), e férias já importadas (Task 4). Gerar o modelo Excel para o grupo, preencher horários normalmente para o período (deixando os dias de férias do empregado `9` sem preenchimento, como já seria o caso real), e rodar "📤 Processar em Lote". Ao chegar a vez da empresa `2` na fila, confirmar que a tela de edição já mostra o rótulo "Férias" nos dias corretos do empregado `9`, do mesmo jeito que no fluxo manual (Task 5).

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: aplica ferias calculadas tambem na fila de processamento em lote do grupo"
```

---

## Task 7: Regressão final e push

Sem framework de testes automatizados de UI neste projeto — fechar o trabalho com uma rodada manual de regressão, além da suíte automatizada da Task 2.

- [ ] **Step 1:** Rodar novamente `node "Projeto RH/test-ferias-parser.js"` e confirmar que todos os testes continuam passando.
- [ ] **Step 2:** Repetir o fluxo completo ponta a ponta: importar o PDF de exemplo → processar a Folha de Ponto da empresa `2`, empregado `9`, competência `07/2026` → gerar TXT (`📄 Gerar TXT` na tela de Resultados) → confirmar que o modal de aviso de desconto de VA/VT (se aparecer) **não** conta os dias de férias do empregado `9` como falta/atestado (só contaria se ele também tivesse falta/atestado de verdade no período).
- [ ] **Step 3:** Confirmar que o fluxo de Folha de Ponto para uma empresa **sem** nenhuma férias importada continua idêntico ao comportamento anterior a esta mudança (sem badges/rótulos novos, sem erros no console do navegador).
- [ ] **Step 4:** Confirmar visualmente que a tela "🏖️ Importar Férias" não quebra o layout da sidebar nem das demais telas ao navegar entre elas repetidamente.
- [ ] **Step 5: Push**

```bash
git push
```

Reportar ao usuário: tabela nova (`rh_ferias_calculadas`) precisa ser criada manualmente no SQL Editor do Supabase antes do recurso funcionar em produção (Task 1) — o push do código não aplica migrações de banco.
