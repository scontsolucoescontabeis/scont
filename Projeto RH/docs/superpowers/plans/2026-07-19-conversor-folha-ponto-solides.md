# Conversor de Folha de Ponto (Sólides) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reativar o Conversor de Folha de Ponto (`Projeto RH/conversor.html` + `conversor.js`, removidos no commit `2d55774`) com um parser dedicado ao PDF de export do sistema **Sólides**, convertendo automaticamente todos os colaboradores de um arquivo em um único `.xlsx` no formato que o Controle de Frequência já importa.

**Architecture:** Um módulo puro `folha-ponto-solides-parser.js` (sem DOM/PDF.js/Supabase, testável via Node — mesmo padrão de `jornada-parser.js`/`ferias-parser.js`) faz toda a extração de texto→dados. `conversor.html`/`conversor.js` são a camada de wizard (4 etapas) que usa PDF.js para ler o arquivo, chama o parser puro, faz o matching de colaboradores com `rh_empregados` via Supabase, permite revisão editável e gera o Excel via SheetJS.

**Nota de ordenação (ajuste sobre o spec):** o spec descreve "Etapa 1: Configuração" antes do upload. Na implementação a ordem é invertida — **Etapa 1: Upload do PDF, Etapa 2: Configuração (Empresa + Competência)** — porque a competência só pode ser pré-preenchida *depois* de ler o PDF; a empresa só é necessária a partir da Etapa 3 (matching de colaboradores). O conteúdo funcional de cada etapa do spec é preservado, só a ordem muda. Etapa "Geração do Excel" do spec vira o botão final dentro da Etapa 4 (Dados), não uma etapa separada — evita uma tela quase vazia.

**Tech Stack:** Vanilla JS, HTML5, PDF.js 3.11.174 (mesma versão já usada em `admin.html`), SheetJS 0.18.5 (já usado no projeto), Supabase JS 2.x (já usado), Node `assert` para os testes do parser puro (mesmo padrão de `test-jornada-parser.js`).

## Global Constraints

- Sem build tools, sem ES modules — vanilla JS com `<script src>`.
- PDF.js via CDN: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js` — mesma versão de `admin.html`. Sem worker explícito (mesmo padrão de `admin.js`, que não configura `GlobalWorkerOptions.workerSrc`).
- SheetJS via CDN: `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` — mesma versão já usada no projeto.
- **Sem Tesseract.js / OCR / Excel genérico** — fora do escopo desta reativação (ver spec `docs/superpowers/specs/2026-07-19-conversor-folha-ponto-solides-design.md`).
- Autenticação: `PortalAuthGuard.init(1)` — igual ao `index.html`.
- Supabase: `SUPABASE_URL`/`SUPABASE_KEY` de `../supabase-config.js`.
- Paleta: `#8B3A3A` (primary) / `#6B2A2A` (dark) — igual `styles.css`.
- Nome da aba Excel de saída: `{codigo_empregado} {nome_empregado}` ou só `{nome_empregado}` sem código — mesmo padrão de `importarExcel`/`gerarModeloExcel` em `script.js`.
- Datas forçadas como texto `{ t: 's' }` nas células — mesmo padrão de `gerarModeloExcel`.
- Dias da semana abreviados `Dom/Seg/Ter/Qua/Qui/Sex/Sab` — mesmo array usado em `gerarDiasDoMes` (`script.js:4224`).
- Módulo puro do parser segue o padrão de `jornada-parser.js`: funções `_comPrefixoUnderscore`, guard `if (typeof module !== 'undefined' && module.exports)` no final, testável via `node test-folha-ponto-solides-parser.js`.

---

### Task 1: Parser puro — linhas da página, cabeçalho do colaborador e competência

**Files:**
- Create: `Projeto RH/folha-ponto-solides-parser.js`
- Create: `Projeto RH/test-folha-ponto-solides-parser.js`

**Interfaces:**
- Produces: `_linhasDaPagina(items)` → `string[]`; `_pareceSolides(textoCompleto)` → `boolean`; `_extrairCabecalhoColaborador(textoPagina)` → `{nome, cpf, admissao, funcao, codigo}`; `_extrairCompetencia(textoPagina)` → `string|null` (formato `MM/AAAA`)

- [ ] **Step 1: Criar `Projeto RH/test-folha-ponto-solides-parser.js` com os testes deste task**

```javascript
const assert = require('node:assert');
const {
    _linhasDaPagina,
    _pareceSolides,
    _extrairCabecalhoColaborador,
    _extrairCompetencia
} = require('./folha-ponto-solides-parser.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// Helper: converte { str, x, y } em item no formato do PDF.js (transform[4]=x, transform[5]=y)
function item(str, x, y) {
    return { str, transform: [1, 0, 0, 1, x, y] };
}

// ===== _linhasDaPagina =====

teste('_linhasDaPagina agrupa itens por Y (dentro do limiar) e ordena por X, unindo com espaço', () => {
    const items = [
        item('CPF:', 300, 700),
        item('Nome:', 0, 700),
        item('DANIELA DAS GRAÇAS NASARIO', 40, 700),
        item('88492745134', 320, 700),
        item('Admissão:', 0, 690),
        item('25/02/2026', 60, 690)
    ];
    const linhas = _linhasDaPagina(items);
    assert.deepStrictEqual(linhas, [
        'Nome: DANIELA DAS GRAÇAS NASARIO CPF: 88492745134',
        'Admissão: 25/02/2026'
    ]);
});

teste('_linhasDaPagina ignora itens vazios/em branco', () => {
    const items = [item('Nome:', 0, 700), item('   ', 40, 700), item('', 50, 700)];
    assert.deepStrictEqual(_linhasDaPagina(items), ['Nome:']);
});

teste('_linhasDaPagina retorna array vazio para lista vazia', () => {
    assert.deepStrictEqual(_linhasDaPagina([]), []);
    assert.deepStrictEqual(_linhasDaPagina(null), []);
});

// ===== _pareceSolides =====

teste('_pareceSolides reconhece texto com os três marcadores', () => {
    const texto = 'DADOS DO COLABORADOR\nPONTOS TRABALHADAS PREVISTAS SALDO';
    assert.strictEqual(_pareceSolides(texto), true);
});

teste('_pareceSolides rejeita texto sem os marcadores', () => {
    assert.strictEqual(_pareceSolides('qualquer outro documento'), false);
    assert.strictEqual(_pareceSolides(''), false);
    assert.strictEqual(_pareceSolides(null), false);
});

// ===== _extrairCabecalhoColaborador =====

const TEXTO_PAGINA_1 = `DADOS DO EMPREGADOR
Nome:
Endereço: null
CNPJ:
01/06/2026 a 30/06/2026
DADOS DO COLABORADOR
Nome: DANIELA DAS GRAÇAS NASARIO CPF: 88492745134 Código:
Admissão: 25/02/2026 CTPS: Série: Função: OPERADOR DE CAIXA Centro de Custo:
DIA / MÊS PONTOS TRABALHADAS ABONO PREVISTAS SALDO
01/06 segunda-feira 07:40 12:11 | 13:08 18:13 | 09:36 09:00 00:36
Total: 166:03 17:00 194:00`;

teste('_extrairCabecalhoColaborador extrai nome, cpf, admissão, função e código vazio', () => {
    const cab = _extrairCabecalhoColaborador(TEXTO_PAGINA_1);
    assert.strictEqual(cab.nome, 'DANIELA DAS GRAÇAS NASARIO');
    assert.strictEqual(cab.cpf, '88492745134');
    assert.strictEqual(cab.admissao, '25/02/2026');
    assert.strictEqual(cab.funcao, 'OPERADOR DE CAIXA');
    assert.strictEqual(cab.codigo, '');
});

teste('_extrairCabecalhoColaborador não confunde com o "Nome:" vazio de DADOS DO EMPREGADOR', () => {
    const cab = _extrairCabecalhoColaborador(TEXTO_PAGINA_1);
    assert.notStrictEqual(cab.nome, '');
});

teste('_extrairCabecalhoColaborador retorna campos vazios quando a seção não existe', () => {
    const cab = _extrairCabecalhoColaborador('texto qualquer sem a seção esperada');
    assert.deepStrictEqual(cab, { nome: '', cpf: '', admissao: '', funcao: '', codigo: '' });
});

// ===== _extrairCompetencia =====

teste('_extrairCompetencia lê o período do cabeçalho e usa o mês/ano final', () => {
    assert.strictEqual(_extrairCompetencia(TEXTO_PAGINA_1), '06/2026');
});

teste('_extrairCompetencia retorna null quando o período não aparece no texto', () => {
    assert.strictEqual(_extrairCompetencia('texto sem período'), null);
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
```

- [ ] **Step 2: Rodar os testes e confirmar que falham (módulo ainda não existe)**

Run: `node "Projeto RH/test-folha-ponto-solides-parser.js"`
Expected: erro `Cannot find module './folha-ponto-solides-parser.js'`

