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
