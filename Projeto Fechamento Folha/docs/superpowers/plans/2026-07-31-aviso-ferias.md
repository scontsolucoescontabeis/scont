# Aviso de Férias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova ferramenta "Aviso de Férias" no módulo Fechamento Folha que recebe o PDF de avisos de férias do cliente, separa por empregado/empresa e gera um PDF por empresa com identidade visual SCONT.

**Architecture:** Wizard client-side de 3 passos (`aviso-ferias.html` + `aviso-ferias.js`). Parsing puro e testável em Node (`aviso-ferias-parser.js`, sem DOM/pdf.js/Supabase) chamado pela camada de UI, que usa pdf.js para extrair texto posicionado, Supabase (`rh_empresas`) para resolver código de empresa por CNPJ, e pdf-lib para copiar/brandar as páginas originais em um PDF por empresa. JSZip agrupa os downloads.

**Tech Stack:** HTML/CSS/JS vanilla (sem bundler), pdf.js 3.11.174 (já usado em `ferias.html`), pdf-lib 1.17.1 (novo, via cdnjs), JSZip 3.10.1 (já usado em `Projeto RH/script.js`), Supabase JS v2, Node `node:assert` para testes do parser puro (mesmo padrão de `Projeto RH/test-ferias-parser.js`).

## Global Constraints

- Nenhuma tabela nova no Supabase — leitura apenas de `rh_empresas` (`codigo_empresa, nome_empresa, cnpj`).
- Nome de arquivo final: `{codigo_empresa}_AVISO DE FERIAS_{intervalo}.pdf` (intervalo = texto livre do usuário, sanitizado removendo `\ / : * ? " < > |`).
- PDFs individualizados só por empresa (não por empregado) — decisão já validada com o usuário.
- Resolução de empresa: casamento automático por CNPJ contra `rh_empresas`, com seleção manual obrigatória para os não encontrados antes de habilitar a geração.
- Cabeçalho/rodapé SCONT sobrepostos às páginas originais (não reconstrução do documento) — página final em A4 padrão (595.28 x 841.89 pt), conteúdo original embutido e escalado (~0.91x) entre as faixas, sem sobreposição.
- Seguir o padrão visual/estrutural de `ferias.html` (sidebar, steps-bar, upload-area) e o padrão de módulo puro testável de `Projeto RH/ferias-parser.js` + `test-ferias-parser.js`.

---

## Ground truth do PDF de exemplo (via pdf.js real, `Aviso Prévio de Férias.pdf`)

Confirmado rodando pdf.js contra o arquivo real (não é suposição). Com tolerância de agrupamento de linha `Y_TOL = 1.0` (igual ao `ferias-parser.js`), a página **aviso** reconstrói nesta ordem:

```
AVISO DE FÉRIAS
BRASILIA, 17 de Julho de 2026
Sr.: ERIC DOUGLAS RODRIGUES ABELAYR
C.T.P.S.: 0772939 Série: 411          <- opcional, pode não existir
Nos termos das disposições legais vigentes, suas férias serão concedidas conforme o
demonstrativo abaixo:
Período Aquisitivo...............: 17/06/2025 - 16/06/2026
Período de Gozo................: 17/08/2026 - 05/09/2026
Retorno ao trabalho............: 06/09/2026
A remuneração correspondente às férias, e se for o caso, ao abono pecuniário e ao
adiantamento da gratificação de natal encontra-se no caixa e poderá ser recebida em 14/08/2026.
Favor apresentar a sua Carteira de Trabalho e Previdência Social ao Departamento
de Pessoal para as anotações necessárias.
N DE QUEIROZ DROGARIA LTDA ERIC DOUGLAS RODRIGUES ABELAYR      <- linha de assinatura
```

Quando o nome da empresa não cabe numa linha (ex. ANANKE), a linha de assinatura vira 2 linhas, **nesta ordem** (a continuação vem DEPOIS da linha que contém o nome do empregado, nunca antes):

```
ANANKE-CENTRO DE ATENCAO A SAUDE GILVANETE LOURENCO DOS SANTOS
MENTAL LTDA
```
→ empresa correta = `"ANANKE-CENTRO DE ATENCAO A SAUDE" + " " + "MENTAL LTDA"` = `"ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL LTDA"`.

A página **abono** reconstrói assim:

```
SOLICITAÇÃO DE ABONO DE FÉRIAS
Empresa: N DE QUEIROZ DROGARIA LTDA CNPJ: 08.836.871/0001-51
Cadastro: 51 - ERIC DOUGLAS RODRIGUES ABELAYR CPF: 077.293.941-11
Em cumprimento ao disposto no parágrafo 1º do Artigo 143 do Decreto-Lei Nº 1.535 de 13 de Abril de 1977, venho pela
presente requerer a ABONO PECUNIÁRIO de 1/3 das férias, referente ao período aquisitivo de 17/06/2025 a 16/06/2026.
BRASILIA, 17 DE JULHO DE 2026
N DE QUEIROZ DROGARIA LTDA ERIC DOUGLAS RODRIGUES ABELAYR
```

Os campos `Empresa:`/`CNPJ:` e `Cadastro:`/`CPF:` sempre couberam numa única linha reconstruída nos exemplos reais (mesmo com nome de empresa longo, ex. ANANKE) — só a linha de assinatura no rodapé (fonte maior/coluna mais estreita) quebra.

---

## Task 1: Módulo puro de parsing (`aviso-ferias-parser.js`)

**Files:**
- Create: `Projeto Fechamento Folha/aviso-ferias-parser.js`
- Test: `Projeto Fechamento Folha/test-aviso-ferias-parser.js`

**Interfaces:**
- Produces (usado pela Task 4):
  - `_reconstruirLinhasPagina(items) -> string[]`
  - `_classificarTipoPagina(linhas) -> 'aviso' | 'abono' | null`
  - `_extrairDadosAviso(linhas) -> { nome_empregado, ctps, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, periodo_gozo_inicio, periodo_gozo_fim, retorno_trabalho, nome_empresa }`
  - `_extrairDadosAbono(linhas) -> { nome_empresa, cnpj, cadastro_codigo, nome_empregado, cpf }`
  - `_normalizarNome(s) -> string`
  - `_normalizarCNPJ(s) -> string`
  - `_montarRegistrosEmpregados(paginas) -> { registros, avisos }` onde `paginas: [{ numero, tipo, dados }]`
  - `_agruparPorEmpresa(registros) -> [{ chave, nome_empresa, cnpj, empregados: string[], paginas: number[] }]`
  - `_resolverCodigoEmpresa(cnpjNormalizado, mapaPorCnpj) -> { codigo_empresa, nome_empresa } | null`
  - `_sanitizarNomeArquivo(s) -> string`
  - `_montarNomeArquivo(codigo, intervalo) -> string`

- [ ] **Step 1: Escrever o arquivo com todas as funções puras**

