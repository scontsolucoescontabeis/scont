// Projeto PDI/tests/alertas.test.js
const assert = require('node:assert');
const A = require('../js/alertas.js');
let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }
const base = () => ({
    pdi: { data_inicio: '2026-10-07', meses_acompanhamento: 12, status: 'ativo' },
    tecnicas: [{ niveis: [] }], acoes: [], indicadores: [], melhorias: [], ciclos: [], avaliacoes: [], ciencias: [], alinhamentos: [],
});
const tipos = (d, h) => A.calcular(d, h).map(x => x.tipo);

teste('nível inicial crítico só após D + 15', () => {
    assert.ok(!tipos(base(), '2026-10-22').includes('nivel_inicial'));
    assert.ok(tipos(base(), '2026-10-23').includes('nivel_inicial'));
    const d = base(); d.tecnicas = [{ niveis: [{ nivel: 1 }] }];
    assert.ok(!tipos(d, '2026-11-30').includes('nivel_inicial'));
});
teste('ação a vencer em 3 dias e vencida', () => {
    const d = base();
    d.acoes = [{ foco_acao: 'X', prazo_dias: 15, status: 'a_iniciar' }, { foco_acao: 'Y', prazo_dias: 30, status: 'concluido' }];
    assert.ok(tipos(d, '2026-10-19').includes('acao_vencer'));
    assert.ok(!tipos(d, '2026-10-18').includes('acao_vencer'));
    assert.ok(tipos(d, '2026-10-23').includes('acao_vencida'));
});
teste('ação recorrente semanal nunca vence', () => {
    const d = base(); d.acoes = [{ foco_acao: 'R', recorrencia: 'semanal', status: 'a_iniciar' }];
    assert.ok(!tipos(d, '2027-01-01').includes('acao_vencida'));
});
teste('resumo semanal da semana anterior', () => {
    const d = base();
    assert.ok(tipos(d, '2026-10-19').includes('resumo_semanal'));
    d.alinhamentos = [{ semana_ref: '2026-10-12', realizado: true }];
    assert.ok(!tipos(d, '2026-10-19').includes('resumo_semanal'));
});
teste('avaliação a agendar 15 dias antes do fim do ciclo', () => {
    const d = base();
    d.ciclos = [{ numero: 1, fim: '2027-01-06', data_avaliacao_agendada: null }];
    assert.ok(tipos(d, '2026-12-22').includes('avaliacao_agendar'));
    assert.ok(!tipos(d, '2026-12-21').includes('avaliacao_agendar'));
    d.ciclos[0].data_avaliacao_agendada = '2027-01-05';
    assert.ok(!tipos(d, '2026-12-22').includes('avaliacao_agendar'));
});
teste('semanasPrevistas e encerrado sem alertas', () => {
    assert.strictEqual(A.semanasPrevistas('2026-10-07', '2026-10-07', '2027-10-07'), 1);
    assert.strictEqual(A.semanasPrevistas('2026-10-07', '2026-10-21', '2027-10-07'), 3);
    const d = base(); d.pdi.status = 'encerrado';
    assert.deepStrictEqual(A.calcular(d, '2027-01-01'), []);
});
console.log(`\n${n} testes passaram.`);
