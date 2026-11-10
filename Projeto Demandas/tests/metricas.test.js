// Projeto Demandas/tests/metricas.test.js — rodar: node "Projeto Demandas/tests/metricas.test.js"
const assert = require('node:assert');
const M = require('../js/metricas.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }
const HOJE = '2026-11-09';
const d = (o) => ({ status: 'Aguardando SCONT', prioridade: 'Média', responsavel: 'Ana', prazo: null, aberta_em: null, concluida_em: null, ...o });

teste('abertas exclui Concluída e Informativo', () => {
    const m = M.metricas([d({}), d({ status: 'Concluída' }), d({ status: 'Informativo' }), d({ status: 'Aguardando cliente' })], HOJE);
    assert.strictEqual(m.abertas, 2);
    assert.strictEqual(m.total, 4);
});
teste('vencidas: prazo anterior a hoje só entre abertas; prazo de hoje não vence', () => {
    const m = M.metricas([d({ prazo: '2026-11-08' }), d({ prazo: '2026-11-09' }), d({ prazo: '2026-11-01', status: 'Concluída' }), d({})], HOJE);
    assert.strictEqual(m.vencidas, 1);
});
teste('vencendo em até 7 dias inclui hoje e o 7º dia, exclui o 8º e vencidas', () => {
    const m = M.metricas([d({ prazo: '2026-11-09' }), d({ prazo: '2026-11-16' }), d({ prazo: '2026-11-17' }), d({ prazo: '2026-11-08' })], HOJE);
    assert.strictEqual(m.vencendo7, 2);
});
teste('concluídas no mês usa o mês de Brasília (23h de 30/11 em BRT = 02h de 01/12 UTC)', () => {
    const m = M.metricas([
        d({ status: 'Concluída', concluida_em: '2026-12-01T02:00:00Z' }),   // 30/11 23h BRT -> novembro
        d({ status: 'Concluída', concluida_em: '2026-11-03T15:00:00Z' }),
        d({ status: 'Concluída', concluida_em: '2026-10-31T12:00:00Z' }),
        d({ status: 'Concluída', concluida_em: null }),
    ], HOJE);
    assert.strictEqual(m.concluidasMes, 2);
});
teste('totais por status e prioridade (distribuição do critério de aceite: 20 demandas)', () => {
    const st = { 'Aguardando SCONT': 7, 'Em análise (SCONT)': 3, 'Aguardando cliente': 2, 'Concluída': 5, 'Informativo': 3 };
    const pr = ['Alta', 'Alta', 'Alta', 'Alta', 'Alta', 'Alta', 'Alta', 'Média', 'Média', 'Média', 'Média', 'Média', 'Média', 'Média', 'Média', 'Média', 'Baixa', 'Baixa', 'Baixa', 'Baixa'];
    const lista = []; let i = 0;
    for (const [s, q] of Object.entries(st)) for (let k = 0; k < q; k++) lista.push(d({ status: s, prioridade: pr[i++] }));
    const m = M.metricas(lista, HOJE);
    assert.deepStrictEqual(Object.fromEntries(m.porStatus.map(x => [x.nome, x.n])), st);
    assert.deepStrictEqual(Object.fromEntries(m.porPrioridade.map(x => [x.nome, x.n])), { Alta: 7, Média: 9, Baixa: 4 });
});
teste('ranking por responsável só conta abertas, ordenado desc; sem responsável = "A definir"', () => {
    const m = M.metricas([d({ responsavel: 'Bia' }), d({ responsavel: 'Ana' }), d({ responsavel: 'Ana' }), d({ responsavel: null }), d({ responsavel: 'Ana', status: 'Concluída' })], HOJE);
    assert.deepStrictEqual(m.porResponsavel, [{ nome: 'Ana', n: 2 }, { nome: 'A definir', n: 1 }, { nome: 'Bia', n: 1 }]);
});
teste('mais antigas em aberto: ordem crescente de abertura, ignora sem data e concluídas, calcula dias', () => {
    const m = M.metricas([
        d({ id: 'novo', aberta_em: '2026-11-08T12:00:00-03:00' }),
        d({ id: 'velho', aberta_em: '2026-10-30T12:00:00-03:00' }),
        d({ id: 'semdata' }),
        d({ id: 'conc', status: 'Concluída', aberta_em: '2026-01-01T12:00:00-03:00' }),
    ], HOJE);
    assert.deepStrictEqual(m.maisAntigas.map(x => x.id), ['velho', 'novo']);
    assert.strictEqual(m.maisAntigas[0].dias_em_aberto, 10);
});

console.log(`\n${n} testes passaram.`);