- [ ] **Step 3: Criar `Projeto RH/folha-ponto-solides-parser.js` com a implementação**

```javascript
/**
 * Parsing do PDF "Folha de Ponto" exportado pelo sistema Sólides (uma página
 * por colaborador). Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona
 * como <script> global no navegador e via require() em Node (para os testes).
 */

function _linhasDaPagina(items) {
    const validos = (items || []).filter(it => it && it.str && it.str.trim().length > 0);
    if (validos.length === 0) return [];

    const ordenadosPorY = validos.slice().sort((a, b) => b.transform[5] - a.transform[5]);
    const LIMIAR_Y = 1.0;

    const grupos = [];
    let grupoAtual = null;
    let anchorY = null;
    for (const it of ordenadosPorY) {
        const y = it.transform[5];
        if (grupoAtual === null || Math.abs(y - anchorY) > LIMIAR_Y) {
            grupoAtual = [];
            grupos.push(grupoAtual);
            anchorY = y;
        }
        grupoAtual.push({ str: it.str.trim(), x: it.transform[4] });
    }

    return grupos.map(g => g.slice().sort((a, b) => a.x - b.x).map(i => i.str).join(' '));
}

function _pareceSolides(textoCompleto) {
    const t = textoCompleto || '';
    return t.includes('DADOS DO COLABORADOR') && t.includes('PONTOS') && t.includes('TRABALHADAS');
}

function _capturar(texto, regex) {
    const m = texto.match(regex);
    return m ? m[1].trim() : '';
}

function _extrairCabecalhoColaborador(textoPagina) {
    const partes = (textoPagina || '').split('DADOS DO COLABORADOR');
    if (partes.length < 2) {
        return { nome: '', cpf: '', admissao: '', funcao: '', codigo: '' };
    }
    const texto = partes[1];

    return {
        nome: _capturar(texto, /Nome:\s*([^\n]*?)\s*CPF:/),
        cpf: _capturar(texto, /CPF:\s*(\d{11})/),
        admissao: _capturar(texto, /Admiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/),
        funcao: _capturar(texto, /Fun[çc][ãa]o:\s*([^\n]*?)\s*Centro de Custo:/),
        codigo: _capturar(texto, /C[óo]digo:\s*([^\n]*?)(?:\n|$)/)
    };
}

function _extrairCompetencia(textoPagina) {
    const m = (textoPagina || '').match(/\d{2}\/\d{2}\/\d{4}\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return `${m[2]}/${m[3]}`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _linhasDaPagina,
        _pareceSolides,
        _extrairCabecalhoColaborador,
        _extrairCompetencia
    };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node "Projeto RH/test-folha-ponto-solides-parser.js"`
Expected: todas as linhas `OK ...` e `9 teste(s) passaram.`

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/folha-ponto-solides-parser.js" "Projeto RH/test-folha-ponto-solides-parser.js"
git commit -m "feat(rh): parser Sólides — cabeçalho do colaborador e competência"
```

---

### Task 2: Parser puro — blocos de dia e parsing do "PONTOS"

**Files:**
- Modify: `Projeto RH/folha-ponto-solides-parser.js` (append)
- Modify: `Projeto RH/test-folha-ponto-solides-parser.js` (append)

**Interfaces:**
- Consumes: nenhuma interface nova de fora do arquivo
- Produces: `_dividirBlocosDia(texto)` → `{dia, mes, corpo}[]`; `_parsearCorpoDia(corpo)` → `{entrada1,saida1,entrada2,saida2,entrada3,saida3,ocorrencia}`; `_extrairDiasPontos(textoPagina, ano)` → `{data,entrada1,saida1,entrada2,saida2,entrada3,saida3,ocorrencia}[]`

- [ ] **Step 1: Adicionar os testes ao final de `test-folha-ponto-solides-parser.js` (antes do `console.log` final)**

```javascript
const {
    _dividirBlocosDia,
    _parsearCorpoDia,
    _extrairDiasPontos
} = require('./folha-ponto-solides-parser.js');

// ===== _dividirBlocosDia =====

teste('_dividirBlocosDia corta o texto em um bloco por âncora de dia', () => {
    const texto = '01/06 segunda-feira 07:40 12:11 | 13:08 18:13 | 09:36 09:00 00:36\n' +
                  '02/06 terça-feira 07:48 12:30 | 13:36 18:09 | 09:15 09:00 00:15\n' +
                  'Total: 166:03 17:00 194:00';
    const blocos = _dividirBlocosDia(texto);
    assert.strictEqual(blocos.length, 2);
    assert.strictEqual(blocos[0].dia, '01');
    assert.strictEqual(blocos[0].mes, '06');
    assert.strictEqual(blocos[1].dia, '02');
    assert.ok(!blocos[1].corpo.includes('Total:'), 'o corpo do último bloco não deve incluir o rodapé "Total:"');
});

// ===== _parsearCorpoDia =====

teste('_parsearCorpoDia extrai dois períodos completos', () => {
    const r = _parsearCorpoDia(' 07:40 12:11 | 13:08 18:13 | 09:36 09:00 00:36');
    assert.strictEqual(r.entrada1, '07:40');
    assert.strictEqual(r.saida1, '12:11');
    assert.strictEqual(r.entrada2, '13:08');
    assert.strictEqual(r.saida2, '18:13');
    assert.strictEqual(r.entrada3, '');
    assert.strictEqual(r.ocorrencia, '');
});

teste('_parsearCorpoDia ignora o marcador "(m)" de edição manual', () => {
    const r = _parsearCorpoDia(' 07:55 14:28 | (m)14:56 18:00 | 09:37 09:00 00:37');
    assert.strictEqual(r.entrada2, '14:56');
    assert.strictEqual(r.saida2, '18:00');
});

teste('_parsearCorpoDia com um único período (sábado) não confunde total com 2º período', () => {
    const r = _parsearCorpoDia(' 08:07 12:09 | 04:02 04:02');
    assert.strictEqual(r.entrada1, '08:07');
    assert.strictEqual(r.saida1, '12:09');
    assert.strictEqual(r.entrada2, '');
    assert.strictEqual(r.saida2, '');
});

teste('_parsearCorpoDia reconhece dia sem expediente ("-")', () => {
    const r = _parsearCorpoDia(' -');
    assert.deepStrictEqual(r, { entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '', ocorrencia: '' });
});

teste('_parsearCorpoDia reconhece ABONO de dia inteiro (sem pipe)', () => {
    const r = _parsearCorpoDia(' ABONO 09:00 09:00');
    assert.strictEqual(r.ocorrencia, 'ABONO');
    assert.strictEqual(r.entrada1, '');
});

teste('_parsearCorpoDia reconhece ATESTADO MÉDICO', () => {
    const r = _parsearCorpoDia(' ATESTADO MÉDICO 08:00 08:00');
    assert.strictEqual(r.ocorrencia, 'ATESTADO MÉDICO');
});

teste('_parsearCorpoDia reconhece ATESTADO DE COMPARECIMENTO', () => {
    const r = _parsearCorpoDia(' ATESTADO DE COMPARECIMENTO 04:00 04:00');
    assert.strictEqual(r.ocorrencia, 'ATESTADO DE COMPARECIMENTO');
});

teste('_parsearCorpoDia reconhece FALTA NAO JUSTIFICADA', () => {
    const r = _parsearCorpoDia(' FALTA NAO JUSTIFICADA 09:00 -9:00');
    assert.strictEqual(r.ocorrencia, 'FALTA NAO JUSTIFICADA');
});

teste('_parsearCorpoDia reconhece FERIADO isolado', () => {
    const r = _parsearCorpoDia(' FERIADO 09:00 09:00');
    assert.strictEqual(r.ocorrencia, 'FERIADO');
});

teste('_parsearCorpoDia reconhece "FALTA - FERIADO: <nome>" e para antes dos números', () => {
    const r = _parsearCorpoDia(' FALTA - FERIADO: Corpus Christi 09:00 -9:00');
    assert.strictEqual(r.ocorrencia, 'FALTA - FERIADO: Corpus Christi');
});

teste('_parsearCorpoDia reconhece dia misto: 1º período trabalhado + 2º período em ABONO', () => {
    const r = _parsearCorpoDia(' (m)08:00 12:00 | ABONO | 04:00 05:00 09:00');
    assert.strictEqual(r.entrada1, '08:00');
    assert.strictEqual(r.saida1, '12:00');
    assert.strictEqual(r.entrada2, '');
    assert.strictEqual(r.saida2, '');
    assert.strictEqual(r.ocorrencia, 'ABONO');
});

// ===== _extrairDiasPontos =====