```javascript
/**
 * Parsing do PDF "Aviso de Férias" (modelo: Aviso Prévio de Férias.pdf).
 * Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona como
 * <script> global no navegador e via require() em Node (para os testes).
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

const _RE_TITULO_AVISO = /AVISO\s+DE\s+F[EÉ]RIAS/i;
const _RE_TITULO_ABONO = /SOLICITA[ÇC][AÃ]O\s+DE\s+ABONO/i;

function _classificarTipoPagina(linhas) {
    const primeira = (linhas || []).find(l => l.trim().length > 0);
    if (!primeira) return null;
    if (_RE_TITULO_ABONO.test(primeira)) return 'abono';
    if (_RE_TITULO_AVISO.test(primeira)) return 'aviso';
    return null;
}

const _RE_SR_SRA = /^(?:Sr|Sra)\.?:\s*(.+)$/i;
const _RE_CTPS = /^C\.T\.P\.S\.:\s*(\S+)/i;
const _RE_PERIODO_AQUISITIVO = /Per[íi]odo\s+Aquisitivo\.*\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i;
const _RE_PERIODO_GOZO = /Per[íi]odo\s+de\s+Gozo\.*\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i;
const _RE_RETORNO = /Retorno\s+ao\s+trabalho\.*\s*:\s*(\d{2}\/\d{2}\/\d{4})/i;
const _RE_BOILERPLATE_FIM = /anota[çc][õo]es\s+necess[áa]rias\.?\s*$/i;

function _extrairNomeEmpresaAssinatura(linhas, idxBoilerplate, nomeEmpregado) {
    if (idxBoilerplate < 0 || !nomeEmpregado) return null;
    const bloco = linhas.slice(idxBoilerplate + 1).filter(l => l.trim().length > 0);
    if (bloco.length === 0) return null;

    const nomeUpper = nomeEmpregado.trim().toUpperCase();
    const idxLinhaComNome = bloco.findIndex(l => l.toUpperCase().includes(nomeUpper));
    if (idxLinhaComNome === -1) {
        return bloco.join(' ').replace(/\s+/g, ' ').trim();
    }

    const linhaComNome = bloco[idxLinhaComNome];
    const idxPos = linhaComNome.toUpperCase().indexOf(nomeUpper);
    const partePrefixo = linhaComNome.slice(0, idxPos).trim();
    const outrasLinhas = bloco.filter((_, i) => i !== idxLinhaComNome);

    return [partePrefixo, ...outrasLinhas]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function _extrairDadosAviso(linhas) {
    const dados = {
        nome_empregado: null, ctps: null,
        periodo_aquisitivo_inicio: null, periodo_aquisitivo_fim: null,
        periodo_gozo_inicio: null, periodo_gozo_fim: null,
        retorno_trabalho: null, nome_empresa: null
    };

    let idxBoilerplate = -1;
    (linhas || []).forEach((linha, idx) => {
        const mSr = linha.match(_RE_SR_SRA);
        if (mSr && !dados.nome_empregado) dados.nome_empregado = mSr[1].trim();

        const mCtps = linha.match(_RE_CTPS);
        if (mCtps) dados.ctps = mCtps[1].trim();

        const mAquis = linha.match(_RE_PERIODO_AQUISITIVO);
        if (mAquis) { dados.periodo_aquisitivo_inicio = mAquis[1]; dados.periodo_aquisitivo_fim = mAquis[2]; }

        const mGozo = linha.match(_RE_PERIODO_GOZO);
        if (mGozo) { dados.periodo_gozo_inicio = mGozo[1]; dados.periodo_gozo_fim = mGozo[2]; }

        const mRet = linha.match(_RE_RETORNO);
        if (mRet) dados.retorno_trabalho = mRet[1];

        if (_RE_BOILERPLATE_FIM.test(linha)) idxBoilerplate = idx;
    });

    dados.nome_empresa = _extrairNomeEmpresaAssinatura(linhas, idxBoilerplate, dados.nome_empregado);
    return dados;
}

const _RE_EMPRESA_CNPJ = /Empresa:\s*(.+?)\s*CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i;
const _RE_CADASTRO_CPF = /Cadastro:\s*(\d+)\s*-\s*(.+?)\s*CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})?/i;

function _extrairDadosAbono(linhas) {
    const dados = { nome_empresa: null, cnpj: null, cadastro_codigo: null, nome_empregado: null, cpf: null };

    for (const linha of (linhas || [])) {
        const mEmp = linha.match(_RE_EMPRESA_CNPJ);
        if (mEmp) { dados.nome_empresa = mEmp[1].trim(); dados.cnpj = mEmp[2].trim(); }

        const mCad = linha.match(_RE_CADASTRO_CPF);
        if (mCad) {
            dados.cadastro_codigo = mCad[1].trim();
            dados.nome_empregado = mCad[2].trim();
            dados.cpf = mCad[3] ? mCad[3].trim() : null;
        }
    }
    return dados;
}

function _normalizarNome(s) {
    return String(s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function _normalizarCNPJ(s) {
    return String(s || '').replace(/\D/g, '');
}

function _montarRegistrosEmpregados(paginas) {
    const registros = [];
    const avisos = [];
    let i = 0;
    const lista = paginas || [];

    while (i < lista.length) {
        const pg = lista[i];
        if (pg.tipo !== 'aviso') {
            avisos.push({ pagina: pg.numero, motivo: `Página ${pg.numero} não é do tipo "aviso" e não foi associada a nenhum registro anterior` });
            i++;
            continue;
        }

        const registro = {
            nome_empregado: pg.dados.nome_empregado,
            nome_empresa: pg.dados.nome_empresa,
            cnpj: null,
            paginas: [pg.numero]
        };

        const prox = lista[i + 1];
        if (prox && prox.tipo === 'abono' &&
            _normalizarNome(prox.dados.nome_empregado) === _normalizarNome(pg.dados.nome_empregado)) {
            registro.cnpj = _normalizarCNPJ(prox.dados.cnpj || '') || null;
            if (prox.dados.nome_empresa) registro.nome_empresa = prox.dados.nome_empresa;
            registro.paginas.push(prox.numero);
            i += 2;
        } else {
            i += 1;
        }

        registros.push(registro);
    }

    return { registros, avisos };
}

function _agruparPorEmpresa(registros) {
    const grupos = new Map();
    for (const r of (registros || [])) {
        const chave = r.cnpj ? r.cnpj : `NOME:${_normalizarNome(r.nome_empresa)}`;
        if (!grupos.has(chave)) {
            grupos.set(chave, { chave, nome_empresa: r.nome_empresa, cnpj: r.cnpj || null, empregados: [], paginas: [] });
        }
        const g = grupos.get(chave);
        g.empregados.push(r.nome_empregado);
        g.paginas.push(...r.paginas);
    }
    return Array.from(grupos.values());
}

function _resolverCodigoEmpresa(cnpjNormalizado, mapaPorCnpj) {
    if (!cnpjNormalizado || !mapaPorCnpj) return null;
    return mapaPorCnpj[cnpjNormalizado] || null;
}

function _sanitizarNomeArquivo(s) {
    return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim();
}

function _montarNomeArquivo(codigo, intervalo) {
    return `${codigo}_AVISO DE FERIAS_${_sanitizarNomeArquivo(intervalo)}.pdf`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _reconstruirLinhasPagina, _classificarTipoPagina,
        _extrairDadosAviso, _extrairDadosAbono,
        _normalizarNome, _normalizarCNPJ,
        _montarRegistrosEmpregados, _agruparPorEmpresa,
        _resolverCodigoEmpresa, _sanitizarNomeArquivo, _montarNomeArquivo
    };
}
```

- [ ] **Step 2: Escrever os testes (usando as linhas reconstruídas reais do PDF de exemplo, capturadas via pdf.js)**

