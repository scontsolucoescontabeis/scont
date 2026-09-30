const assert = require('node:assert');
const { parsearFerias } = require('./ferias-parser.js');

const H = 600;
// y em coordenadas PDF (origem embaixo): H - yTopo
const it = (str, x, yTopo) => ({ str, x, y: H - yTopo, width: 10 });

function pagina(nome, doc, pagina, linhasDados, cab = 'CNPJ') {
    const itens = [
        it(nome, 0, 20), it('Página:', 684, 20), it(pagina, 754, 20),
        it(cab + ':', 0, 40), it(doc, 47, 40),
        it('PROGRAMAÇÃO DE FÉRIAS', 324, 80),
        it('Código', 7, 110), it('Empregado', 37, 110), it('Data', 204, 110),
    ];
    linhasDados.forEach(([cod, nomeEmp], k) => {
        const y = 130 + k * 12;
        itens.push(it(cod, 28, y), it(nomeEmp, 37, y), it('01/01/2020', 204, y));
    });
    itens.push(it('Total de empregados:', 631, 130 + linhasDados.length * 12 + 20), it(String(linhasDados.length), 764, 130 + linhasDados.length * 12 + 20));
    return { height: H, items: itens };
}

const pages = [
    pagina('EMPRESA UM LTDA', '11.111.111/0001-11', '1 / 1', [['1', 'ANA']]),
    pagina('EMPRESA DOIS LTDA', '22.222.222/0001-22', '1 / 2', [['2', 'BIA'], ['3', 'CLARA']]),
    pagina('EMPRESA DOIS LTDA', '22.222.222/0001-22', '2 / 2', [['4', 'DUDA']]),
    pagina('JOAO PRODUTOR RURAL', '029.173.511/001-52', '1 / 1', [['5', 'EVA']], 'CAEPF'),
];

const r = parsearFerias(pages);
assert.strictEqual(r.empresas.length, 3);
assert.deepStrictEqual(r.empresas.map(e => e.nome), ['EMPRESA UM LTDA', 'EMPRESA DOIS LTDA', 'JOAO PRODUTOR RURAL']);
assert.deepStrictEqual(r.empresas.map(e => e.rows.length), [1, 3, 1]);   // pág. 2/2 continua a mesma empresa
assert.deepStrictEqual(r.empresas.map(e => e.cnpj), ['11.111.111/0001-11', '22.222.222/0001-22', '029.173.511/001-52']);
assert.strictEqual(r.empresas[2].rotulo, 'CAEPF');
assert.strictEqual(r.empresas[1].rows[2][1], 'DUDA');
assert.strictEqual(parsearFerias([{ height: H, items: [] }]), null);
console.log('OK  ferias-parser (multi-empresa, continuação de página, CAEPF)');