teste('_extrairDiasPontos monta a data completa (DD/MM/AAAA) para cada dia encontrado', () => {
    const texto = '01/06 segunda-feira 07:40 12:11 | 13:08 18:13 | 09:36 09:00 00:36\n' +
                  '04/06 quinta-feira ABONO 09:00 09:00\n' +
                  'Total: 166:03 17:00 194:00';
    const dias = _extrairDiasPontos(texto, '2026');
    assert.strictEqual(dias.length, 2);
    assert.strictEqual(dias[0].data, '01/06/2026');
    assert.strictEqual(dias[0].entrada1, '07:40');
    assert.strictEqual(dias[1].data, '04/06/2026');
    assert.strictEqual(dias[1].ocorrencia, 'ABONO');
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node "Projeto RH/test-folha-ponto-solides-parser.js"`
Expected: erro de destructuring — `_dividirBlocosDia`/`_parsearCorpoDia`/`_extrairDiasPontos` não exportados ainda

- [ ] **Step 3: Adicionar ao final de `folha-ponto-solides-parser.js` (antes do guard `module.exports`)**

```javascript
function _dividirBlocosDia(texto) {
    const re = /(\d{2})\/(\d{2})\s+(segunda-feira|ter[çc]a-feira|quarta-feira|quinta-feira|sexta-feira|s[áa]bado|domingo)/gi;
    const anchors = [];
    let m;
    while ((m = re.exec(texto)) !== null) {
        anchors.push({ index: m.index, fim: m.index + m[0].length, dia: m[1], mes: m[2] });
    }

    const blocos = [];
    for (let i = 0; i < anchors.length; i++) {
        const inicio = anchors[i].fim;
        const fim = i + 1 < anchors.length ? anchors[i + 1].index : texto.length;
        let corpo = texto.substring(inicio, fim);
        const idxTotal = corpo.indexOf('Total:');
        if (idxTotal !== -1) corpo = corpo.substring(0, idxTotal);
        blocos.push({ dia: anchors[i].dia, mes: anchors[i].mes, corpo });
    }
    return blocos;
}

const _RE_STATUS = /ATESTADO M[ÉE]DICO|ATESTADO DE COMPARECIMENTO|FALTA\s*-\s*FERIADO:?\s*[^0-9|]*|FALTA\s*N[ÃA]O\s*JUSTIFICADA|FERIADO|ABONO/i;

function _extrairStatus(texto) {
    const m = (texto || '').match(_RE_STATUS);
    if (!m) return '';
    return m[0].replace(/\s+/g, ' ').trim();
}

function _horariosEm(texto) {
    const out = [];
    const re = /([01]?\d|2[0-3]):([0-5]\d)/g;
    let m;
    while ((m = re.exec(texto || '')) !== null) {
        out.push(`${m[1].padStart(2, '0')}:${m[2]}`);
    }
    return out;
}

function _parsearCorpoDia(corpo) {
    const resultado = { entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '', ocorrencia: '' };
    const semQuebras = (corpo || '').replace(/\n/g, ' ').trim();

    if (semQuebras === '-' || semQuebras === '') {
        return resultado;
    }

    const partes = semQuebras.split('|');

    if (partes.length === 1) {
        resultado.ocorrencia = _extrairStatus(partes[0]);
        return resultado;
    }

    const segmentosPeriodo = partes.slice(0, -1);
    const chavesPeriodo = ['entrada1', 'saida1', 'entrada2', 'saida2', 'entrada3', 'saida3'];
    let periodoIdx = 0;
    const statusEncontrados = [];

    segmentosPeriodo.forEach(seg => {
        const horarios = _horariosEm(seg);
        if (horarios.length >= 2) {
            const chaveEntrada = chavesPeriodo[periodoIdx * 2];
            const chaveSaida = chavesPeriodo[periodoIdx * 2 + 1];
            if (chaveEntrada && chaveSaida) {
                resultado[chaveEntrada] = horarios[0];
                resultado[chaveSaida] = horarios[1];
            }
        } else {
            const status = _extrairStatus(seg);
            if (status) statusEncontrados.push(status);
        }
        periodoIdx++;
    });

    resultado.ocorrencia = statusEncontrados.join(' + ');
    return resultado;
}

function _extrairDiasPontos(textoPagina, ano) {
    const blocos = _dividirBlocosDia(textoPagina || '');
    return blocos.map(b => {
        const dados = _parsearCorpoDia(b.corpo);
        return Object.assign({ data: `${b.dia}/${b.mes}/${ano}` }, dados);
    });
}
```

E atualizar o bloco `module.exports` para incluir as três novas funções:

```javascript
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _linhasDaPagina,
        _pareceSolides,
        _extrairCabecalhoColaborador,
        _extrairCompetencia,
        _dividirBlocosDia,
        _parsearCorpoDia,
        _extrairDiasPontos
    };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node "Projeto RH/test-folha-ponto-solides-parser.js"`
Expected: todas as linhas `OK ...` e `22 teste(s) passaram.`

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/folha-ponto-solides-parser.js" "Projeto RH/test-folha-ponto-solides-parser.js"
git commit -m "feat(rh): parser Sólides — blocos de dia, batidas e ocorrências"
```

---

### Task 3: Parser puro — mês completo, mesclagem e matching de colaborador

**Files:**
- Modify: `Projeto RH/folha-ponto-solides-parser.js` (append)
- Modify: `Projeto RH/test-folha-ponto-solides-parser.js` (append)

**Interfaces:**
- Consumes: `_extrairDiasPontos`, `_extrairCabecalhoColaborador`, `_extrairCompetencia`, `_linhasDaPagina` (Tasks 1–2)
- Produces: `_gerarDiasDoMes(competencia)` → dia-skeleton `[]`; `_mesclarDias(diasBase, diasExtraidos)` → `[]`; `_normalizarNome(nome)` → `string`; `_melhorMatchEmpregado(nomeExtraido, empregados)` → empregado`|null`; `_parsearPaginaColaborador(items, anoFallback)` → colaborador completo (usado pelo `conversor.js` na Task 6)

- [ ] **Step 1: Adicionar os testes ao final de `test-folha-ponto-solides-parser.js`**

```javascript
const {
    _gerarDiasDoMes,
    _mesclarDias,
    _normalizarNome,
    _melhorMatchEmpregado,
    _parsearPaginaColaborador
} = require('./folha-ponto-solides-parser.js');

// ===== _gerarDiasDoMes =====

teste('_gerarDiasDoMes gera todos os dias do mês com dia da semana abreviado', () => {
    const dias = _gerarDiasDoMes('06/2026');
    assert.strictEqual(dias.length, 30);
    assert.strictEqual(dias[0].data, '01/06/2026');
    assert.strictEqual(dias[0].diaSemana, 'Seg');
    assert.strictEqual(dias[29].data, '30/06/2026');
    assert.strictEqual(dias[0].entrada1, '');
    assert.strictEqual(dias[0].ocorrencia, '');
});

teste('_gerarDiasDoMes retorna vazio sem competência', () => {
    assert.deepStrictEqual(_gerarDiasDoMes(''), []);
});

// ===== _mesclarDias =====

teste('_mesclarDias preenche os dias do esqueleto com os dados extraídos, mantendo os demais em branco', () => {
    const base = _gerarDiasDoMes('06/2026');
    const extraidos = [
        { data: '01/06/2026', entrada1: '07:40', saida1: '12:11', entrada2: '13:08', saida2: '18:13', entrada3: '', saida3: '', ocorrencia: '' },
        { data: '04/06/2026', entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '', ocorrencia: 'ABONO' }
    ];
    const mesclado = _mesclarDias(base, extraidos);
    assert.strictEqual(mesclado.length, 30);
    assert.strictEqual(mesclado[0].entrada1, '07:40');
    assert.strictEqual(mesclado[0].diaSemana, 'Seg');
    assert.strictEqual(mesclado[3].ocorrencia, 'ABONO');
    assert.strictEqual(mesclado[1].entrada1, '', 'dia 02/06 sem dado extraído deve continuar em branco');
});

// ===== _normalizarNome / _melhorMatchEmpregado =====

teste('_normalizarNome remove acentos, baixa a caixa e colapsa espaços', () => {
    assert.strictEqual(_normalizarNome('  Daniela  Das Graças Nasário '), 'daniela das gracas nasario');
});

teste('_melhorMatchEmpregado encontra correspondência exata ignorando acento/caixa', () => {
    const empregados = [
        { codigo_empregado: '10', nome_empregado: 'Daniela das Graças Nasario' },
        { codigo_empregado: '11', nome_empregado: 'Jaconias da Silva Vieira' }
    ];
    const match = _melhorMatchEmpregado('DANIELA DAS GRAÇAS NASARIO', empregados);
    assert.strictEqual(match.codigo_empregado, '10');
});

teste('_melhorMatchEmpregado retorna null quando não há nenhuma correspondência razoável', () => {
    const empregados = [{ codigo_empregado: '10', nome_empregado: 'Fulano de Tal' }];
    assert.strictEqual(_melhorMatchEmpregado('CICRANO OUTRO NOME', empregados), null);
});

// ===== _parsearPaginaColaborador =====

teste('_parsearPaginaColaborador monta o registro completo do colaborador com dias do mês inteiro', () => {
    // Simula os itens de uma página real, todos numa única linha por simplicidade
    // (a reconstrução linha-a-linha já é coberta pelos testes de _linhasDaPagina)
    function linhaComoItens(texto, y) {
        return texto.split(' ').map((palavra, i) => ({ str: palavra, transform: [1, 0, 0, 1, i * 10, y] }));
    }
    const items = [
        ...linhaComoItens('01/06/2026 a 30/06/2026', 800),
        ...linhaComoItens('DADOS DO COLABORADOR', 790),
        { str: 'Nome:', transform: [1, 0, 0, 1, 0, 780] },
        { str: 'DANIELA DAS GRAÇAS NASARIO', transform: [1, 0, 0, 1, 10, 780] },
        { str: 'CPF:', transform: [1, 0, 0, 1, 200, 780] },
        { str: '88492745134', transform: [1, 0, 0, 1, 210, 780] },
        { str: 'Código:', transform: [1, 0, 0, 1, 220, 780] },
        { str: 'Admissão:', transform: [1, 0, 0, 1, 0, 770] },
        { str: '25/02/2026', transform: [1, 0, 0, 1, 10, 770] },
        { str: 'Função:', transform: [1, 0, 0, 1, 100, 770] },
        { str: 'OPERADOR', transform: [1, 0, 0, 1, 110, 770] },
        { str: 'DE', transform: [1, 0, 0, 1, 120, 770] },
        { str: 'CAIXA', transform: [1, 0, 0, 1, 130, 770] },
        { str: 'Centro', transform: [1, 0, 0, 1, 140, 770] },
        { str: 'de', transform: [1, 0, 0, 1, 150, 770] },
        { str: 'Custo:', transform: [1, 0, 0, 1, 160, 770] },
        ...linhaComoItens('PONTOS TRABALHADAS ABONO PREVISTAS SALDO', 750),
        ...linhaComoItens('01/06 segunda-feira 07:40 12:11 | 13:08 18:13 | 09:36 09:00 00:36', 740),
        ...linhaComoItens('04/06 quinta-feira ABONO 09:00 09:00', 730),
        ...linhaComoItens('Total: 166:03 17:00 194:00', 100)
    ];

    const colaborador = _parsearPaginaColaborador(items, 2026);
    assert.strictEqual(colaborador.nome, 'DANIELA DAS GRAÇAS NASARIO');
    assert.strictEqual(colaborador.cpf, '88492745134');
    assert.strictEqual(colaborador.funcao, 'OPERADOR DE CAIXA');
    assert.strictEqual(colaborador.competencia, '06/2026');
    assert.strictEqual(colaborador.dias.length, 30);
    const dia1 = colaborador.dias.find(d => d.data === '01/06/2026');
    assert.strictEqual(dia1.entrada1, '07:40');
    const dia4 = colaborador.dias.find(d => d.data === '04/06/2026');
    assert.strictEqual(dia4.ocorrencia, 'ABONO');
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node "Projeto RH/test-folha-ponto-solides-parser.js"`
Expected: erro de destructuring — funções ainda não exportadas

- [ ] **Step 3: Adicionar ao final de `folha-ponto-solides-parser.js` (antes do guard `module.exports`)**

```javascript
const _DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function _gerarDiasDoMes(competencia) {
    if (!competencia) return [];
    const [mes, ano] = competencia.split('/');
    const mesInt = parseInt(mes, 10);
    const anoInt = parseInt(ano, 10);
    const mesStr = String(mesInt).padStart(2, '0');
    const ultimoDia = new Date(anoInt, mesInt, 0).getDate();
    const dias = [];
    for (let i = 1; i <= ultimoDia; i++) {
        const data = new Date(anoInt, mesInt - 1, i);
        dias.push({
            data: `${String(i).padStart(2, '0')}/${mesStr}/${anoInt}`,
            diaSemana: _DIAS_SEMANA_ABREV[data.getDay()],
            entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '',
            ocorrencia: ''
        });
    }
    return dias;
}

function _mesclarDias(diasBase, diasExtraidos) {
    const porData = new Map((diasExtraidos || []).map(d => [d.data, d]));
    return (diasBase || []).map(dia => {
        const extra = porData.get(dia.data);
        if (!extra) return Object.assign({}, dia);
        return Object.assign({}, dia, {
            entrada1: extra.entrada1, saida1: extra.saida1,
            entrada2: extra.entrada2, saida2: extra.saida2,
            entrada3: extra.entrada3, saida3: extra.saida3,
            ocorrencia: extra.ocorrencia
        });
    });
}

function _normalizarNome(nome) {
    return (nome || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function _melhorMatchEmpregado(nomeExtraido, empregados) {
    const alvo = _normalizarNome(nomeExtraido);
    if (!alvo) return null;

    let parcial = null;
    for (const emp of (empregados || [])) {
        const nomeEmp = _normalizarNome(emp.nome_empregado);
        if (nomeEmp === alvo) return emp;
        if (!parcial && (nomeEmp.includes(alvo) || alvo.includes(nomeEmp))) parcial = emp;
    }
    return parcial;
}

function _parsearPaginaColaborador(items, anoFallback) {
    const texto = _linhasDaPagina(items).join('\n');
    const cabecalho = _extrairCabecalhoColaborador(texto);
    const competencia = _extrairCompetencia(texto);
    const ano = competencia ? competencia.split('/')[1] : String(anoFallback || new Date().getFullYear());
    const diasExtraidos = _extrairDiasPontos(texto, ano);
    const diasBase = competencia ? _gerarDiasDoMes(competencia) : [];
    const dias = diasBase.length ? _mesclarDias(diasBase, diasExtraidos) : diasExtraidos;
    return Object.assign({ competencia, dias }, cabecalho);
}
```

E atualizar o bloco `module.exports` final:

```javascript
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _linhasDaPagina,
        _pareceSolides,
        _extrairCabecalhoColaborador,
        _extrairCompetencia,
        _dividirBlocosDia,
        _parsearCorpoDia,
        _extrairDiasPontos,
        _gerarDiasDoMes,
        _mesclarDias,
        _normalizarNome,
        _melhorMatchEmpregado,
        _parsearPaginaColaborador
    };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node "Projeto RH/test-folha-ponto-solides-parser.js"`
Expected: todas as linhas `OK ...` e `31 teste(s) passaram.`

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/folha-ponto-solides-parser.js" "Projeto RH/test-folha-ponto-solides-parser.js"
git commit -m "feat(rh): parser Sólides — mês completo, mesclagem e matching de colaborador"
```

---

### Task 4: Scaffold `conversor.html` + link no sidebar

**Files:**
- Create: `Projeto RH/conversor.html`
- Modify: `Projeto RH/index.html:55-56` (após o botão "Gerar Escala")

**Interfaces:**
- Produces: page shell com `#step1`..`#step4`; CDN scripts carregados (PDF.js 3.11.174, xlsx 0.18.5, `folha-ponto-solides-parser.js`, `conversor.js`); `init()` chamado após auth

- [ ] **Step 1: Criar `Projeto RH/conversor.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conversor de Folha de Ponto · SCONT</title>
    <link rel="icon" type="image/x-icon" href="../assets/icons/rh/favicon.ico" />
    <link rel="stylesheet" href="styles.css">
    <style>
        .wizard-bar{display:flex;margin-bottom:24px;border-radius:8px;overflow:hidden;border:1px solid #E0E0E0;}
        .wizard-step{flex:1;padding:12px 8px;text-align:center;background:#F5F5F5;color:#999;font-size:12px;font-weight:600;border:none;cursor:default;transition:all 0.2s;}
        .wizard-step.ativo{background:#8B3A3A;color:white;}
        .wizard-step.feito{background:#D4EDDA;color:#155724;cursor:pointer;}
        .wizard-pane{display:none;}
        .wizard-pane.ativo{display:block;}
        .dropzone{border:2px dashed #8B3A3A;border-radius:10px;padding:40px 20px;text-align:center;cursor:pointer;transition:all 0.2s;background:#FAFAFA;}
        .dropzone:hover,.dropzone.over{background:#FFF5F5;border-color:#6B2A2A;}
        .edit-table{width:100%;border-collapse:collapse;font-size:12px;}
        .edit-table th{background:#8B3A3A;color:white;padding:8px 6px;text-align:left;font-size:11px;white-space:nowrap;}
        .edit-table td{border-bottom:1px solid #EEE;padding:2px;}
        .edit-table td input{width:100%;border:none;padding:5px 6px;font-size:12px;background:transparent;box-sizing:border-box;}
        .edit-table td input:focus{background:#FFF8F0;outline:1px solid #8B3A3A;border-radius:3px;}
        .edit-table td.ro{color:#555;padding:5px 6px;}
        .colab-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}
        .colab-tab{padding:6px 12px;border:1px solid #E0E0E0;border-radius:16px;background:white;cursor:pointer;font-size:12px;font-weight:600;color:#555;}
        .colab-tab.ativo{background:#8B3A3A;color:white;border-color:#8B3A3A;}
        .vinculo-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:center;border-bottom:1px solid #EEE;padding:10px 0;}
        .vinculo-grid select{width:100%;padding:8px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;}
        .autocomplete-wrap{position:relative;}
        .autocomplete-list{position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #E0E0E0;border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;z-index:100;display:none;}
        .autocomplete-item{padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #F0F0F0;}
        .autocomplete-item:hover{background:#F5F5F5;}
        .msg-box{padding:12px 16px;border-radius:6px;margin-bottom:16px;display:none;font-size:13px;white-space:pre-line;}
        .msg-box.info{background:#D1ECF1;color:#0C5460;border:1px solid #BEE5EB;display:block;}
        .msg-box.erro{background:#F8D7DA;color:#721C24;border:1px solid #F5C6CB;display:block;}
        .msg-box.aviso{background:#FFF3CD;color:#856404;border:1px solid #FFEEBA;display:block;}
        .msg-box.ok{background:#D4EDDA;color:#155724;border:1px solid #C3E6CB;display:block;}
        .progress-wrap{margin-top:16px;display:none;}
        .progress-bar-bg{background:#EEE;border-radius:4px;height:8px;overflow:hidden;margin-top:6px;}
        .progress-bar-fill{background:#8B3A3A;height:100%;width:0%;transition:width 0.3s;}
        .wizard-nav{display:flex;justify-content:space-between;margin-top:20px;}
        .btn-voltar{padding:10px 20px;border:1px solid #C0C0C0;border-radius:6px;background:white;cursor:pointer;font-weight:600;color:#555;}
        .btn-proximo{padding:10px 24px;border:none;border-radius:6px;background:#8B3A3A;color:white;cursor:pointer;font-weight:600;}
        .btn-proximo:disabled{background:#CCC;cursor:default;}
        .btn-gerar{padding:10px 24px;border:none;border-radius:6px;background:#27AE60;color:white;cursor:pointer;font-weight:700;font-size:14px;}
        .btn-gerar:disabled{background:#CCC;cursor:default;}
        .form-label{display:block;font-weight:600;color:#2C3E50;font-size:13px;margin-bottom:6px;}
        .form-input{width:100%;padding:10px;border:1px solid #E0E0E0;border-radius:6px;font-size:13px;box-sizing:border-box;}
        .form-input:focus{outline:none;border-color:#8B3A3A;box-shadow:0 0 0 3px rgba(139,58,58,0.1);}
        .section-box{background:#F8F9FA;border:1px solid #DEE2E6;border-radius:8px;padding:20px;margin-bottom:20px;}
        .section-box h3{color:#2C3E50;font-size:15px;margin:0 0 16px;}
    </style>
</head>
<body>

<button class="hamburger" id="hamburger" aria-label="Menu">☰</button>
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
        <img src="https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png" alt="SCONT">
        <h2>Folha de Ponto</h2>
        <p>Controle de Frequência</p>
    </div>
    <nav class="sidebar-nav">
        <a class="sidebar-item" href="index.html" style="text-decoration:none;">
            <span class="sidebar-item-icon">📋</span> Folha de Ponto
        </a>
        <a class="sidebar-item active" href="conversor.html" style="text-decoration:none;">
            <span class="sidebar-item-icon">📄</span> Conversor de Folha
        </a>
    </nav>
    <div class="sidebar-footer">
        <a href="../portal.html" class="sidebar-item" style="border:1px solid rgba(255,255,255,0.18);border-radius:8px;text-decoration:none;">
            <span class="sidebar-item-icon">🏠</span> Voltar ao Portal
        </a>
        <div class="sidebar-footer-info"><strong>Conversor de Folha</strong> SCONT · RH</div>
    </div>
</aside>

<div class="main-content">
    <div class="page-header">
        <h1>📄 Conversor de Folha de Ponto</h1>
        <div class="page-header-sub">Converte a Folha de Ponto do Sólides para o formato de importação do Controle de Frequência</div>
    </div>
    <div class="container">

        <div class="wizard-bar" id="wizardBar">
            <div class="wizard-step ativo" data-step="1">1 · Upload</div>
            <div class="wizard-step" data-step="2">2 · Configuração</div>
            <div class="wizard-step" data-step="3">3 · Colaboradores</div>
            <div class="wizard-step" data-step="4">4 · Dados e Geração</div>
        </div>

        <!-- STEP 1: UPLOAD -->
        <div id="step1" class="wizard-pane ativo">
            <div class="section-box">
                <h3>Upload do PDF (Sólides)</h3>
                <div class="dropzone" id="dropzone"
                     onclick="document.getElementById('fileInput').click()"
                     ondragover="event.preventDefault();this.classList.add('over')"
                     ondragleave="this.classList.remove('over')"
                     ondrop="event.preventDefault();this.classList.remove('over');handleArquivo(event.dataTransfer.files[0])">
                    <div style="font-size:48px;margin-bottom:12px;">📂</div>
                    <p style="font-weight:600;color:#2C3E50;margin:0 0 8px;">Arraste o PDF da Folha de Ponto aqui ou clique para selecionar</p>
                    <p style="font-size:12px;color:#7F8C8D;margin:0;">Aceito apenas: .pdf (export do Sólides, um colaborador por página)</p>
                </div>
                <input type="file" id="fileInput" accept=".pdf" style="display:none" onchange="handleArquivo(this.files[0]);this.value=''">
                <div class="msg-box" id="msgStep1"></div>
                <div class="progress-wrap" id="progressWrap">
                    <p style="font-size:12px;color:#555;margin:0;" id="progressLabel">Processando...</p>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressFill"></div></div>
                </div>
            </div>
        </div>

        <!-- STEP 2: CONFIGURAÇÃO -->
        <div id="step2" class="wizard-pane">
            <div class="section-box">
                <h3>Configuração</h3>
                <div style="margin-bottom:16px;">
                    <label class="form-label">Empresa *</label>
                    <div class="autocomplete-wrap">
                        <input type="text" id="buscaEmpresa" class="form-input" placeholder="Digite código ou nome..." oninput="filtrarEmpresas(this.value)" autocomplete="off">
                        <div class="autocomplete-list" id="listaEmpresas"></div>
                    </div>
                    <input type="hidden" id="codigoEmpresaHidden">
                </div>
                <div>
                    <label class="form-label">Competência *</label>
                    <input type="text" id="competencia" class="form-input" style="max-width:160px;" placeholder="MM/AAAA" maxlength="7" oninput="formatarCompetenciaInput(this)">
                    <p style="font-size:11px;color:#7F8C8D;margin:6px 0 0;" id="competenciaOrigemMsg"></p>
                </div>
            </div>
            <div class="wizard-nav">
                <button class="btn-voltar" onclick="mostrarEtapa(1)">← Voltar</button>
                <button class="btn-proximo" id="btnProximo2" onclick="avancarEtapa3()" disabled>Próximo →</button>
            </div>
        </div>

        <!-- STEP 3: COLABORADORES -->
        <div id="step3" class="wizard-pane">
            <div class="section-box">
                <h3>Revisão de Colaboradores</h3>
                <p style="font-size:13px;color:#7F8C8D;margin:0 0 16px;">Confirme o vínculo de cada colaborador encontrado no PDF com o cadastro da empresa. Colaboradores sem correspondência precisam de escolha manual ou podem ser ignorados.</p>
                <div class="msg-box" id="msgStep3"></div>
                <div id="listaVinculos"></div>
            </div>
            <div class="wizard-nav">
                <button class="btn-voltar" onclick="mostrarEtapa(2)">← Voltar</button>
                <button class="btn-proximo" id="btnProximo3" onclick="avancarEtapa4()" disabled>Próximo →</button>
            </div>
        </div>

        <!-- STEP 4: DADOS E GERAÇÃO -->
        <div id="step4" class="wizard-pane">
            <div class="section-box">
                <h3>Revisão dos Dados</h3>
                <p style="font-size:13px;color:#7F8C8D;margin:0 0 16px;">Edite as células se necessário antes de gerar o Excel.</p>
                <div class="colab-tabs" id="colabTabs"></div>
                <div style="overflow-x:auto;border:1px solid #E0E0E0;border-radius:8px;">
                    <table class="edit-table">
                        <thead id="editThead"></thead>
                        <tbody id="editTbody"></tbody>
                    </table>
                </div>
            </div>
            <div class="msg-box" id="msgStep4"></div>
            <div class="wizard-nav">
                <button class="btn-voltar" onclick="mostrarEtapa(3)">← Voltar</button>
                <button class="btn-gerar" id="btnGerar" onclick="gerarExcel()">⬇️ Gerar Excel</button>
            </div>
        </div>

    </div>
</div>

<div id="portalAuthOverlay" style="position:fixed;inset:0;background:#F4F7F6;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
    <div style="font-size:40px;">🔐</div>
    <p style="font-family:sans-serif;color:#8B3A3A;font-weight:600;font-size:15px;">Verificando acesso...</p>
</div>

<script src="../supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="../portal-auth-guard.js"></script>
<script src="folha-ponto-solides-parser.js"></script>
<script src="conversor.js"></script>
<script>
(async () => {
    const ok = await window.PortalAuthGuard.init(1);
    if (!ok) return;
    document.getElementById('portalAuthOverlay').remove();
    init();
})();
(function() {
    const h = document.getElementById('hamburger');
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebarOverlay');
    h.addEventListener('click', () => { s.classList.toggle('open'); o.classList.toggle('active'); });
    o.addEventListener('click', () => { s.classList.remove('open'); o.classList.remove('active'); });
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Adicionar link ao sidebar de `Projeto RH/index.html`**

Substituir (linha ~53-55):

```html
        <button class="sidebar-item" onclick="mostrarTela('escalaScreen')">
            <span class="sidebar-item-icon">🗓️</span> Gerar Escala
        </button>
    </nav>
```

por:

```html
        <button class="sidebar-item" onclick="mostrarTela('escalaScreen')">
            <span class="sidebar-item-icon">🗓️</span> Gerar Escala
        </button>
        <a class="sidebar-item" href="conversor.html" style="text-decoration:none;">
            <span class="sidebar-item-icon">📄</span> Conversor de Folha
        </a>
    </nav>
```

- [ ] **Step 3: Criar `Projeto RH/conversor.js` vazio (placeholder para as próximas tasks)**

```javascript
// conversor.js — preenchido nas Tasks 5–8
```

- [ ] **Step 4: Verificação manual**

Abrir `Projeto RH/conversor.html` num navegador (servidor local ou arquivo direto). Esperado: sidebar carrega, "Conversor de Folha" aparece marcado como item ativo, wizard bar mostra "1 · Upload" ativo, overlay de autenticação aparece e some após login. Abrir `Projeto RH/index.html` — o novo item "Conversor de Folha" aparece no sidebar, abaixo de "Gerar Escala", e navega para `conversor.html`.

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/conversor.html" "Projeto RH/conversor.js" "Projeto RH/index.html"
git commit -m "feat(rh): scaffold do Conversor de Folha de Ponto (Sólides)"
```

---

### Task 5: `conversor.js` — Etapa 1 (Upload + parsing do PDF)

**Files:**
- Modify: `Projeto RH/conversor.js` (substituir placeholder)

**Interfaces:**
- Consumes: `_pareceSolides`, `_parsearPaginaColaborador`, `_extrairCompetencia` (de `folha-ponto-solides-parser.js`, carregado como `<script>` global antes de `conversor.js`)
- Produces: `state` global; `init()`; `mostrarEtapa(n)`; `mostrarMsg`/`ocultarMsg`; `handleArquivo(file)`; `state.colaboradoresPdf` (usado pela Task 7); `state.competencia` pré-preenchido (usado pela Task 6)

- [ ] **Step 1: Escrever o conteúdo completo de `conversor.js`**

```javascript
// ===== STATE =====
const state = {
    sb: null,
    empresa: null,          // { codigo_empresa, nome_empresa }
    competencia: '',
    competenciaAutoDetectada: false,
    empregados: [],         // [{ codigo_empregado, nome_empregado }] da empresa selecionada
    colaboradoresPdf: [],   // [{ nome, cpf, admissao, funcao, codigo, competencia, dias:[...] }]
    vinculos: [],           // paralelo a colaboradoresPdf: { empregado: {codigo_empregado,nome_empregado}|null, ignorar: bool }
    terceiroTurno: false,
    abaAtivaEtapa4: 0
};

// ===== HELPERS =====
function mostrarMsg(elId, tipo, texto) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = 'msg-box ' + tipo;
    el.textContent = texto;
}
function ocultarMsg(elId) {
    const el = document.getElementById(elId);
    if (el) { el.className = 'msg-box'; el.textContent = ''; }
}

function mostrarEtapa(n) {
    document.querySelectorAll('.wizard-pane').forEach(p => p.classList.remove('ativo'));
    document.querySelectorAll('.wizard-step').forEach((s, i) => {
        s.classList.remove('ativo', 'feito');
        if (i + 1 < n) s.classList.add('feito');
        if (i + 1 === n) s.classList.add('ativo');
    });
    const pane = document.getElementById('step' + n);
    if (pane) pane.classList.add('ativo');
}

function mostrarProgresso(pct, label) {
    const wrap = document.getElementById('progressWrap');
    if (wrap) wrap.style.display = 'block';
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = pct + '%';
    const lbl = document.getElementById('progressLabel');
    if (lbl) lbl.textContent = label || 'Processando...';
}
function ocultarProgresso() {
    const wrap = document.getElementById('progressWrap');
    if (wrap) wrap.style.display = 'none';
}

// ===== INIT =====
function init() {
    state.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    carregarEmpresas();
    document.addEventListener('click', e => {
        if (!e.target.closest('#buscaEmpresa') && !e.target.closest('#listaEmpresas')) {
            const lista = document.getElementById('listaEmpresas');
            if (lista) lista.style.display = 'none';
        }
    });
}

// ===== ETAPA 1 — UPLOAD + PARSING =====
window.handleArquivo = async function(file) {
    if (!file) return;
    ocultarMsg('msgStep1');

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        mostrarMsg('msgStep1', 'erro', 'Selecione um arquivo .pdf.');
        return;
    }

    mostrarProgresso(5, 'Lendo PDF...');

    try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

        const paginasTexto = [];
        const colaboradores = [];
        const anoFallback = new Date().getFullYear();

        for (let p = 1; p <= pdf.numPages; p++) {
            mostrarProgresso(5 + Math.round((p / pdf.numPages) * 85), `Lendo página ${p}/${pdf.numPages}...`);
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const linhas = _linhasDaPagina(content.items);
            paginasTexto.push(linhas.join('\n'));
        }

        const textoCompleto = paginasTexto.join('\n');
        if (!_pareceSolides(textoCompleto)) {
            ocultarProgresso();
            mostrarMsg('msgStep1', 'erro', 'Arquivo não reconhecido como Folha de Ponto do Sólides. Verifique se o PDF é o export correto (uma página por colaborador, com as seções "DADOS DO COLABORADOR" e "PONTOS").');
            return;
        }

        for (let p = 0; p < pdf.numPages; p++) {
            const page = await pdf.getPage(p + 1);
            const content = await page.getTextContent();
            const colaborador = _parsearPaginaColaborador(content.items, anoFallback);
            if (colaborador.nome) colaboradores.push(colaborador);
        }

        if (!colaboradores.length) {
            ocultarProgresso();
            mostrarMsg('msgStep1', 'aviso', 'Nenhum colaborador foi reconhecido neste PDF.');
            return;
        }

        state.colaboradoresPdf = colaboradores;

        const competenciaExtraida = colaboradores.find(c => c.competencia)?.competencia || '';
        if (competenciaExtraida) {
            state.competencia = competenciaExtraida;
            state.competenciaAutoDetectada = true;
        }

        ocultarProgresso();
        mostrarEtapa(2);
        prepararEtapa2();
    } catch (e) {
        ocultarProgresso();
        mostrarMsg('msgStep1', 'erro', 'Erro ao processar o PDF: ' + e.message);
        console.error(e);
    }
};
```

- [ ] **Step 2: Verificação manual**

Abrir `conversor.html`, fazer login. Selecionar um PDF qualquer que **não** seja do Sólides (ex. qualquer outro PDF do projeto) — esperado: mensagem de erro "Arquivo não reconhecido...". Selecionar o `Folha de Ponto_Tradição Limpeza.pdf` (na raiz do `Projeto RH`) — esperado: barra de progresso avança por página, depois avança para a Etapa 2 (por ora tela em branco — `prepararEtapa2` ainda não existe, checar no console que `state.colaboradoresPdf.length === 5` e `state.competencia === '06/2026'`).

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat(rh): conversor — etapa 1 (upload e parsing do PDF Sólides)"
```

---

### Task 6: `conversor.js` — Etapa 2 (Empresa + Competência)

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.competencia`, `state.competenciaAutoDetectada` (Task 5)
- Produces: `prepararEtapa2()`; `carregarEmpresas()`; `filtrarEmpresas(termo)`; `selecionarEmpresa(codigo,nome)`; `carregarEmpregados(codigoEmpresa)` (usado pela Task 7); `formatarCompetenciaInput(el)`; `avancarEtapa3()`

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== ETAPA 2 — EMPRESA + COMPETÊNCIA =====
function prepararEtapa2() {
    const inputComp = document.getElementById('competencia');
    const msgOrigem = document.getElementById('competenciaOrigemMsg');
    if (state.competencia) {
        inputComp.value = state.competencia;
    }
    msgOrigem.textContent = state.competenciaAutoDetectada
        ? 'Competência detectada automaticamente a partir do PDF — confirme ou ajuste se necessário.'
        : 'Não foi possível detectar a competência no PDF — preencha manualmente.';
    atualizarBotaoProximo2();
}

async function carregarEmpresas() {
    try {
        const { data, error } = await state.sb
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa')
            .order('nome_empresa', { ascending: true });
        if (error) throw error;
        state._todasEmpresas = data || [];
    } catch (e) {
        console.warn('Erro ao carregar empresas:', e.message);
    }
}

window.filtrarEmpresas = function(termo) {
    const lista = document.getElementById('listaEmpresas');
    const norm = termo.trim().toLowerCase();
    const todas = state._todasEmpresas || [];
    const filtradas = norm
        ? todas.filter(e => e.nome_empresa.toLowerCase().includes(norm) || e.codigo_empresa.toLowerCase().includes(norm))
        : todas;
    if (!filtradas.length) { lista.style.display = 'none'; return; }
    lista.innerHTML = filtradas.map(e =>
        `<div class="autocomplete-item" onclick="selecionarEmpresa('${e.codigo_empresa}','${e.nome_empresa.replace(/'/g, "\\'")}')">
            <strong>${e.codigo_empresa}</strong> — ${e.nome_empresa}
         </div>`
    ).join('');
    lista.style.display = 'block';
};

window.selecionarEmpresa = async function(codigo, nome) {
    state.empresa = { codigo_empresa: codigo, nome_empresa: nome };
    document.getElementById('buscaEmpresa').value = `${codigo} — ${nome}`;
    document.getElementById('codigoEmpresaHidden').value = codigo;
    document.getElementById('listaEmpresas').style.display = 'none';
    atualizarBotaoProximo2();
    await carregarEmpregados(codigo);
};

async function carregarEmpregados(codigoEmpresa) {
    try {
        const { data, error } = await state.sb
            .from('rh_empregados')
            .select('codigo_empregado, nome_empregado')
            .eq('codigo_empresa', codigoEmpresa)
            .order('nome_empregado', { ascending: true });
        if (error) throw error;
        state.empregados = data || [];
    } catch (e) {
        console.warn('Erro ao carregar empregados:', e.message);
        state.empregados = [];
    }
}

window.formatarCompetenciaInput = function(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 6);
    el.value = v;
    state.competencia = el.value;
    atualizarBotaoProximo2();
};