```javascript
const assert = require('node:assert');
const {
    _reconstruirLinhasPagina, _classificarTipoPagina,
    _extrairDadosAviso, _extrairDadosAbono,
    _normalizarNome, _normalizarCNPJ,
    _montarRegistrosEmpregados, _agruparPorEmpresa,
    _resolverCodigoEmpresa, _sanitizarNomeArquivo, _montarNomeArquivo
} = require('./aviso-ferias-parser.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// ===== _reconstruirLinhasPagina =====

teste('_reconstruirLinhasPagina agrupa itens de mesmo y e ordena por x (linha "Cadastro:"/"CPF:" real)', () => {
    const items = [
        { str: 'CPF:', transform: [1, 0, 0, 1, 408.5, 700.9] },
        { str: '51 - ERIC DOUGLAS RODRIGUES ABELAYR', transform: [1, 0, 0, 1, 64.7, 700.9] },
        { str: '077.293.941-11', transform: [1, 0, 0, 1, 433.7, 700.9] },
        { str: 'Cadastro:', transform: [1, 0, 0, 1, 18.4, 700.9] }
    ];
    assert.deepStrictEqual(
        _reconstruirLinhasPagina(items),
        ['Cadastro: 51 - ERIC DOUGLAS RODRIGUES ABELAYR CPF: 077.293.941-11']
    );
});

teste('_reconstruirLinhasPagina separa linhas com y além do limiar (quebra "ANANKE" real, page 8)', () => {
    const items = [
        { str: 'ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL', transform: [1, 0, 0, 1, 23.2, 391.6] },
        { str: 'GILVANETE LOURENCO DOS SANTOS', transform: [1, 0, 0, 1, 358.7, 391.6] },
        { str: 'LTDA', transform: [1, 0, 0, 1, 129.3, 380.7] }
    ];
    assert.deepStrictEqual(_reconstruirLinhasPagina(items), [
        'ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL GILVANETE LOURENCO DOS SANTOS',
        'LTDA'
    ]);
});

// ===== _classificarTipoPagina =====

teste('_classificarTipoPagina identifica página "aviso"', () => {
    assert.strictEqual(_classificarTipoPagina(['AVISO DE FÉRIAS', 'BRASILIA, 17 de Julho de 2026']), 'aviso');
});

teste('_classificarTipoPagina identifica página "abono"', () => {
    assert.strictEqual(_classificarTipoPagina(['SOLICITAÇÃO DE ABONO DE FÉRIAS', 'Empresa: X CNPJ: Y']), 'abono');
});

teste('_classificarTipoPagina retorna null para página desconhecida', () => {
    assert.strictEqual(_classificarTipoPagina(['ALGUM OUTRO TÍTULO']), null);
});

// ===== _extrairDadosAviso (linhas reais reconstruídas, page 1 — ERIC DOUGLAS) =====

const LINHAS_AVISO_ERIC = [
    'AVISO DE FÉRIAS',
    'BRASILIA, 17 de Julho de 2026',
    'Sr.: ERIC DOUGLAS RODRIGUES ABELAYR',
    'C.T.P.S.: 0772939 Série: 411',
    'Nos termos das disposições legais vigentes, suas férias serão concedidas conforme o',
    'demonstrativo abaixo:',
    'Período Aquisitivo...............: 17/06/2025 - 16/06/2026',
    'Período de Gozo................: 17/08/2026 - 05/09/2026',
    'Retorno ao trabalho............: 06/09/2026',
    'A remuneração correspondente às férias, e se for o caso, ao abono pecuniário e ao',
    'adiantamento da gratificação de natal encontra-se no caixa e poderá ser recebida em 14/08/2026.',
    'Favor apresentar a sua Carteira de Trabalho e Previdência Social ao Departamento',
    'de Pessoal para as anotações necessárias.',
    'N DE QUEIROZ DROGARIA LTDA ERIC DOUGLAS RODRIGUES ABELAYR'
];

teste('_extrairDadosAviso extrai todos os campos de uma página simples (sem quebra de empresa)', () => {
    const dados = _extrairDadosAviso(LINHAS_AVISO_ERIC);
    assert.deepStrictEqual(dados, {
        nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR',
        ctps: '0772939',
        periodo_aquisitivo_inicio: '17/06/2025',
        periodo_aquisitivo_fim: '16/06/2026',
        periodo_gozo_inicio: '17/08/2026',
        periodo_gozo_fim: '05/09/2026',
        retorno_trabalho: '06/09/2026',
        nome_empresa: 'N DE QUEIROZ DROGARIA LTDA'
    });
});

teste('_extrairDadosAviso reconstrói nome de empresa quebrado em 2 linhas (continuação depois do nome do empregado — page 7, GILVANETE)', () => {
    const linhas = [
        'AVISO DE FÉRIAS',
        'BRASILIA, 24 de Julho de 2026',
        'Sra.: GILVANETE LOURENCO DOS SANTOS',
        'C.T.P.S.: 00098433 Série: 00014',
        'Nos termos das disposições legais vigentes, suas férias serão concedidas conforme o',
        'demonstrativo abaixo:',
        'Período Aquisitivo...............: 19/01/2025 - 18/01/2026',
        'Período de Gozo................: 10/08/2026 - 24/08/2026',
        'Retorno ao trabalho............: 25/08/2026',
        'A remuneração correspondente às férias, e se for o caso, ao abono pecuniário e ao',
        'adiantamento da gratificação de natal encontra-se no caixa e poderá ser recebida em 07/08/2026.',
        'Favor apresentar a sua Carteira de Trabalho e Previdência Social ao Departamento',
        'de Pessoal para as anotações necessárias.',
        'ANANKE-CENTRO DE ATENCAO A SAUDE GILVANETE LOURENCO DOS SANTOS',
        'MENTAL LTDA'
    ];
    const dados = _extrairDadosAviso(linhas);
    assert.strictEqual(dados.nome_empregado, 'GILVANETE LOURENCO DOS SANTOS');
    assert.strictEqual(dados.nome_empresa, 'ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL LTDA');
});

teste('_extrairDadosAviso tolera ausência de C.T.P.S. (page 33, RAQUEL)', () => {
    const linhas = [
        'AVISO DE FÉRIAS',
        'BRASILIA, 17 de Julho de 2026',
        'Sr.: RAQUEL VIEIRA DA COSTA',
        'Nos termos das disposições legais vigentes, suas férias serão concedidas conforme o',
        'demonstrativo abaixo:',
        'Período Aquisitivo...............: 04/04/2025 - 03/04/2026',
        'Período de Gozo................: 18/08/2026 - 16/09/2026',
        'Retorno ao trabalho............: 17/09/2026',
        'A remuneração correspondente às férias, e se for o caso, ao abono pecuniário e ao',
        'adiantamento da gratificação de natal encontra-se no caixa e poderá ser recebida em 14/08/2026.',
        'Favor apresentar a sua Carteira de Trabalho e Previdência Social ao Departamento',
        'de Pessoal para as anotações necessárias.',
        'SOUL SERVICOS LTDA RAQUEL VIEIRA DA COSTA'
    ];
    const dados = _extrairDadosAviso(linhas);
    assert.strictEqual(dados.ctps, null);
    assert.strictEqual(dados.nome_empresa, 'SOUL SERVICOS LTDA');
});

// ===== _extrairDadosAbono (linhas reais reconstruídas, page 2 — ERIC DOUGLAS) =====

teste('_extrairDadosAbono extrai empresa, CNPJ, cadastro, nome e CPF', () => {
    const linhas = [
        'SOLICITAÇÃO DE ABONO DE FÉRIAS',
        'Empresa: N DE QUEIROZ DROGARIA LTDA CNPJ: 08.836.871/0001-51',
        'Cadastro: 51 - ERIC DOUGLAS RODRIGUES ABELAYR CPF: 077.293.941-11',
        'Em cumprimento ao disposto no parágrafo 1º do Artigo 143 do Decreto-Lei Nº 1.535 de 13 de Abril de 1977, venho pela',
        'presente requerer a ABONO PECUNIÁRIO de 1/3 das férias, referente ao período aquisitivo de 17/06/2025 a 16/06/2026.',
        'BRASILIA, 17 DE JULHO DE 2026',
        'N DE QUEIROZ DROGARIA LTDA ERIC DOUGLAS RODRIGUES ABELAYR'
    ];
    assert.deepStrictEqual(_extrairDadosAbono(linhas), {
        nome_empresa: 'N DE QUEIROZ DROGARIA LTDA',
        cnpj: '08.836.871/0001-51',
        cadastro_codigo: '51',
        nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR',
        cpf: '077.293.941-11'
    });
});

teste('_extrairDadosAbono extrai corretamente mesmo com empresa longa que não quebrou (page 8, ANANKE)', () => {
    const linhas = [
        'SOLICITAÇÃO DE ABONO DE FÉRIAS',
        'Empresa: ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL LTDA CNPJ: 36.756.427/0001-61',
        'Cadastro: 175 - GILVANETE LOURENCO DOS SANTOS CPF: 903.631.081-49'
    ];
    const dados = _extrairDadosAbono(linhas);
    assert.strictEqual(dados.nome_empresa, 'ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL LTDA');
    assert.strictEqual(dados.cnpj, '36.756.427/0001-61');
});

// ===== _normalizarNome / _normalizarCNPJ =====

teste('_normalizarNome remove acentos, uppercase e colapsa espaços', () => {
    assert.strictEqual(_normalizarNome('  José  da Silva  '), 'JOSE DA SILVA');
});

teste('_normalizarCNPJ mantém só dígitos', () => {
    assert.strictEqual(_normalizarCNPJ('08.836.871/0001-51'), '08836871000151');
});

// ===== _montarRegistrosEmpregados =====

teste('_montarRegistrosEmpregados pareia aviso+abono consecutivos do mesmo empregado', () => {
    const paginas = [
        { numero: 1, tipo: 'aviso', dados: { nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR', nome_empresa: 'N DE QUEIROZ DROGARIA LTDA' } },
        { numero: 2, tipo: 'abono', dados: { nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR', nome_empresa: 'N DE QUEIROZ DROGARIA LTDA', cnpj: '08.836.871/0001-51' } }
    ];
    const { registros, avisos } = _montarRegistrosEmpregados(paginas);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(registros.length, 1);
    assert.deepStrictEqual(registros[0], {
        nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR',
        nome_empresa: 'N DE QUEIROZ DROGARIA LTDA',
        cnpj: '08836871000151',
        paginas: [1, 2]
    });
});

teste('_montarRegistrosEmpregados tolera empregado sem página de abono', () => {
    const paginas = [
        { numero: 1, tipo: 'aviso', dados: { nome_empregado: 'FULANO', nome_empresa: 'EMPRESA X' } },
        { numero: 2, tipo: 'aviso', dados: { nome_empregado: 'CICLANO', nome_empresa: 'EMPRESA Y' } }
    ];
    const { registros, avisos } = _montarRegistrosEmpregados(paginas);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(registros.length, 2);
    assert.deepStrictEqual(registros[0].paginas, [1]);
    assert.strictEqual(registros[0].cnpj, null);
});

teste('_montarRegistrosEmpregados não pareia abono de empregado diferente do aviso anterior', () => {
    const paginas = [
        { numero: 1, tipo: 'aviso', dados: { nome_empregado: 'FULANO', nome_empresa: 'EMPRESA X' } },
        { numero: 2, tipo: 'abono', dados: { nome_empregado: 'OUTRA PESSOA', nome_empresa: 'EMPRESA X', cnpj: '00.000.000/0001-00' } }
    ];
    const { registros, avisos } = _montarRegistrosEmpregados(paginas);
    assert.strictEqual(registros.length, 1);
    assert.deepStrictEqual(registros[0].paginas, [1]);
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /não é do tipo "aviso"/);
});

// ===== _agruparPorEmpresa =====

teste('_agruparPorEmpresa agrupa por CNPJ e acumula empregados/páginas', () => {
    const registros = [
        { nome_empregado: 'A', nome_empresa: 'EMPRESA X', cnpj: '111', paginas: [1, 2] },
        { nome_empregado: 'B', nome_empresa: 'EMPRESA X', cnpj: '111', paginas: [3, 4] }
    ];
    const grupos = _agruparPorEmpresa(registros);
    assert.strictEqual(grupos.length, 1);
    assert.deepStrictEqual(grupos[0].empregados, ['A', 'B']);
    assert.deepStrictEqual(grupos[0].paginas, [1, 2, 3, 4]);
});

teste('_agruparPorEmpresa usa nome normalizado como chave quando não há CNPJ', () => {
    const registros = [
        { nome_empregado: 'A', nome_empresa: 'Empresa Sem CNPJ', cnpj: null, paginas: [1] }
    ];
    const grupos = _agruparPorEmpresa(registros);
    assert.strictEqual(grupos.length, 1);
    assert.strictEqual(grupos[0].chave, 'NOME:EMPRESA SEM CNPJ');
});

// ===== _resolverCodigoEmpresa =====

teste('_resolverCodigoEmpresa encontra pelo CNPJ normalizado', () => {
    const mapa = { '08836871000151': { codigo_empresa: '99', nome_empresa: 'N DE QUEIROZ DROGARIA LTDA' } };
    assert.deepStrictEqual(_resolverCodigoEmpresa('08836871000151', mapa), { codigo_empresa: '99', nome_empresa: 'N DE QUEIROZ DROGARIA LTDA' });
});

teste('_resolverCodigoEmpresa retorna null quando não encontra', () => {
    assert.strictEqual(_resolverCodigoEmpresa('00000000000000', {}), null);
});

// ===== _sanitizarNomeArquivo / _montarNomeArquivo =====

teste('_sanitizarNomeArquivo remove caracteres inválidos em nomes de arquivo Windows', () => {
    assert.strictEqual(_sanitizarNomeArquivo('03/08 a 07/09/2026: teste?'), '0308 a 07092026 teste');
});

teste('_montarNomeArquivo monta o nome final no padrão pedido', () => {
    assert.strictEqual(_montarNomeArquivo('453', 'AGO-2026'), '453_AVISO DE FERIAS_AGO-2026.pdf');
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
```

