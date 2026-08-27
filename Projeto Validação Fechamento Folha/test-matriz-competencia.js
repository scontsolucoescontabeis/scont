const assert = require('node:assert');
const { _descricaoCanonica, construirRubricasDistintas, construirMatriz } = require('./matriz-competencia.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

teste('_descricaoCanonica remove número de contrato no fim da descrição', () => {
    assert.strictEqual(_descricaoCanonica('DESC. EMP. CRED. TRAB Nº 190300014287744'), 'DESC. EMP. CRED. TRAB');
    assert.strictEqual(_descricaoCanonica('DESC EMP CRED TRAB FE Nº PKT154383663'), 'DESC EMP CRED TRAB FE');
});

teste('_descricaoCanonica mantém descrições sem número de contrato', () => {
    assert.strictEqual(_descricaoCanonica('DIAS NORMAIS'), 'DIAS NORMAIS');
    assert.strictEqual(_descricaoCanonica('HORAS EXTRAS 65%'), 'HORAS EXTRAS 65%');
});

function empFixture(overrides) {
    return Object.assign({ tipo: 'Empr', matricula: '1', nome: 'FULANO', rubricas: [] }, overrides);
}

teste('construirRubricasDistintas agrupa por código, separa por tipo e ordena numericamente', () => {
    const empregados = [
        empFixture({ matricula: '1', rubricas: [
            { codigo: '8781', descricao: 'DIAS NORMAIS', valor: 1000, tipo: 'P' },
            { codigo: '998', descricao: 'I.N.S.S.', valor: 100, tipo: 'D' },
            { codigo: '37', descricao: 'COMISSOES', valor: 500, tipo: 'P' }
        ] }),
        empFixture({ matricula: '2', rubricas: [
            { codigo: '8781', descricao: 'DIAS NORMAIS', valor: 900, tipo: 'P' },
            { codigo: '981', descricao: 'DESC.ADIANT.SALARIAL', valor: 300, tipo: 'D' }
        ] })
    ];
    const { proventos, descontos } = construirRubricasDistintas(empregados);
    assert.deepStrictEqual(proventos.map(r => r.codigo), ['37', '8781']);
    assert.deepStrictEqual(descontos.map(r => r.codigo), ['981', '998']);
});

teste('construirRubricasDistintas usa a descrição canônica do primeiro empregado em que o código aparece', () => {
    const empregados = [
        empFixture({ matricula: '1', rubricas: [{ codigo: '9751', descricao: 'DESC EMP CRED TRAB FE Nº AAA111', valor: 100, tipo: 'D' }] }),
        empFixture({ matricula: '2', rubricas: [{ codigo: '9751', descricao: 'DESC EMP CRED TRAB FE Nº BBB222', valor: 200, tipo: 'D' }] })
    ];
    const { descontos } = construirRubricasDistintas(empregados);
    assert.strictEqual(descontos[0].descricao, 'DESC EMP CRED TRAB FE');
});

teste('construirMatriz soma valores quando o mesmo código aparece mais de uma vez no mesmo empregado', () => {
    const empregados = [
        empFixture({ matricula: '1', rubricas: [
            { codigo: '202', descricao: 'DESC EMP CRED TRAB Nº 111', valor: 100, tipo: 'D' },
            { codigo: '202', descricao: 'DESC EMP CRED TRAB Nº 222', valor: 50, tipo: 'D' }
        ] })
    ];
    const selecaoRubricas = new Set(['202']);
    const selecaoEmpregados = new Set(['Empr:1']);
    const matriz = construirMatriz(empregados, selecaoRubricas, selecaoEmpregados);
    assert.strictEqual(matriz.linhas[0].valores[0], 150);
});

teste('construirMatriz retorna null na célula quando o empregado não tem aquela rubrica', () => {
    const empregados = [
        empFixture({ matricula: '1', rubricas: [{ codigo: '8781', descricao: 'DIAS NORMAIS', valor: 1000, tipo: 'P' }] }),
        empFixture({ matricula: '2', rubricas: [] })
    ];
    const selecaoRubricas = new Set(['8781']);
    const selecaoEmpregados = new Set(['Empr:1', 'Empr:2']);
    const matriz = construirMatriz(empregados, selecaoRubricas, selecaoEmpregados);
    assert.strictEqual(matriz.linhas.length, 2);
    assert.strictEqual(matriz.linhas[0].valores[0], 1000);
    assert.strictEqual(matriz.linhas[1].valores[0], null);
});

teste('construirMatriz respeita seleção parcial de empregados e rubricas, mantendo colunas proventos antes de descontos', () => {
    const empregados = [
        empFixture({ matricula: '1', rubricas: [
            { codigo: '8781', descricao: 'DIAS NORMAIS', valor: 1000, tipo: 'P' },
            { codigo: '998', descricao: 'I.N.S.S.', valor: 100, tipo: 'D' }
        ] }),
        empFixture({ matricula: '2', rubricas: [
            { codigo: '8781', descricao: 'DIAS NORMAIS', valor: 900, tipo: 'P' },
            { codigo: '998', descricao: 'I.N.S.S.', valor: 90, tipo: 'D' }
        ] })
    ];
    const selecaoRubricas = new Set(['8781', '998']);
    const selecaoEmpregados = new Set(['Empr:1']);
    const matriz = construirMatriz(empregados, selecaoRubricas, selecaoEmpregados);
    assert.strictEqual(matriz.linhas.length, 1);
    assert.strictEqual(matriz.colunas.length, 2);
    assert.strictEqual(matriz.nProventos, 1);
    assert.deepStrictEqual(matriz.colunas.map(c => c.codigo), ['8781', '998']);
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