function atualizarBotaoProximo2() {
    const ok = !!state.empresa && /^(0[1-9]|1[0-2])\/\d{4}$/.test(state.competencia);
    document.getElementById('btnProximo2').disabled = !ok;
}

window.avancarEtapa3 = function() {
    mostrarEtapa(3);
    prepararEtapa3();
};
```

- [ ] **Step 2: Verificação manual**

Repetir upload do PDF do Task 5 — Etapa 2 aparece com competência `06/2026` pré-preenchida e mensagem "Competência detectada automaticamente...". Digitar/selecionar uma empresa — botão "Próximo" habilita. Apagar a competência — botão desabilita novamente. Testar também um PDF sem o texto de período (não há no modelo, mas simular removendo a linha de período) — mensagem deve indicar que não foi detectada.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat(rh): conversor — etapa 2 (empresa e competência)"
```

---

### Task 7: `conversor.js` — Etapa 3 (Revisão de Colaboradores)

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.colaboradoresPdf` (Task 5), `state.empregados` (Task 6), `_melhorMatchEmpregado` (parser)
- Produces: `prepararEtapa3()`; `state.vinculos`; `atualizarVinculo(idx, valor)`; `avancarEtapa4()`

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== ETAPA 3 — REVISÃO DE COLABORADORES =====
const VALOR_IGNORAR = '__ignorar__';

function prepararEtapa3() {
    ocultarMsg('msgStep3');
    state.vinculos = state.colaboradoresPdf.map(colab => {
        const sugestao = _melhorMatchEmpregado(colab.nome, state.empregados);
        return { empregado: sugestao || null, ignorar: false };
    });
    renderizarVinculos();
    atualizarBotaoProximo3();
}

function renderizarVinculos() {
    const container = document.getElementById('listaVinculos');

    container.innerHTML = state.colaboradoresPdf.map((colab, idx) => {
        const vinculo = state.vinculos[idx];
        const semSugestao = !vinculo.empregado && !vinculo.ignorar;
        const opcoesEmpregados = state.empregados.map(e => {
            const selecionado = vinculo.empregado && vinculo.empregado.codigo_empregado === e.codigo_empregado;
            return `<option value="${e.codigo_empregado}" ${selecionado ? 'selected' : ''}>${e.codigo_empregado} — ${e.nome_empregado}</option>`;
        }).join('');
        return `
        <div class="vinculo-grid">
            <div>
                <strong>${colab.nome}</strong><br>
                <span style="font-size:11px;color:#7F8C8D;">CPF: ${colab.cpf || '—'} · Função: ${colab.funcao || '—'}</span>
                ${semSugestao ? '<br><span style="font-size:11px;color:#C0392B;">Sem sugestão automática — selecione manualmente</span>' : ''}
            </div>
            <div>
                <select onchange="atualizarVinculo(${idx}, this.value)">
                    <option value="" ${!vinculo.empregado && !vinculo.ignorar ? 'selected' : ''}>-- Selecione --</option>
                    ${opcoesEmpregados}
                    <option value="${VALOR_IGNORAR}" ${vinculo.ignorar ? 'selected' : ''}>Não importar este colaborador</option>
                </select>
            </div>
        </div>`;
    }).join('');
}

window.atualizarVinculo = function(idx, valor) {
    if (valor === VALOR_IGNORAR) {
        state.vinculos[idx] = { empregado: null, ignorar: true };
    } else if (!valor) {
        state.vinculos[idx] = { empregado: null, ignorar: false };
    } else {
        const emp = state.empregados.find(e => e.codigo_empregado === valor);
        state.vinculos[idx] = { empregado: emp || null, ignorar: false };
    }
    atualizarBotaoProximo3();
};

function atualizarBotaoProximo3() {
    const todosDecididos = state.vinculos.length > 0 &&
        state.vinculos.every(v => v.ignorar || !!v.empregado);
    document.getElementById('btnProximo3').disabled = !todosDecididos;
    if (!todosDecididos) {
        mostrarMsg('msgStep3', 'aviso', 'Escolha um vínculo (ou "Não importar") para todos os colaboradores antes de continuar.');
    } else {
        ocultarMsg('msgStep3');
    }
}

window.avancarEtapa4 = function() {
    mostrarEtapa(4);
    prepararEtapa4();
};
```