- [ ] **Step 3: Rodar os testes e confirmar que todos passam**

Run: `node "Projeto Fechamento Folha/test-aviso-ferias-parser.js"`
Expected: todas as linhas `OK  ...` e ao final `19 teste(s) passaram.` (sem stack trace de `AssertionError`).

Se algum teste falhar, ajustar a implementação (não o teste) até bater com o comportamento esperado documentado no ground truth acima.

- [ ] **Step 4: Commit**

```bash
git add "Projeto Fechamento Folha/aviso-ferias-parser.js" "Projeto Fechamento Folha/test-aviso-ferias-parser.js"
git commit -m "$(cat <<'EOF'
feat(fechamento-folha): parser puro do PDF Aviso de Ferias

Modulo sem DOM/pdf.js/Supabase que classifica paginas (aviso/abono),
extrai campos, pareia empregado por nome e agrupa por empresa/CNPJ.
Testado com node:assert a partir de linhas reais reconstruidas do
PDF de exemplo via pdf.js.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Casca HTML do wizard (`aviso-ferias.html`) + link no sidebar

**Files:**
- Create: `Projeto Fechamento Folha/aviso-ferias.html`
- Modify: `Projeto Fechamento Folha/index.html`

**Interfaces:**
- Produces: elementos DOM com os IDs usados pela Task 3/4 (`inputPdf`, `dropzone`, `inputIntervalo`, `btnProcessar`, `step1`, `step2`, `step3`, `tabelaEmpresas`, `avisosParsing`, `btnGerarPdfs`, `resultadoGeracao`, `btnBaixarZip`).
- Consumes: nada (é a camada de apresentação).

- [ ] **Step 1: Criar `aviso-ferias.html`**

Reaproveita o esqueleto de sidebar/auth-guard de `ferias.html`/`index.html` (mesmos `<script src>` de `supabase-config.js`, `@supabase/supabase-js@2`, `portal-auth-guard.js`) e o mesmo padrão de `.steps-bar`/`.upload-area` de `ferias.html`, adicionando `pdf.js`, `pdf-lib` e `JSZip`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aviso de Férias – SCONT</title>
<link rel="stylesheet" href="styles.css">
<script src="../supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../portal-auth-guard.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<style>
:root {
    --primary-color: #8B3A3A;
    --primary-dark:  #6B2A2A;
    --background-color: #F0F2F5;
    --theme-accent: #EFDADA;
}
.steps-bar { display: flex; align-items: center; margin: 0 28px; padding: 18px 0 0; }
.step-node { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.step-circle {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px;
    border: 2px solid #D0D0D0; background: #fff; color: #AAAAAA;
    transition: all .25s;
}
.step-circle.active { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }
.step-circle.done   { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }
.step-text { font-size: 12px; font-weight: 600; color: #AAAAAA; white-space: nowrap; transition: color .25s; }
.step-text.active, .step-text.done { color: var(--primary-color); }
.step-line { flex: 1; height: 2px; background: #D0D0D0; margin: 0 10px; transition: background .25s; min-width: 20px; }
.step-line.done { background: var(--primary-color); }

.upload-area {
    border: 2px dashed #D0D8E0; border-radius: 12px;
    padding: 40px 24px; text-align: center; cursor: pointer;
    transition: border-color .2s, background .2s; background: #FAFAFA; display: block;
}
.upload-area:hover, .upload-area.drag-over { border-color: var(--primary-color); background: #FBF3F3; }
.upload-area input[type=file] { display: none; }
.upload-icon { font-size: 44px; margin-bottom: 10px; }
.upload-label { font-size: 14px; color: #7F8C8D; line-height: 1.6; }
.upload-filename {
    margin-top: 12px; font-size: 13px; color: var(--primary-color);
    font-weight: 600; background: var(--theme-accent);
    border-radius: 6px; padding: 8px 14px; display: inline-block;
}
.campo-intervalo { margin-top: 22px; max-width: 420px; }
.campo-intervalo label { display: block; font-size: 12px; font-weight: 700; color: var(--secondary); margin-bottom: 6px; }
.campo-intervalo input {
    width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;
}

.tabela-empresas { width: 100%; border-collapse: collapse; font-size: 13px; }
.tabela-empresas th, .tabela-empresas td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.tabela-empresas select { padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; min-width: 220px; }
.badge-ok { background: #E8F6EC; color: var(--success); border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; }
.badge-pendente { background: #FDECEA; color: var(--danger); border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; }
.avisos-parsing { background: #FFF8E1; border: 1px solid #F0D98C; border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px; }

.cartao-empresa-gerada {
    display: flex; justify-content: space-between; align-items: center;
    border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin-bottom: 10px;
}
</style>
</head>
<body>

<button class="hamburger" id="hamburger" aria-label="Menu">☰</button>
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
        <img src="https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png" alt="SCONT">
        <h2>Fechamento Folha</h2>
        <p>Processamento de Folha</p>
    </div>
    <nav class="sidebar-nav">
        <div class="sidebar-section">Ferramentas</div>
        <a href="fluxo.html" class="sidebar-item"><span class="sidebar-item-icon">📋</span> Fluxo de Fechamento</a>
        <a href="ferias.html" class="sidebar-item"><span class="sidebar-item-icon">🏖️</span> Programação de Férias</a>
        <a href="aviso-ferias.html" class="sidebar-item active"><span class="sidebar-item-icon">📨</span> Aviso de Férias</a>
        <a href="controle.html" class="sidebar-item"><span class="sidebar-item-icon">🗂️</span> Controle de Fechamento</a>
    </nav>
    <div class="sidebar-footer">
        <a href="index.html" class="sidebar-item" style="margin-bottom:10px;border:1px solid rgba(255,255,255,0.18);border-radius:8px;">
            <span class="sidebar-item-icon">🏠</span> Voltar
        </a>
        <div class="sidebar-footer-info"><strong>Fechamento Folha</strong>SCONT · Módulo de Folha</div>
    </div>
</aside>

<div class="main-content">
    <div class="page-header">
        <div>
            <h1>Aviso de Férias</h1>
            <div class="page-header-sub">Separe e gere os avisos de férias por empresa a partir do PDF do sistema de folha</div>
        </div>
    </div>

    <div class="container">
        <div class="steps-bar">
            <div class="step-node"><div class="step-circle active" id="circle1">1</div><span class="step-text active" id="text1">Upload</span></div>
            <div class="step-line" id="line1"></div>
            <div class="step-node"><div class="step-circle" id="circle2">2</div><span class="step-text" id="text2">Revisão</span></div>
            <div class="step-line" id="line2"></div>
            <div class="step-node"><div class="step-circle" id="circle3">3</div><span class="step-text" id="text3">Geração</span></div>
        </div>

        <!-- PASSO 1 -->
        <section id="step1">
            <label class="upload-area" id="dropzone">
                <input type="file" id="inputPdf" accept="application/pdf">
                <div class="upload-icon">📄</div>
                <div class="upload-label">Arraste o PDF de Aviso de Férias aqui<br>ou clique para selecionar</div>
                <div class="upload-filename" id="nomeArquivoSelecionado" style="display:none"></div>
            </label>
            <div class="campo-intervalo">
                <label for="inputIntervalo">Intervalo (usado no nome dos arquivos gerados)</label>
                <input type="text" id="inputIntervalo" placeholder="Ex.: 03/08 a 07/09/2026">
            </div>
            <div style="margin-top:24px">
                <button class="btn btn-primary" id="btnProcessar" disabled>Processar PDF</button>
            </div>
        </section>

        <!-- PASSO 2 -->
        <section id="step2" style="display:none">
            <div id="avisosParsing" class="avisos-parsing" style="display:none"></div>
            <table class="tabela-empresas">
                <thead>
                    <tr>
                        <th>Empresa (no PDF)</th>
                        <th>CNPJ</th>
                        <th>Empregados</th>
                        <th>Páginas</th>
                        <th>Código da empresa</th>
                    </tr>
                </thead>
                <tbody id="tabelaEmpresasBody"></tbody>
            </table>
            <div style="margin-top:24px">
                <button class="btn btn-secondary" id="btnVoltarStep1">Voltar</button>
                <button class="btn btn-primary" id="btnGerarPdfs" disabled>Gerar PDFs</button>
            </div>
        </section>

        <!-- PASSO 3 -->
        <section id="step3" style="display:none">
            <div id="resultadoGeracao"></div>
            <div style="margin-top:20px">
                <button class="btn btn-primary" id="btnBaixarZip">⬇️ Baixar todos (.zip)</button>
                <button class="btn btn-secondary" id="btnNovoLote">Processar novo lote</button>
            </div>
        </section>
    </div>
</div>

<script src="aviso-ferias-parser.js"></script>
<script src="aviso-ferias.js"></script>
<script>
window.PortalAuthGuard.init(1, { returnAfterLogin: true });
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
hamburger.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });
</script>
</body>
</html>
```

