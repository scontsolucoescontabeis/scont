// Projeto Demandas/tests/diff.test.js — rodar: node "Projeto Demandas/tests/diff.test.js"
const assert = require('node:assert');
const P = require('../js/parser.js');
const D = require('../js/diff.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }

const dem = (id, o = {}) => ({
    gmail_thread_id: id, cliente: 'Cli', solicitante: 'S', area: 'DP', tipo: 'Férias', prioridade: 'Alta', status: 'Aguardando SCONT',
    responsavel: 'Ana', demanda_inicial: 'Pedido', aberta_em: '2026-11-03T12:10:00-03:00', prazo: '2026-11-13', prazo_obs: null,
    proxima_acao: 'Responder', ultimo_movimento: '2026-11-09T11:35:00-03:00', link_email: 'https://x/' + id, ...o,
});
// linha do banco: mesmos campos, instantes em outro fuso (como o Postgres devolve) e campos_manuais
const noBanco = (d, extra = {}) => ({ ...d, aberta_em: '2026-11-03T15:10:00+00:00', ultimo_movimento: '2026-11-09T14:35:00+00:00', campos_manuais: [], ...extra });
const mapa = (...ls) => new Map(ls.map(l => [l.gmail_thread_id, l]));

teste('demanda inexistente é nova', () => {
    const r = D.classificarDemandas([dem('a')], mapa());
    assert.strictEqual(r.novas.length, 1);
});
teste('IDEMPOTÊNCIA: reimportar o mesmo conteúdo => nada novo, nada atualizado (mesmo com fuso diferente no banco)', () => {
    const plan = [dem('a'), dem('b')];
    const r = D.classificarDemandas(plan, mapa(...plan.map(p => noBanco(p))));
    assert.strictEqual(r.novas.length, 0);
    assert.strictEqual(r.atualizadas.length, 0);
    assert.strictEqual(r.inalteradas.length, 2);
    assert.strictEqual(r.conflitos.length, 0);
});
teste('campo alterado na planilha => atualizada, listando o que mudou', () => {
    const r = D.classificarDemandas([dem('a', { status: 'Concluída', ultimo_movimento: '2026-11-10T08:00:00-03:00' })], mapa(noBanco(dem('a'))));
    assert.strictEqual(r.atualizadas.length, 1);
    assert.deepStrictEqual(r.atualizadas[0]._mudancas.sort(), ['status', 'ultimo_movimento']);
});
teste('null, "" e espaços são equivalentes', () => {
    const r = D.classificarDemandas([dem('a', { prazo_obs: null, tipo: null })], mapa(noBanco(dem('a'), { prazo_obs: '  ', tipo: '' })));
    assert.strictEqual(r.inalteradas.length, 1);
});
teste('CONFLITO: campo editado à mão e diferente da planilha não é sobrescrito em silêncio', () => {
    const banco = noBanco(dem('a', { prioridade: 'Baixa' }), { campos_manuais: ['prioridade'] });
    const r = D.classificarDemandas([dem('a', { prioridade: 'Alta' })], mapa(banco));
    assert.strictEqual(r.conflitos.length, 1);
    assert.deepStrictEqual({ c: r.conflitos[0].campo, atual: r.conflitos[0].atual, plan: r.conflitos[0].planilha }, { c: 'prioridade', atual: 'Baixa', plan: 'Alta' });
    assert.strictEqual(r.inalteradas.length, 1);          // mantendo, nada é gravado
});
teste('conflito resolvido como "sobrescrever" vira atualização', () => {
    const banco = noBanco(dem('a', { prioridade: 'Baixa' }), { campos_manuais: ['prioridade'] });
    const r = D.classificarDemandas([dem('a', { prioridade: 'Alta' })], mapa(banco), { a: ['prioridade'] });
    assert.strictEqual(r.conflitos.length, 0);
    assert.deepStrictEqual(r.atualizadas[0]._mudancas, ['prioridade']);
});
teste('campo manual que já coincide com a planilha não é conflito', () => {
    const banco = noBanco(dem('a'), { campos_manuais: ['prioridade', 'status'] });
    assert.strictEqual(D.classificarDemandas([dem('a')], mapa(banco)).conflitos.length, 0);
});
teste('campo NÃO editado à mão muda normalmente mesmo havendo outro campo protegido', () => {
    const banco = noBanco(dem('a', { prioridade: 'Baixa' }), { campos_manuais: ['prioridade'] });
    const r = D.classificarDemandas([dem('a', { prioridade: 'Alta', responsavel: 'Bia' })], mapa(banco));
    assert.strictEqual(r.conflitos.length, 1);
    assert.deepStrictEqual(r.atualizadas[0]._mudancas, ['responsavel']);
});

// ===== tratativas =====
const tr = (id, quando, texto) => ({ gmail_thread_id: id, ocorrida_em: quando, autor_tipo: 'SCONT', autor: null, descricao: texto });
teste('tratativas: novas entram; já existentes e repetidas no arquivo não', () => {
    const existentes = new Map([['a', new Set([P.chaveTratativa('2026-11-03T12:10:00-03:00', 'Primeira')])]]);
    const lista = [
        tr('a', '2026-11-03T12:10:00-03:00', 'Primeira'),
        tr('a', '2026-11-03T15:10:00+00:00', ' primeira '),     // mesma, outro fuso/caixa
        tr('a', '2026-11-04T09:00:00-03:00', 'Segunda'),
        tr('a', '2026-11-04T09:00:00-03:00', 'Segunda'),         // repetida no arquivo
        tr('zzz', '2026-11-04T09:00:00-03:00', 'Órfã'),
    ];
    const r = D.tratativasNovas(lista, existentes, new Set(['a']));
    assert.deepStrictEqual(r.novas.map(t => t.descricao), ['Segunda']);
    assert.strictEqual(r.semDemanda.length, 1);
});
teste('IDEMPOTÊNCIA de tratativas: reimportar tudo => zero novas', () => {
    const lista = [tr('a', '2026-11-03T12:10:00-03:00', 'x'), tr('a', '2026-11-04T09:00:00-03:00', 'y')];
    const ex = new Map([['a', new Set(lista.map(t => P.chaveTratativa(t.ocorrida_em, t.descricao)))]]);
    assert.strictEqual(D.tratativasNovas(lista, ex, new Set(['a'])).novas.length, 0);
});

console.log(`\n${n} testes passaram.`);