- [ ] **Step 2: Verificação manual**

Após configurar empresa/competência na Etapa 2 e clicar "Próximo", a Etapa 3 lista os 5 colaboradores do PDF modelo. Se a empresa selecionada tiver empregados com nomes iguais/parecidos aos do PDF, a sugestão já vem marcada no select; caso contrário, aparece "-- Selecione --" com o aviso vermelho. Selecionar manualmente cada um (ou marcar "Não importar") — botão "Próximo" só habilita quando todos tiverem decisão.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat(rh): conversor — etapa 3 (revisão e vínculo de colaboradores)"
```

---

### Task 8: `conversor.js` — Etapa 4 (Tabela editável por colaborador)

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.vinculos`, `state.colaboradoresPdf` (Task 7)
- Produces: `prepararEtapa4()`; `state.colaboradoresConfirmados`; `selecionarAbaColab(idx)`; `renderizarTabelaColab()`; mutações em `colab.dias` a cada edição de célula

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== ETAPA 4 — TABELA EDITÁVEL =====
function prepararEtapa4() {
    state.colaboradoresConfirmados = state.colaboradoresPdf
        .map((colab, idx) => ({ colab, vinculo: state.vinculos[idx] }))
        .filter(item => !item.vinculo.ignorar)
        .map(item => ({
            nome: item.vinculo.empregado ? item.vinculo.empregado.nome_empregado : item.colab.nome,
            codigo: item.vinculo.empregado ? item.vinculo.empregado.codigo_empregado : '',
            dias: item.colab.dias
        }));

    state.terceiroTurno = state.colaboradoresConfirmados.some(c =>
        c.dias.some(d => d.entrada3 || d.saida3)
    );

    state.abaAtivaEtapa4 = 0;
    renderizarAbasColab();
    renderizarTabelaColab();
    ocultarMsg('msgStep4');
}