- [ ] **Step 2: Adicionar o item no sidebar e no grid de `index.html`**

Em `index.html`, dentro de `<div class="sidebar-section">Ferramentas</div>` (logo após o link de "Programação de Férias", linha ~87):

```html
        <a href="aviso-ferias.html" class="sidebar-item">
            <span class="sidebar-item-icon">📨</span> Aviso de Férias
        </a>
```

E no grid de ferramentas da tela `telaEmpresas` (logo após o card "Programação de Férias", linha ~167):

```html
                <a href="aviso-ferias.html" class="empresa-card">
                    <div class="card-icon">📨</div>
                    <h3>Aviso de Férias</h3>
                    <p>Separe e gere os avisos de férias por empresa a partir do PDF do sistema</p>
                </a>
```

- [ ] **Step 3: Verificar visualmente**

Abrir `aviso-ferias.html` num servidor local (ex. `http-server` já instalado globalmente) e conferir: sidebar com o novo item, Passo 1 visível com dropzone e campo de intervalo, botão "Processar PDF" desabilitado.

- [ ] **Step 4: Commit**

```bash
git add "Projeto Fechamento Folha/aviso-ferias.html" "Projeto Fechamento Folha/index.html"
git commit -m "$(cat <<'EOF'
feat(fechamento-folha): casca do wizard Aviso de Ferias

Adiciona aviso-ferias.html (upload + revisao + geracao, 3 passos)
e o link/card da ferramenta no index e no sidebar.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Passo 1→2 — parsing, resolução de empresa e revisão (`aviso-ferias.js`, parte 1)

**Files:**
- Create: `Projeto Fechamento Folha/aviso-ferias.js`

**Interfaces:**
- Consumes: todas as funções de `aviso-ferias-parser.js` (Task 1, já carregado como `<script>` global antes deste arquivo); `supabaseClient` global (de `supabase-config.js`, mesmo padrão de `controle.js`).
- Produces (usado pela Task 4): variáveis de módulo `state.grupos` (array de `{ chave, nome_empresa, cnpj, empregados, paginas, codigo_empresa }`), `state.pdfBytesOriginal` (Uint8Array), `state.intervalo` (string), função `irParaStep(n)`.

- [ ] **Step 1: Escrever o carregamento de `rh_empresas` e navegação entre passos**

```javascript
const state = {
    pdfBytesOriginal: null,
    intervalo: '',
    grupos: [],       // [{ chave, nome_empresa, cnpj, empregados, paginas, codigo_empresa }]
    empresasCache: []  // [{ codigo_empresa, nome_empresa, cnpj }]
};

