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
