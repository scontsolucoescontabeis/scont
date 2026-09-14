const assert = require('node:assert');
const F = require('../js/fontes.js');

let n = 0;
async function teste(nome, fn) { await fn(); n++; console.log(`OK  ${nome}`); }

function clienteFalso(linhasPorTabela, erroPorTabela = {}) {
    const chamadas = [];
    return {
        chamadas,
        from(tabela) {
            const estado = { tabela, de: 0, ate: 0 };
            const q = {
                select() { return q; }, order() { return q; }, eq() { return q; }, is() { return q; },
                not() { return q; }, gte() { return q; }, in() { return q; }, limit() { return q; },
                range(de, ate) { estado.de = de; estado.ate = ate; return q; },
                then(resolve) {
                    chamadas.push(`${tabela}:${estado.de}`);
                    if (erroPorTabela[tabela]) return resolve({ data: null, error: erroPorTabela[tabela], status: 400 });
                    const todas = linhasPorTabela[tabela] || [];
                    return resolve({ data: todas.slice(estado.de, estado.ate + 1), error: null, status: 200 });
                },
            };
            return q;
        },
        rpc() { return Promise.resolve({ data: [{ id: 'k1', nome: 'Caio' }], error: null }); },
    };
}

(async () => {
    await teste('classificarErro', () => {
        assert.strictEqual(F.classificarErro(null), null);
        assert.strictEqual(F.classificarErro({ code: '42P01' }), 'tabela_ausente');
        assert.strictEqual(F.classificarErro({ code: 'PGRST205', message: 'Could not find the table' }), 'tabela_ausente');
        assert.strictEqual(F.classificarErro({ code: '42501' }), 'sem_permissao');
        assert.strictEqual(F.classificarErro({ status: 403 }), 'sem_permissao');
        assert.strictEqual(F.classificarErro({ message: 'boom' }), 'erro');
    });

    await teste('buscarTodos pagina de 1000 em 1000', async () => {
        const linhas = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
        const sb = clienteFalso({ t: linhas });
        const res = await F.buscarTodos(sb, { tabela: 't', colunas: 'id', ordem: 'id' }, '2026-09-14');
        assert.strictEqual(res.length, 2500);
        assert.deepStrictEqual(sb.chamadas, ['t:0', 't:1000', 't:2000']);
    });

    await teste('carregarCarteira separa dados e falhas sem derrubar o resto', async () => {
        const sb = clienteFalso(
            { rh_empresas: [{ id: 'u1', codigo_empresa: '1' }] },
            { ficha360_empresa: { code: '42P01', message: 'relation does not exist' } }
        );
        const { dados, falhas } = await F.carregarCarteira(sb, '2026-09-14');
        assert.strictEqual(dados.empresas.length, 1);
        assert.strictEqual(dados.fichas, null);
        assert.strictEqual(falhas.fichas, 'tabela_ausente');
        assert.deepStrictEqual(dados.usuariosContabil, [{ id: 'k1', nome: 'Caio' }]);
        assert.ok(Object.keys(F.FONTES).every(k => k in dados));
    });

    console.log(`\n${n} testes OK`);
})().catch(e => { console.error(e); process.exit(1); });
