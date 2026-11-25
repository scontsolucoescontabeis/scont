const test = require('node:test');
const assert = require('node:assert');
const AC = require('./admin-clientes.js');

test('montarApoio: exato em sócio', () => {
  const r = AC.montarApoio('João da Silva', ['joao da silva', 'Outro'], []);
  assert.deepStrictEqual(r, { tipo: 'exato', rotulo: 'Nome coincide com sócio — confirmar com a empresa' });
});
test('montarApoio: parcial em empregado', () => {
  const r = AC.montarApoio('Maria Souza', [], ['Maria Aparecida Souza']);
  assert.deepStrictEqual(r, { tipo: 'parcial', rotulo: 'Nome parecido com empregado — confirmar com a empresa' });
});
test('montarApoio: exato vence parcial', () => {
  const r = AC.montarApoio('Maria Souza', ['Maria Aparecida Souza'], ['Maria Souza']);
  assert.strictEqual(r.tipo, 'exato');
  assert.strictEqual(r.rotulo, 'Nome coincide com empregado — confirmar com a empresa');
});
test('montarApoio: exato em sócio e empregado', () => {
  const r = AC.montarApoio('Ana Lima', ['Ana Lima'], ['Ana Lima']);
  assert.strictEqual(r.rotulo, 'Nome coincide com sócio, empregado — confirmar com a empresa');
});
test('montarApoio: nenhum e entradas inválidas', () => {
  assert.deepStrictEqual(AC.montarApoio('Fulano Tal', ['Beltrano'], []), { tipo: 'nenhum', rotulo: 'Nenhuma correspondência' });
  assert.strictEqual(AC.montarApoio('', null, undefined).tipo, 'nenhum');
});
test('agruparPorStatus', () => {
  const g = AC.agruparPorStatus([
    { id: 1, status: 'pendente' }, { id: 2, status: 'aprovado' },
    { id: 3, status: 'recusado' }, { id: 4, status: 'revogado' }, { id: 5, status: 'x' },
  ]);
  assert.deepStrictEqual(g.pendentes.map(a => a.id), [1]);
  assert.deepStrictEqual(g.liberados.map(a => a.id), [2]);
  assert.deepStrictEqual(g.encerrados.map(a => a.id), [3, 4]);
  assert.deepStrictEqual(AC.agruparPorStatus(null), { pendentes: [], liberados: [], encerrados: [] });
});
test('validarDecisao', () => {
  assert.strictEqual(AC.validarDecisao('aprovado', '').ok, true);
  assert.strictEqual(AC.validarDecisao('recusado', '   ').ok, false);
  assert.ok(AC.validarDecisao('recusado', null).erro);
  assert.strictEqual(AC.validarDecisao('revogado', 'saiu da empresa').ok, true);
  assert.strictEqual(AC.validarDecisao('revogado', '').ok, false);
  assert.strictEqual(AC.validarDecisao('pendente', 'x').ok, false);
  assert.strictEqual(AC.validarDecisao(undefined, 'x').ok, false);
});

function fakeFetch(total) {
  const calls = [];
  const fn = async (from, to) => {
    calls.push([from, to]);
    const n = Math.max(0, Math.min(to, total - 1) - from + 1);
    return Array.from({ length: n }, (_, i) => from + i);
  };
  fn.calls = calls;
  return fn;
}
test('paginar: 0 linhas', async () => {
  const r = await AC.paginar(fakeFetch(0));
  assert.deepStrictEqual(r, { rows: [], truncado: false });
});
test('paginar: exatamente 1000 busca a pagina seguinte e nao trunca', async () => {
  const f = fakeFetch(1000);
  const r = await AC.paginar(f);
  assert.strictEqual(r.rows.length, 1000);
  assert.strictEqual(r.truncado, false);
  assert.deepStrictEqual(f.calls, [[0, 999], [1000, 1999]]);
});
test('paginar: 2500 linhas em 3 paginas', async () => {
  const r = await AC.paginar(fakeFetch(2500));
  assert.strictEqual(r.rows.length, 2500);
  assert.strictEqual(r.truncado, false);
});
test('paginar: limite de paginas marca truncado', async () => {
  const r = await AC.paginar(fakeFetch(100000), 1000, 3);
  assert.strictEqual(r.rows.length, 3000);
  assert.strictEqual(r.truncado, true);
});
test('montarApoio: truncado sem correspondencia', () => {
  assert.deepStrictEqual(AC.montarApoio('Fulano Tal', ['Beltrano'], [], true),
    { tipo: 'truncado', rotulo: 'Base truncada — conferir manualmente' });
  assert.strictEqual(AC.montarApoio('Ana Lima', ['Ana Lima'], [], true).tipo, 'exato');
});