function irParaStep(n) {
    [1, 2, 3].forEach(i => {
        document.getElementById(`step${i}`).style.display = (i === n) ? 'block' : 'none';
        document.getElementById(`circle${i}`).classList.toggle('active', i === n);
        document.getElementById(`circle${i}`).classList.toggle('done', i < n);
        document.getElementById(`text${i}`).classList.toggle('active', i === n);
        document.getElementById(`text${i}`).classList.toggle('done', i < n);
    });
    [1, 2].forEach(i => document.getElementById(`line${i}`).classList.toggle('done', i < n));
}

async function carregarEmpresas() {
    const { data, error } = await supabaseClient
        .from('rh_empresas')
        .select('codigo_empresa, nome_empresa, cnpj')
        .order('nome_empresa');
    if (error) { console.error('Erro ao carregar rh_empresas:', error); return []; }
    return data || [];
}

function construirMapaCnpj(empresas) {
    const mapa = {};
    empresas.forEach(e => {
        if (e.cnpj) mapa[_normalizarCNPJ(e.cnpj)] = { codigo_empresa: e.codigo_empresa, nome_empresa: e.nome_empresa };
    });
    return mapa;
}
```

- [ ] **Step 2: Escrever o parsing do PDF inteiro (pdf.js) usando o módulo puro da Task 1**

```javascript
async function parsearPdfAvisoFerias(arrayBuffer) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const paginas = [];

    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const linhas = _reconstruirLinhasPagina(content.items);
        const tipo = _classificarTipoPagina(linhas);
        let dados = null;
        if (tipo === 'aviso') dados = _extrairDadosAviso(linhas);
        else if (tipo === 'abono') dados = _extrairDadosAbono(linhas);
        paginas.push({ numero: p, tipo, dados: dados || {} });
    }

    const { registros, avisos } = _montarRegistrosEmpregados(paginas);
    const grupos = _agruparPorEmpresa(registros);
    return { grupos, avisos, totalPaginas: pdf.numPages };
}
```

- [ ] **Step 3: Escrever o handler do botão "Processar PDF" e a renderização da tabela de revisão**

```javascript
function renderizarLinhaGrupo(grupo, index) {
    const badge = grupo.codigo_empresa
        ? `<span class="badge-ok">✓ ${grupo.codigo_empresa}</span>`
        : `<span class="badge-pendente">Pendente</span>`;

    const opcoes = state.empresasCache
        .map(e => `<option value="${e.codigo_empresa}" ${e.codigo_empresa === grupo.codigo_empresa ? 'selected' : ''}>${e.codigo_empresa} — ${e.nome_empresa}</option>`)
        .join('');

    return `
        <tr data-index="${index}">
            <td>${grupo.nome_empresa || '—'}</td>
            <td>${grupo.cnpj || '—'}</td>
            <td>${grupo.empregados.length}</td>
            <td>${grupo.paginas.length}</td>
            <td>
                ${badge}
                <select class="select-codigo-empresa" data-index="${index}">
                    <option value="">Selecionar…</option>
                    ${opcoes}
                </select>
            </td>
        </tr>`;
}

function atualizarBotaoGerar() {
    const todosResolvidos = state.grupos.length > 0 && state.grupos.every(g => !!g.codigo_empresa);
    document.getElementById('btnGerarPdfs').disabled = !todosResolvidos;
}

function renderizarTabelaEmpresas() {
    const corpo = document.getElementById('tabelaEmpresasBody');
    corpo.innerHTML = state.grupos.map((g, i) => renderizarLinhaGrupo(g, i)).join('');

    corpo.querySelectorAll('.select-codigo-empresa').forEach(select => {
        select.addEventListener('change', (ev) => {
            const idx = Number(ev.target.dataset.index);
            state.grupos[idx].codigo_empresa = ev.target.value || null;
            renderizarTabelaEmpresas();
            atualizarBotaoGerar();
        });
    });

    atualizarBotaoGerar();
}

