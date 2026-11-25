const test = require('node:test');
const assert = require('node:assert');
const { decidirEstado } = require('./estado.js');

test('sem vínculos (vazio, undefined, null) => sem_pedido', () => {
    for (const v of [[], undefined, null]) {
        assert.deepStrictEqual(decidirEstado(v), { estado: 'sem_pedido', empresas: [], motivo: null });
    }
});

test('um aprovado => home com a empresa', () => {
    const r = decidirEstado([{ codigo_empresa: '10', status: 'aprovado' }]);
    assert.deepStrictEqual(r, { estado: 'home', empresas: ['10'], motivo: null });
});

test('um aprovado ignora pendentes e recusados => home', () => {
    const r = decidirEstado([
        { codigo_empresa: '1', status: 'pendente' },
        { codigo_empresa: '2', status: 'aprovado' },
        { codigo_empresa: '3', status: 'recusado', motivo: 'x' },
    ]);
    assert.deepStrictEqual(r, { estado: 'home', empresas: ['2'], motivo: null });
});

test('dois ou mais aprovados => seletor', () => {
    const r = decidirEstado([
        { codigo_empresa: '1', status: 'aprovado' },
        { codigo_empresa: '2', status: 'revogado' },
        { codigo_empresa: '3', status: 'aprovado' },
    ]);
    assert.deepStrictEqual(r, { estado: 'seletor', empresas: ['1', '3'], motivo: null });
});

test('sem aprovado e com pendente => aguardando', () => {
    const r = decidirEstado([
        { codigo_empresa: '1', status: 'recusado', motivo: 'm' },
        { codigo_empresa: '2', status: 'pendente' },
    ]);
    assert.deepStrictEqual(r, { estado: 'aguardando', empresas: [], motivo: null });
});

test('somente recusado/revogado => negado com primeiro motivo não vazio', () => {
    const r = decidirEstado([
        { codigo_empresa: '1', status: 'recusado', motivo: '  ' },
        { codigo_empresa: '2', status: 'revogado', motivo: 'Contrato encerrado' },
        { codigo_empresa: '3', status: 'recusado', motivo: 'Outro' },
    ]);
    assert.deepStrictEqual(r, { estado: 'negado', empresas: [], motivo: 'Contrato encerrado' });
});

test('negado sem motivo => motivo null', () => {
    const r = decidirEstado([{ codigo_empresa: '1', status: 'revogado', motivo: null }]);
    assert.deepStrictEqual(r, { estado: 'negado', empresas: [], motivo: null });
});

// Verificação estática do cliente.js: admin lê todos os vínculos, então a
// consulta de cliente_acessos precisa filtrar pelo próprio usuário.
test('cliente.js: cliente_acessos filtrado por usuario_id do usuário logado', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, 'cliente.js'), 'utf8');
    const m = src.match(/from\('cliente_acessos'\)[^;]*;/);
    assert.ok(m, 'consulta de cliente_acessos não encontrada');
    assert.ok(/\.eq\('usuario_id',\s*user\.id\)/.test(m[0]), 'falta .eq(usuario_id, user.id): ' + m[0]);
});
