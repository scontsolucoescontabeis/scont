// Projeto PDI/tests/textos.test.js
const assert = require('node:assert');
const T = require('../js/textos.js');
let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }

teste('modelo DP tem a contagem do documento de referência', () => {
    const c = T.MODELO_DP.conteudo;
    assert.strictEqual(c.perfil_esperado.length, 7);
    assert.strictEqual(c.tecnicas.length, 9);
    assert.strictEqual(c.comportamentais.length, 7);
    assert.strictEqual(c.acoes.length, 6);
    assert.strictEqual(c.indicadores.length, 6);
    assert.strictEqual(c.ciclos.length, 4);
});
teste('escalas 1-4 completas', () => {
    ['ESCALA_TECNICA', 'ESCALA_COMPORTAMENTAL', 'ESCALA_PERFORMANCE', 'ESCALA_MELHORIAS']
        .forEach(k => assert.deepStrictEqual(T[k].map(x => x.nivel), [1, 2, 3, 4]));
});
teste('correções ortográficas aplicadas', () => {
    const json = JSON.stringify(T);
    assert.ok(json.includes('Sistema Domínio'));
    assert.ok(json.includes('Visão Sistêmica'));
    assert.ok(json.includes('a fim de'));
    assert.ok(!json.includes('Sistema Dominio'));
    assert.ok(!json.includes('Visão Sistemica'));
    assert.ok(!json.includes('afim de'));
});
teste('seed Julia confere com o cabeçalho do documento', () => {
    assert.strictEqual(T.SEED_JULIA.colaborador_nome, 'Julia Costa Faria');
    assert.strictEqual(T.SEED_JULIA.data_inicio, '2026-10-07');
    assert.strictEqual(T.SEED_JULIA.admissao, '2026-09-08');
});
console.log(`\n${n} testes passaram.`);