document.getElementById('inputPdf').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    document.getElementById('nomeArquivoSelecionado').style.display = 'inline-block';
    document.getElementById('nomeArquivoSelecionado').textContent = file.name;
    document.getElementById('btnProcessar').disabled = false;
    state._arquivoSelecionado = file;
});

document.getElementById('dropzone').addEventListener('dragover', (ev) => { ev.preventDefault(); document.getElementById('dropzone').classList.add('drag-over'); });
document.getElementById('dropzone').addEventListener('dragleave', () => document.getElementById('dropzone').classList.remove('drag-over'));
document.getElementById('dropzone').addEventListener('drop', (ev) => {
    ev.preventDefault();
    document.getElementById('dropzone').classList.remove('drag-over');
    const file = ev.dataTransfer.files[0];
    if (file) {
        document.getElementById('inputPdf').files = ev.dataTransfer.files;
        document.getElementById('inputPdf').dispatchEvent(new Event('change'));
    }
});

document.getElementById('btnProcessar').addEventListener('click', async () => {
    const file = state._arquivoSelecionado;
    const intervalo = document.getElementById('inputIntervalo').value.trim();
    if (!file || !intervalo) { alert('Selecione um PDF e informe o intervalo.'); return; }

    document.getElementById('btnProcessar').disabled = true;
    document.getElementById('btnProcessar').textContent = 'Processando…';

    try {
        const buffer = await file.arrayBuffer();
        state.pdfBytesOriginal = new Uint8Array(buffer.slice(0));
        state.intervalo = intervalo;

        state.empresasCache = await carregarEmpresas();
        const mapaCnpj = construirMapaCnpj(state.empresasCache);

        const { grupos, avisos, totalPaginas } = await parsearPdfAvisoFerias(buffer);
        grupos.forEach(g => {
            const resolvido = _resolverCodigoEmpresa(g.cnpj, mapaCnpj);
            g.codigo_empresa = resolvido ? resolvido.codigo_empresa : null;
        });
        state.grupos = grupos;

        const paginasAgrupadas = grupos.reduce((soma, g) => soma + g.paginas.length, 0);
        const painelAvisos = document.getElementById('avisosParsing');
        const mensagens = avisos.map(a => a.motivo);
        if (paginasAgrupadas !== totalPaginas) {
            mensagens.push(`Total de páginas do PDF (${totalPaginas}) difere do total agrupado (${paginasAgrupadas}) — revise antes de gerar.`);
        }
        if (mensagens.length > 0) {
            painelAvisos.style.display = 'block';
            painelAvisos.innerHTML = '⚠️ ' + mensagens.join('<br>⚠️ ');
        } else {
            painelAvisos.style.display = 'none';
        }

        renderizarTabelaEmpresas();
        irParaStep(2);
    } finally {
        document.getElementById('btnProcessar').disabled = false;
        document.getElementById('btnProcessar').textContent = 'Processar PDF';
    }
});

document.getElementById('btnVoltarStep1').addEventListener('click', () => irParaStep(1));
```

- [ ] **Step 4: Verificar manualmente com o PDF de exemplo**

Rodar um servidor estático na raiz de `Projeto Portal Scont` (ex. `http-server -p 8080`), abrir `aviso-ferias.html`, fazer upload de `Aviso Prévio de Férias.pdf` com um intervalo qualquer (ex. `03/08 a 07/09/2026`) e conferir na tela de revisão:
- 15 empresas distintas (conferir contra os nomes vistos no PDF: N DE QUEIROZ DROGARIA, ESPLANADA CONFECCOES, M.R.A. COMERCIO DE SORVETES, ANANKE-CENTRO..., WJ TELECOM, QUADRANTE ETIQUETAS INDUSTRIA E COMERCIO, DALA TRANSPORTES, LA TRANSPORTES E LOGISTICA, SOUL SERVICOS, ICONE SERVICOS ESPECIALIZADOS, JURANDIR FALEIRO DA SILVA EPP, COMERCIAL DE ROUPAS AGUIAR EPP).
- Nenhum aviso de página órfã/erro de parsing (soma de páginas deve bater com 40).
- Empresas cujo CNPJ já exista em `rh_empresas` aparecem com `codigo_empresa` pré-selecionado; as demais como "Pendente" com o `<select>` vazio.
- Botão "Gerar PDFs" só habilita depois de resolver manualmente todas as pendentes.

- [ ] **Step 5: Commit**

```bash
git add "Projeto Fechamento Folha/aviso-ferias.js"
git commit -m "$(cat <<'EOF'
feat(fechamento-folha): passo 1-2 do wizard Aviso de Ferias

Parsing do PDF via pdf.js + modulo puro, resolucao automatica de
empresa por CNPJ contra rh_empresas e tela de revisao com selecao
manual obrigatoria para as nao encontradas.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Passo 3 — geração dos PDFs com marca SCONT e download (`aviso-ferias.js`, parte 2)

**Files:**
- Modify: `Projeto Fechamento Folha/aviso-ferias.js`

**Interfaces:**
- Consumes: `state.grupos`, `state.pdfBytesOriginal`, `state.intervalo` (Task 3); `_montarNomeArquivo` (Task 1); `PDFLib` global (cdnjs); `JSZip` global.
- Produces: `state.arquivosGerados` (array `{ nomeArquivo, bytes }`) usado pelo botão de zip.

- [ ] **Step 1: Escrever a função de geração de um PDF por empresa (pdf-lib, cabeçalho/rodapé, embutido escalado)**

