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

console.log(`\n${testesExecutados} teste(s) passaram.`);
