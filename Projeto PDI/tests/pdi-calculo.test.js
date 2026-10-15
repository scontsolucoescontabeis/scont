// Projeto PDI/tests/pdi-calculo.test.js
const assert = require('node:assert');
const C = require('../js/pdi-calculo.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }

teste('prazos D + n (critério de aceite 2)', () => {
    const D = '2026-10-07';
    assert.strictEqual(C.somarDias(D, 15), '2026-10-22');
    assert.strictEqual(C.somarDias(D, 30), '2026-11-06');
    assert.strictEqual(C.somarDias(D, 60), '2026-12-06');
    assert.strictEqual(C.somarDias(D, 90), '2027-01-05');
});

teste('prazoRelativo trata Semanal e dias', () => {
    assert.deepStrictEqual(C.prazoRelativo('2026-10-07', 15, null), { rotulo: 'D + 15 dias', data: '2026-10-22', recorrente: false });
    assert.deepStrictEqual(C.prazoRelativo('2026-10-07', null, 'semanal'), { rotulo: 'Semanal', data: null, recorrente: true });
});

teste('somarMeses faz clamp no último dia do mês', () => {
    assert.strictEqual(C.somarMeses('2026-10-31', 4), '2027-02-28');
    assert.strictEqual(C.somarMeses('2027-11-30', 3), '2028-02-29');
    assert.strictEqual(C.somarMeses('2026-10-07', 12), '2027-10-07');
});

teste('ciclos trimestrais em 12 meses', () => {
    const c = C.ciclos('2026-10-07');
    assert.strictEqual(c.length, 4);
    assert.deepStrictEqual(c.map(x => x.numero), [1, 2, 3, 4]);
    assert.strictEqual(c[0].inicio, '2026-10-07');
    assert.strictEqual(c[0].fim, '2027-01-06');
    assert.strictEqual(c[1].inicio, '2027-01-07');
    assert.strictEqual(c[3].fim, '2027-10-06');
    assert.strictEqual(C.fimPdi('2026-10-07'), '2027-10-07');
});

teste('percentual: 1 casa e denominador 0 = null', () => {
    assert.strictEqual(C.percentual(19, 20), 95);
    assert.strictEqual(C.percentual(1, 3), 33.3);
    assert.strictEqual(C.percentual(0, 0), null);
    assert.strictEqual(C.percentual(5, 0), null);
    assert.strictEqual(C.percentual(null, 10), null);
});

teste('atingimento numérico, relativo e a pactuar', () => {
    assert.strictEqual(C.atingimento({ tipo_meta: 'numerica', operador: '>=', valor_meta: 95 }, 96), 'atingida');
    assert.strictEqual(C.atingimento({ tipo_meta: 'numerica', operador: '>=', valor_meta: 95 }, 80), 'parcial');
    assert.strictEqual(C.atingimento({ tipo_meta: 'numerica', operador: '>=', valor_meta: 95 }, 40), 'nao_atingida');
    assert.strictEqual(C.atingimento({ tipo_meta: 'numerica', operador: '=', valor_meta: 100 }, 100), 'atingida');
    assert.strictEqual(C.atingimento({ tipo_meta: 'numerica', operador: '>=', valor_meta: 95 }, null), 'sem_medicao');
    assert.strictEqual(C.atingimento({ tipo_meta: 'a_pactuar' }, 50), 'sem_medicao');
    assert.strictEqual(C.atingimento({ tipo_meta: 'relativa_linha_base', valor_meta: null }, 10), 'sem_medicao');
    assert.strictEqual(C.atingimento({ tipo_meta: 'relativa_linha_base', operador: '<=', valor_meta: 10 }, 8), 'atingida');
});

teste('nivelAtual = último nível validado', () => {
    const niveis = [
        { data: '2026-10-10', nivel: 1, validado_em: '2026-10-11' },
        { data: '2026-11-10', nivel: 3, validado_em: null },
        { data: '2026-12-01', nivel: 2, validado_em: '2026-12-02' },
    ];
    assert.strictEqual(C.nivelAtual(niveis), 2);
    assert.strictEqual(C.nivelAtual([]), null);
});

teste('autonomia automática e progresso técnico', () => {
    const rotinas = [
        { priorizada: true, niveis: [{ data: '2026-10-10', nivel: 3, validado_em: 'x' }] },
        { priorizada: true, niveis: [{ data: '2026-10-10', nivel: 2, validado_em: 'x' }] },
        { priorizada: false, niveis: [{ data: '2026-10-10', nivel: 4, validado_em: 'x' }] },
        { priorizada: true, niveis: [] },
    ];
    assert.strictEqual(C.autonomia(rotinas), 33.3);
    assert.deepStrictEqual(C.progressoTecnico(rotinas, 2), { atingidas: 2, total: 3 });
    assert.strictEqual(C.autonomia([{ priorizada: false, niveis: [] }]), null);
});

teste('controles e pendências', () => {
    assert.strictEqual(C.controles(10, 12), 83.3);
    const sinal = [
        { data_sinalizacao: '2026-10-10', prazo_entrega: '2026-10-12' },
        { data_sinalizacao: '2026-10-13', prazo_entrega: '2026-10-12' },
    ];
    assert.strictEqual(C.pendencias(sinal), 50);
    assert.strictEqual(C.pendencias([]), null);
});

teste('mediaNotas ignora nulos', () => {
    assert.strictEqual(C.mediaNotas([2, 3, null, 4]), 3);
    assert.strictEqual(C.mediaNotas([]), null);
});

teste('validarFicha: N/A exige justificativa, ciências e resultado', () => {
    const base = {
        pilares: [
            { pilar: 'tecnicas', nota_ciclo: 2 }, { pilar: 'comportamentais', nota_ciclo: 3 },
            { pilar: 'performance', na: true, justificativa_na: 'sem medição' }, { pilar: 'melhorias', nota_ciclo: 1 },
        ],
        resultado: 'parcial', direcionamentos: ['revisao_prioridades'],
        ciencias: ['colaborador', 'gestor', 'diretoria'],
    };
    assert.deepStrictEqual(C.validarFicha(base), []);
    const semJust = JSON.parse(JSON.stringify(base)); semJust.pilares[2].justificativa_na = '  ';
    assert.ok(C.validarFicha(semJust).length > 0);
    const semCiencia = JSON.parse(JSON.stringify(base)); semCiencia.ciencias = ['gestor'];
    assert.ok(C.validarFicha(semCiencia).length > 0);
    const semRes = JSON.parse(JSON.stringify(base)); semRes.resultado = null; semRes.direcionamentos = [];
    assert.strictEqual(C.validarFicha(semRes).length, 2);
});

teste('nivel inicial pendente após D + 15', () => {
    assert.strictEqual(C.nivelInicialPendente('2026-10-07', '2026-10-23', 0), true);
    assert.strictEqual(C.nivelInicialPendente('2026-10-07', '2026-10-22', 0), false);
    assert.strictEqual(C.nivelInicialPendente('2026-10-07', '2026-10-30', 3), false);
});

console.log(`\n${n} testes passaram.`);
