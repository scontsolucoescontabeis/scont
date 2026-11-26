const test = require('node:test');
const assert = require('node:assert');
const { decidirEstado, normalizarBusca, urlMontador } = require('./estado.js');

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

// Verificação estática do acesso.js: admin lê todos os vínculos, então a
// consulta de cliente_acessos precisa filtrar pelo próprio usuário.
test('acesso.js: cliente_acessos filtrado por usuario_id do usuário logado', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, 'acesso.js'), 'utf8');
    const m = src.match(/from\('cliente_acessos'\)[^;]*;/);
    assert.ok(m, 'consulta de cliente_acessos não encontrada');
    assert.ok(/\.eq\('usuario_id',\s*user\.id\)/.test(m[0]), 'falta .eq(usuario_id, user.id): ' + m[0]);
});

test('normalizarBusca: minúsculas, sem acento, espaços colapsados', () => {
    assert.strictEqual(normalizarBusca('  Padaria  PÃO Quente '), 'padaria pao quente');
    assert.strictEqual(normalizarBusca('Açaí & Cia.'), 'acai & cia.');
});

test('normalizarBusca: null, undefined e número não quebram', () => {
    assert.strictEqual(normalizarBusca(null), '');
    assert.strictEqual(normalizarBusca(undefined), '');
    assert.strictEqual(normalizarBusca(123), '123');
});

// Modo administrador: o admin é detectado por usuarios.is_admin e carrega rh_empresas ANTES
// da checagem de perfil de cliente (senão seria deslogado com "Esta área é para clientes").
test('acesso.js: administrador é tratado antes da checagem de perfil de cliente', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, 'acesso.js'), 'utf8');
    const iAdmin = src.indexOf("from('usuarios')");
    const iPerfil = src.indexOf("from('cliente_usuarios')");
    assert.ok(iAdmin > 0 && iPerfil > 0 && iAdmin < iPerfil, 'checagem de admin deve vir antes do perfil de cliente');
    assert.ok(/is_admin\s*===\s*true/.test(src), 'deve exigir is_admin === true');
    assert.ok(/from\('rh_empresas'\)/.test(src), 'admin deve listar rh_empresas');
});

test('urlMontador monta o link com o código codificado', () => {
    assert.strictEqual(urlMontador('123'), '../Projeto Montador Escala 5x2/app/index.html?empresa=123');
    assert.strictEqual(urlMontador('A&B 1?'),
        '../Projeto Montador Escala 5x2/app/index.html?empresa=' + encodeURIComponent('A&B 1?'));
    assert.ok(urlMontador('Ação').endsWith('?empresa=A%C3%A7%C3%A3o'));
});

test('urlMontador devolve vazio para código vazio/nulo', () => {
    for (const v of ['', null, undefined]) assert.strictEqual(urlMontador(v), '');
});

test('portal.js: Montador usa urlMontador com a empresa atual', () => {
    const fs = require('node:fs'), path = require('node:path');
    const js = fs.readFileSync(path.join(__dirname, 'portal.js'), 'utf8');
    assert.ok(/nome:\s*'Montador de Escala 5x2'[\s\S]*?url:\s*\(codigo\)\s*=>\s*E\.urlMontador\(codigo\)/.test(js),
        'ferramenta Montador deve usar urlMontador(codigo)');
    assert.ok(/f\.url\(empresaAtual\)/.test(js), 'card deve montar o link com a empresa atual');
});

test('iniciais: duas primeiras palavras significativas, maiúsculas', () => {
    const { iniciais } = require('./estado.js');
    assert.strictEqual(iniciais('Padaria Pão Quente Ltda'), 'PP');
    assert.strictEqual(iniciais('herbert gomes'), 'HG');
    assert.strictEqual(iniciais('  scont   soluções  '), 'SS');
});

test('iniciais: ignora conectores de/da/do/dos/das/e', () => {
    const { iniciais } = require('./estado.js');
    assert.strictEqual(iniciais('Casa de Carnes'), 'CC');
    assert.strictEqual(iniciais('Maria da Silva'), 'MS');
    assert.strictEqual(iniciais('Pães e Doces'), 'PD');
    assert.strictEqual(iniciais('Comércio dos Dos DAS Santos'), 'CS');
});

test('iniciais: mantém acentos e usa no máximo 2 letras', () => {
    const { iniciais } = require('./estado.js');
    assert.strictEqual(iniciais('ética ótica'), 'ÉÓ');
    assert.strictEqual(iniciais('Ótica'), 'ÓT');
    assert.strictEqual(iniciais('X'), 'X');
    assert.ok(iniciais('Um Dois Três Quatro').length <= 2);
});

test('iniciais: pontuação não conta como letra', () => {
    const { iniciais } = require('./estado.js');
    assert.strictEqual(iniciais('A&B Serviços'), 'AB');
    assert.strictEqual(iniciais('(Grupo) Alfa'), 'GA');
});

test('iniciais: vazio, nulo, só conectores ou só símbolos => "?" ou fallback', () => {
    const { iniciais } = require('./estado.js');
    for (const v of ['', '   ', null, undefined, '---']) assert.strictEqual(iniciais(v), '?');
    assert.strictEqual(iniciais('de'), 'DE');
});

// Segurança: nomes vêm do banco; nada de innerHTML no cliente.
test('login.js, portal.js e acesso.js não usam innerHTML', () => {
    const fs = require('node:fs'), path = require('node:path');
    for (const f of ['login.js', 'portal.js', 'acesso.js']) {
        const js = fs.readFileSync(path.join(__dirname, f), 'utf8');
        assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(js), f);
    }
});

test('portal.js: ferramentas "em breve" não viram links', () => {
    const fs = require('node:fs'), path = require('node:path');
    const js = fs.readFileSync(path.join(__dirname, 'portal.js'), 'utf8');
    assert.strictEqual((js.match(/url:\s*null/g) || []).length, 2, 'duas ferramentas em breve');
    assert.ok(/if \(href\)[\s\S]*?createElement\('a'\)[\s\S]*?else[\s\S]*?aria-disabled/.test(js));
});

test('portal.html exige sessão: sem clienteAuth volta ao login', () => {
    const fs = require('node:fs'), path = require('node:path');
    const js = fs.readFileSync(path.join(__dirname, 'portal.js'), 'utf8');
    assert.ok(/const salvo = A\.lerAuth\(\);\s*if \(!salvo\) \{ irParaLogin\(\)/.test(js));
});