test('montarApoio: rótulo nunca afirma identidade (nomes de sócios são públicos)', () => {
  for (const r of [AC.montarApoio('Ana Lima', ['Ana Lima'], []), AC.montarApoio('Maria Souza', [], ['Maria Aparecida Souza'])]) {
    assert.ok(/confirmar com a empresa/.test(r.rotulo), r.rotulo);
    assert.ok(!/Exato|✔/.test(r.rotulo), r.rotulo);
  }
});

test('statusAnteriorEsperado: decisão só vale sobre o status mostrado na tela', () => {
  assert.strictEqual(AC.statusAnteriorEsperado('aprovado'), 'pendente');
  assert.strictEqual(AC.statusAnteriorEsperado('recusado'), 'pendente');
  assert.strictEqual(AC.statusAnteriorEsperado('revogado'), 'aprovado');
  assert.strictEqual(AC.statusAnteriorEsperado('pendente'), null);
  assert.strictEqual(AC.statusAnteriorEsperado(undefined), null);
});

test('emailsDeClientes: conjunto normalizado (minúsculas, sem espaços, ignora vazios)', () => {
  const s = AC.emailsDeClientes([{ email: ' Ana@Cliente.COM ' }, { email: null }, {}, null, { email: 'b@x.com' }]);
  assert.ok(s instanceof Set);
  assert.deepStrictEqual([...s].sort(), ['ana@cliente.com', 'b@x.com']);
  assert.strictEqual(AC.ehEmailCliente(s, 'ANA@cliente.com'), true);
  assert.strictEqual(AC.ehEmailCliente(s, 'outro@x.com'), false);
  assert.strictEqual(AC.ehEmailCliente(s, null), false);
  assert.strictEqual(AC.emailsDeClientes(null).size, 0);
});

// Verificações estáticas do admin-dashboard.html (script inline, sem DOM nos testes)
const fs = require('node:fs');
const path = require('node:path');
const dash = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');
function corpoFuncao(fonte, nome) {
  const i = fonte.indexOf('async function ' + nome + '(');
  assert.ok(i >= 0, 'função ' + nome + ' não encontrada');
  const prox = /\n(async )?function /g;
  prox.lastIndex = i + 10;
  const m = prox.exec(fonte);
  return fonte.slice(i, m ? m.index : undefined);
}
test('decidirAcessoCliente: update condicionado ao status anterior e mensagem de conflito', () => {
  const f = corpoFuncao(dash, 'decidirAcessoCliente');
  assert.ok(/\.eq\('status',\s*anterior\)/.test(f), 'falta .eq(status, anterior) no update');
  assert.ok(f.includes('statusAnteriorEsperado('), 'falta statusAnteriorEsperado');
  assert.ok(f.includes('o pedido mudou; recarregue'), 'falta mensagem de conflito');
});
test('Solicitações: marca e-mail de cliente com aviso', () => {
  const f = corpoFuncao(dash, 'loadSolicitacoes');
  assert.ok(f.includes("from('cliente_usuarios')"), 'loadSolicitacoes não consulta cliente_usuarios');
  assert.ok(dash.includes('e-mail de cliente — aprovar dá acesso interno'), 'falta texto do aviso');
});
