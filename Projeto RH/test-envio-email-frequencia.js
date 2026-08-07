const assert = require('node:assert');
const { _dividirEmails, _resolverDestinatariosEnvio } = require('./envio-email-frequencia.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

teste('_dividirEmails separa por vírgula, remove espaços e vazios', () => {
    assert.deepStrictEqual(_dividirEmails('a@x.com, b@x.com ,, c@x.com'), ['a@x.com', 'b@x.com', 'c@x.com']);
});

teste('_dividirEmails lida com null/undefined/vazio', () => {
    assert.deepStrictEqual(_dividirEmails(null), []);
    assert.deepStrictEqual(_dividirEmails(undefined), []);
    assert.deepStrictEqual(_dividirEmails(''), []);
});

teste('_dividirEmails remove duplicados', () => {
    assert.deepStrictEqual(_dividirEmails('a@x.com, a@x.com'), ['a@x.com']);
});

teste('empresa sem grupo marcado usa o e-mail individual', () => {
    const { destinatarios, semEmail } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] }],
        gruposMarcadosIds: [],
        gruposInfo: [],
        itensGruposCache: {},
        emailPorEmpresa: { '100': 'financeiro@empresaa.com' },
    });
    assert.strictEqual(destinatarios.length, 1);
    assert.strictEqual(destinatarios[0].email, 'financeiro@empresaa.com');
    assert.strictEqual(destinatarios[0].origem, 'empresa');
    assert.strictEqual(destinatarios[0].nomeOrigem, 'Empresa A');
    assert.deepStrictEqual(destinatarios[0].empresas, ['Empresa A']);
    assert.deepStrictEqual(destinatarios[0].arquivos, [{ nome: 'a.pdf', blob: 'BLOB_A' }]);
    assert.deepStrictEqual(semEmail, []);
});

teste('empresa sem e-mail cadastrado entra em semEmail', () => {
    const { destinatarios, semEmail } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [] }],
        gruposMarcadosIds: [],
        gruposInfo: [],
        itensGruposCache: {},
        emailPorEmpresa: {},
    });
    assert.deepStrictEqual(destinatarios, []);
    assert.deepStrictEqual(semEmail, ['Empresa A']);
});

teste('grupo marcado com e-mail agrupa os anexos das empresas do grupo', () => {
    const { destinatarios, semEmail } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [
            { codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] },
            { codigoEmpresa: '200', nomeEmpresa: 'Empresa B', arquivos: [{ nome: 'b.pdf', blob: 'BLOB_B' }] },
        ],
        gruposMarcadosIds: ['g1'],
        gruposInfo: [{ id: 'g1', nome_grupo: 'Grupo Shopping X', email_responsavel: 'grupo@shoppingx.com' }],
        itensGruposCache: { g1: new Set(['100', '200']) },
        emailPorEmpresa: { '100': 'a@a.com', '200': 'b@b.com' },
    });
    assert.strictEqual(destinatarios.length, 1);
    assert.strictEqual(destinatarios[0].email, 'grupo@shoppingx.com');
    assert.strictEqual(destinatarios[0].origem, 'grupo');
    assert.strictEqual(destinatarios[0].nomeOrigem, 'Grupo Shopping X');
    assert.deepStrictEqual(destinatarios[0].empresas, ['Empresa A', 'Empresa B']);
    assert.deepStrictEqual(destinatarios[0].arquivos, [{ nome: 'a.pdf', blob: 'BLOB_A' }, { nome: 'b.pdf', blob: 'BLOB_B' }]);
    assert.deepStrictEqual(semEmail, []);
});

teste('grupo marcado sem e-mail cadastrado cai para o e-mail individual da empresa', () => {
    const { destinatarios } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] }],
        gruposMarcadosIds: ['g1'],
        gruposInfo: [{ id: 'g1', nome_grupo: 'Grupo Shopping X', email_responsavel: null }],
        itensGruposCache: { g1: new Set(['100']) },
        emailPorEmpresa: { '100': 'a@a.com' },
    });
    assert.strictEqual(destinatarios.length, 1);
    assert.strictEqual(destinatarios[0].email, 'a@a.com');
    assert.strictEqual(destinatarios[0].origem, 'empresa');
});

teste('e-mail com múltiplos endereços gera um destinatário por endereço, mesmos anexos', () => {
    const { destinatarios } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] }],
        gruposMarcadosIds: [],
        gruposInfo: [],
        itensGruposCache: {},
        emailPorEmpresa: { '100': 'a@a.com, b@a.com' },
    });
    assert.strictEqual(destinatarios.length, 2);
    assert.deepStrictEqual(destinatarios.map(d => d.email).sort(), ['a@a.com', 'b@a.com']);
    destinatarios.forEach(d => assert.deepStrictEqual(d.arquivos, [{ nome: 'a.pdf', blob: 'BLOB_A' }]));
});

teste('empresa em dois grupos marcados usa o primeiro grupo da lista', () => {
    const { destinatarios } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] }],
        gruposMarcadosIds: ['g1', 'g2'],
        gruposInfo: [
            { id: 'g1', nome_grupo: 'Grupo 1', email_responsavel: 'g1@x.com' },
            { id: 'g2', nome_grupo: 'Grupo 2', email_responsavel: 'g2@x.com' },
        ],
        itensGruposCache: { g1: new Set(['100']), g2: new Set(['100']) },
        emailPorEmpresa: {},
    });
    assert.strictEqual(destinatarios.length, 1);
    assert.strictEqual(destinatarios[0].email, 'g1@x.com');
});

console.log(`\n${testesExecutados} teste(s) executado(s) com sucesso.`);