function renderizarAbasColab() {
    const container = document.getElementById('colabTabs');
    container.innerHTML = state.colaboradoresConfirmados.map((c, idx) =>
        `<button type="button" class="colab-tab ${idx === state.abaAtivaEtapa4 ? 'ativo' : ''}" onclick="selecionarAbaColab(${idx})">${c.nome}</button>`
    ).join('');
}

window.selecionarAbaColab = function(idx) {
    state.abaAtivaEtapa4 = idx;
    renderizarAbasColab();
    renderizarTabelaColab();
};

function renderizarTabelaColab() {
    const thead = document.getElementById('editThead');
    const tbody = document.getElementById('editTbody');
    const colab = state.colaboradoresConfirmados[state.abaAtivaEtapa4];
    if (!colab) { thead.innerHTML = ''; tbody.innerHTML = ''; return; }

    const colunas = state.terceiroTurno
        ? ['Data', 'Dia', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3', 'Ocorrência']
        : ['Data', 'Dia', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Ocorrência'];
    thead.innerHTML = '<tr>' + colunas.map(c => `<th>${c}</th>`).join('') + '</tr>';

    const campos = state.terceiroTurno
        ? ['entrada1', 'saida1', 'entrada2', 'saida2', 'entrada3', 'saida3']
        : ['entrada1', 'saida1', 'entrada2', 'saida2'];

    tbody.innerHTML = colab.dias.map((dia, diaIdx) => {
        const camposHtml = campos.map(campo =>
            `<td><input type="text" value="${dia[campo] || ''}" maxlength="5" placeholder="00:00"
                onchange="atualizarCelulaDia(${diaIdx}, '${campo}', this.value)"></td>`
        ).join('');
        return `<tr>
            <td class="ro">${dia.data}</td>
            <td class="ro">${dia.diaSemana}</td>
            ${camposHtml}
            <td><input type="text" value="${dia.ocorrencia || ''}"
                onchange="atualizarCelulaDia(${diaIdx}, 'ocorrencia', this.value)"></td>
        </tr>`;
    }).join('');
}

window.atualizarCelulaDia = function(diaIdx, campo, valor) {
    const colab = state.colaboradoresConfirmados[state.abaAtivaEtapa4];
    if (!colab) return;
    colab.dias[diaIdx][campo] = valor;
};
```

- [ ] **Step 2: Verificação manual**

Avançar da Etapa 3 para a Etapa 4 com o PDF modelo (5 colaboradores). Esperado: abas com os 5 nomes aparecem, a primeira ativa por padrão; tabela mostra 30 linhas (dias de junho/2026) com Entrada/Saída preenchidas conforme o PDF e coluna "Ocorrência" preenchida nos dias de ABONO/ATESTADO/FALTA/FERIADO. Editar uma célula — valor persiste ao trocar de aba e voltar. Trocar de aba — tabela troca para os dados do outro colaborador.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat(rh): conversor — etapa 4 (tabela editável por colaborador)"
```

---

### Task 9: `conversor.js` — Geração do Excel e download

**Files:**
- Modify: `Projeto RH/conversor.js` (append)

**Interfaces:**
- Consumes: `state.colaboradoresConfirmados`, `state.terceiroTurno`, `state.empresa`, `state.competencia` (Task 8)
- Produces: `gerarExcel()` — monta o workbook via SheetJS e chama `XLSX.writeFile`

- [ ] **Step 1: Adicionar ao final de `conversor.js`**

```javascript
// ===== ETAPA 4 — GERAÇÃO DO EXCEL =====
window.gerarExcel = function() {
    if (!state.colaboradoresConfirmados || !state.colaboradoresConfirmados.length) {
        mostrarMsg('msgStep4', 'erro', 'Nenhum colaborador confirmado para gerar o Excel.');
        return;
    }

    const header = state.terceiroTurno
        ? ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3']
        : ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'];
    const campos = state.terceiroTurno
        ? ['entrada1', 'saida1', 'entrada2', 'saida2', 'entrada3', 'saida3']
        : ['entrada1', 'saida1', 'entrada2', 'saida2'];

    const wb = XLSX.utils.book_new();
    const linhasOcorrencias = [['Código', 'Empregado', 'Data', 'Dia da Semana', 'Ocorrência']];

    state.colaboradoresConfirmados.forEach(colab => {
        const aoa = [header, ...colab.dias.map(dia => [
            dia.data,
            dia.diaSemana,
            ...campos.map(c => dia[c] || '')
        ])];

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        for (let r = 1; r < aoa.length; r++) {
            const addr = XLSX.utils.encode_cell({ r, c: 0 });
            ws[addr] = { t: 's', v: aoa[r][0] };
        }
        ws['!cols'] = header.map(() => ({ wch: 13 }));

        const nomeAba = (colab.codigo ? `${colab.codigo} ${colab.nome}` : colab.nome).substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, nomeAba);

        colab.dias.forEach(dia => {
            if (dia.ocorrencia) {
                linhasOcorrencias.push([colab.codigo, colab.nome, dia.data, dia.diaSemana, dia.ocorrencia]);
            }
        });
    });

    if (linhasOcorrencias.length > 1) {
        const wsOcorr = XLSX.utils.aoa_to_sheet(linhasOcorrencias);
        for (let r = 1; r < linhasOcorrencias.length; r++) {
            const addr = XLSX.utils.encode_cell({ r, c: 2 });
            wsOcorr[addr] = { t: 's', v: linhasOcorrencias[r][2] };
        }
        wsOcorr['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 13 }, { wch: 10 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsOcorr, 'Ocorrências');
    }

    const [mm, aaaa] = state.competencia.split('/');
    const nomeArq = `FolhaPonto_${state.empresa.codigo_empresa}_${mm}-${aaaa}.xlsx`;
    XLSX.writeFile(wb, nomeArq);

    mostrarMsg('msgStep4', 'ok',
        `✓ "${nomeArq}" gerado com ${state.colaboradoresConfirmados.length} colaborador(es). ` +
        `Importe no Controle de Frequência usando "Importar Excel". ` +
        (linhasOcorrencias.length > 1
            ? `A aba "Ocorrências" lista Falta/Atestado/Abono/etc. para marcação manual dos flags após importar (o importador vai avisar que essa aba não corresponde a nenhum empregado — pode ignorar esse aviso).`
            : ''));
};
```

- [ ] **Step 2: Verificação manual — fluxo completo**

1. Abrir `conversor.html`, fazer upload do `Folha de Ponto_Tradição Limpeza.pdf` (raiz do `Projeto RH`).
2. Confirmar competência `06/2026` e selecionar a empresa correspondente (cadastrar os 5 empregados de teste em `rh_empregados` da empresa escolhida, se ainda não existirem, com nomes iguais aos do PDF para validar o matching automático).
3. Etapa 3: todos os 5 colaboradores devem sugerir o vínculo correto automaticamente (nomes idênticos). Avançar.
4. Etapa 4: conferir pelo menos 2 colaboradores — batidas batendo com o PDF (ex. Daniela 01/06 → Entrada 1 `07:40`, Saída 1 `12:11`, Entrada 2 `13:08`, Saída 2 `18:13`; 04/06 → Ocorrência `ABONO`; 18/06 → Ocorrência `FALTA NAO JUSTIFICADA`).
5. Clicar "Gerar Excel" — arquivo `FolhaPonto_{codigoEmpresa}_06-2026.xlsx` baixado.
6. Abrir o arquivo gerado — confirmar 5 abas nomeadas `{código} {nome}` + 1 aba final "Ocorrências" com todas as linhas de Falta/Atestado/Abono/Feriado dos 5 colaboradores.
7. No Controle de Frequência (`index.html`), usar "Importar Excel" com o arquivo gerado — confirmar que os horários aparecem corretamente e que aparece (e pode ser ignorado) o aviso sobre a aba "Ocorrências" não reconhecida.

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/conversor.js"
git commit -m "feat(rh): conversor — geração do Excel (abas por colaborador + aba Ocorrências)"
```

---

## Self-Review

**Cobertura do spec:**
- ✓ Parser dedicado ao Sólides (sem OCR/Excel genérico/imagem) — Tasks 1–3
- ✓ Multi-colaborador automático (uma página = um colaborador) — Task 5
- ✓ Competência pré-preenchida do PDF, editável — Tasks 5–6
- ✓ Empresa via autocomplete Supabase — Task 6
- ✓ Revisão de colaboradores com sugestão fuzzy + ajuste manual — Task 7
- ✓ Tabela editável por colaborador com coluna Ocorrência — Task 8
- ✓ Geração do Excel: abas por colaborador no formato exato do `importarExcel`/`gerarModeloExcel` + aba "Ocorrências" informativa — Task 9
- ✓ Link no sidebar do `index.html` — Task 4
- ✓ Autenticação `PortalAuthGuard.init(1)` — Task 4

**Consistência de tipos:**
- `_parsearPaginaColaborador` (Task 3) retorna `{nome,cpf,admissao,funcao,codigo,competencia,dias}` — consumido por `conversor.js` nas Tasks 5, 7, 8 com os mesmos nomes de campo.
- `dia` sempre tem as chaves `data,diaSemana,entrada1,saida1,entrada2,saida2,entrada3,saida3,ocorrencia` em todas as Tasks 1–9 — sem divergência de nome.
- `state.vinculos[i]` sempre `{empregado, ignorar}` — usado consistentemente nas Tasks 7 e 8.

**Sem placeholders:** todas as funções têm implementação completa; nenhum "TODO"/stub deixado entre tasks (diferente do plano V1, que tinha stubs `extrairPdf`/`extrairImagem` propositais — aqui não há OCR/Excel genérico a "adiar").