```javascript
const A4_LARGURA = 595.28;
const A4_ALTURA = 841.89;
const FAIXA_CABECALHO = 50;
const FAIXA_RODAPE = 24;

const COR_SECUNDARIA = PDFLib.rgb(0x2C / 255, 0x3E / 255, 0x50 / 255);
const COR_PRIMARIA = PDFLib.rgb(0x8B / 255, 0x3A / 255, 0x3A / 255);
const COR_BRANCA = PDFLib.rgb(1, 1, 1);

let _logoScontPngBytesCache = null;
async function obterLogoScontBytes() {
    if (_logoScontPngBytesCache !== null) return _logoScontPngBytesCache;
    try {
        const resp = await fetch('https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png');
        if (!resp.ok) throw new Error('fetch falhou');
        _logoScontPngBytesCache = new Uint8Array(await resp.arrayBuffer());
    } catch (e) {
        console.warn('Não foi possível baixar o logo SCONT, usando texto no cabeçalho:', e);
        _logoScontPngBytesCache = false;
    }
    return _logoScontPngBytesCache;
}

async function gerarPdfEmpresa(grupo, pdfOriginalDoc, logoBytes) {
    const novoDoc = await PDFLib.PDFDocument.create();
    const fontBold = await novoDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontRegular = await novoDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const logoEmbutido = logoBytes ? await novoDoc.embedPng(logoBytes) : null;

    const paginasOrigemTodas = pdfOriginalDoc.getPages();
    const paginasOriginais = await Promise.all(
        grupo.paginas.map(n => novoDoc.embedPage(paginasOrigemTodas[n - 1]))
    );

    const totalPaginas = paginasOriginais.length;
    for (let idx = 0; idx < totalPaginas; idx++) {
        const embutida = paginasOriginais[idx];
        const pagina = novoDoc.addPage([A4_LARGURA, A4_ALTURA]);

        const alturaDisponivel = A4_ALTURA - FAIXA_CABECALHO - FAIXA_RODAPE;
        const escala = Math.min(alturaDisponivel / embutida.height, A4_LARGURA / embutida.width);
        const larguraFinal = embutida.width * escala;
        const alturaFinal = embutida.height * escala;
        const offsetX = (A4_LARGURA - larguraFinal) / 2;
        const offsetY = FAIXA_RODAPE + (alturaDisponivel - alturaFinal) / 2;

        pagina.drawPage(embutida, { x: offsetX, y: offsetY, width: larguraFinal, height: alturaFinal });

        // Faixa de cabeçalho
        pagina.drawRectangle({ x: 0, y: A4_ALTURA - FAIXA_CABECALHO, width: A4_LARGURA, height: FAIXA_CABECALHO, color: COR_SECUNDARIA });
        let cursorX = 16;
        if (logoEmbutido) {
            const alturaLogo = 28;
            const larguraLogo = (logoEmbutido.width / logoEmbutido.height) * alturaLogo;
            pagina.drawImage(logoEmbutido, { x: cursorX, y: A4_ALTURA - FAIXA_CABECALHO / 2 - alturaLogo / 2, width: larguraLogo, height: alturaLogo });
            cursorX += larguraLogo + 12;
        } else {
            pagina.drawText('SCONT', { x: cursorX, y: A4_ALTURA - 32, size: 16, font: fontBold, color: COR_BRANCA });
            cursorX += 70;
        }
        const tituloDireita = `${grupo.codigo_empresa} · ${grupo.nome_empresa || ''}`;
        pagina.drawText(tituloDireita, { x: cursorX, y: A4_ALTURA - 24, size: 10, font: fontBold, color: COR_BRANCA });
        pagina.drawText('Aviso de Férias', { x: cursorX, y: A4_ALTURA - 38, size: 8, font: fontRegular, color: COR_BRANCA });

        // Faixa de rodapé
        pagina.drawRectangle({ x: 0, y: 0, width: A4_LARGURA, height: FAIXA_RODAPE, color: COR_PRIMARIA });
        pagina.drawText(`SCONT · Fechamento de Folha · Intervalo: ${state.intervalo}`, { x: 12, y: 8, size: 8, font: fontRegular, color: COR_BRANCA });
        const textoPagina = `Página ${idx + 1} de ${totalPaginas}`;
        const larguraTexto = fontRegular.widthOfTextAtSize(textoPagina, 8);
        pagina.drawText(textoPagina, { x: A4_LARGURA - larguraTexto - 12, y: 8, size: 8, font: fontRegular, color: COR_BRANCA });
    }

    return novoDoc.save();
}

async function gerarTodosPdfs() {
    const pdfOriginalDoc = await PDFLib.PDFDocument.load(state.pdfBytesOriginal);
    const logoBytes = await obterLogoScontBytes(); // Uint8Array ou false

    const gerados = [];
    for (const grupo of state.grupos) {
        const bytes = await gerarPdfEmpresa(grupo, pdfOriginalDoc, logoBytes || null);
        gerados.push({ nomeArquivo: _montarNomeArquivo(grupo.codigo_empresa, state.intervalo), bytes });
    }
    return gerados;
}
```

Fonte e logo são embutidos dentro de `gerarPdfEmpresa`, a partir de `novoDoc` (o documento que efetivamente será salvo) — nunca a partir de `pdfOriginalDoc`, que serve só como fonte das páginas via `embedPage`. Os bytes do logo (`logoBytes`) são baixados uma única vez e reembutidos (via `novoDoc.embedPng`) a cada empresa, já que um recurso embutido pertence ao documento que o embutiu.

- [ ] **Step 2: Escrever o handler do botão "Gerar PDFs" e a renderização dos cartões de download**

```javascript
function baixarBlob(bytes, nomeArquivo) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function renderizarResultadoGeracao(gerados) {
    const container = document.getElementById('resultadoGeracao');
    container.innerHTML = gerados.map((g, i) => `
        <div class="cartao-empresa-gerada">
            <div>
                <strong>${g.nomeArquivo}</strong><br>
                <span style="font-size:12px;color:#7F8C8D">${state.grupos[i].empregados.length} empregado(s)</span>
            </div>
            <button class="btn btn-secondary btn-small" data-index="${i}">⬇️ Baixar</button>
        </div>
    `).join('');

    container.querySelectorAll('button[data-index]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const idx = Number(ev.target.dataset.index);
            baixarBlob(gerados[idx].bytes, gerados[idx].nomeArquivo);
        });
    });
}

document.getElementById('btnGerarPdfs').addEventListener('click', async () => {
    const botao = document.getElementById('btnGerarPdfs');
    botao.disabled = true;
    botao.textContent = 'Gerando…';
    try {
        const gerados = await gerarTodosPdfs();
        state.arquivosGerados = gerados;
        renderizarResultadoGeracao(gerados);
        irParaStep(3);
    } catch (e) {
        console.error('Erro ao gerar PDFs:', e);
        alert('Erro ao gerar os PDFs: ' + e.message);
    } finally {
        botao.disabled = false;
        botao.textContent = 'Gerar PDFs';
    }
});

document.getElementById('btnBaixarZip').addEventListener('click', async () => {
    const zip = new JSZip();
    (state.arquivosGerados || []).forEach(g => zip.file(g.nomeArquivo, g.bytes));
    const conteudo = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(conteudo);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AVISO DE FERIAS_${state.intervalo}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

document.getElementById('btnNovoLote').addEventListener('click', () => {
    location.reload();
});
```

- [ ] **Step 3: Verificar manualmente**

No mesmo fluxo do Step 4 da Task 3, resolver todas as empresas pendentes e clicar em "Gerar PDFs". Conferir:
- Um cartão por empresa, nome de arquivo no padrão `{codigo}_AVISO DE FERIAS_{intervalo}.pdf`.
- Abrir ao menos 2 PDFs gerados (um de empresa com nome curto, um de empresa com nome longo como ANANKE) e confirmar visualmente: faixa de cabeçalho (SCONT + código/nome da empresa) no topo, conteúdo original legível e completo sem corte, faixa de rodapé na base, nenhuma sobreposição de texto.
- Clicar "Baixar todos (.zip)" e confirmar que o zip contém um arquivo por empresa.

- [ ] **Step 4: Commit**

```bash
git add "Projeto Fechamento Folha/aviso-ferias.js"
git commit -m "$(cat <<'EOF'
feat(fechamento-folha): passo 3 do wizard Aviso de Ferias (geracao)

Gera um PDF por empresa via pdf-lib, embutindo as paginas originais
escaladas em A4 com faixas de cabecalho/rodape na identidade visual
SCONT; download individual e em lote (.zip via JSZip).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Verificação final end-to-end e push

**Files:** nenhum (validação apenas).

- [ ] **Step 1: Rodar os testes do parser puro novamente**

Run: `node "Projeto Fechamento Folha/test-aviso-ferias-parser.js"`
Expected: todos os testes `OK`.

- [ ] **Step 2: Rodar o fluxo completo no navegador com o PDF real**

Usar o skill `run` (ou `http-server` já instalado globalmente) para servir `Projeto Portal Scont/` e abrir `Projeto Fechamento Folha/aviso-ferias.html`. Repetir upload → revisão (resolver todas as pendências) → geração, exatamente como nos Steps 4/3 das Tasks 3/4, e confirmar que as 15 empresas do PDF de exemplo geram 15 arquivos, cada um abrindo corretamente num visualizador de PDF.

- [ ] **Step 3: Push**

```bash
git push
```
