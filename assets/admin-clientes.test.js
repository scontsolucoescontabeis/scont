const test = require('node:test');
const assert = require('node:assert');
const AC = require('./admin-clientes.js');

test('montarApoio: exato em sócio', () => {
  const r = AC.montarApoio('João da Silva', ['joao da silva', 'Outro'], []);
  assert.deepStrictEqual(r, { tipo: 'exato', rotulo: '✔ Exato: sócio' });
});
test('montarApoio: parcial em empregado', () => {
  const r = AC.montarApoio('Maria Souza', [], ['Maria Aparecida Souza']);
  assert.deepStrictEqual(r, { tipo: 'parcial', rotulo: '~ Parcial: empregado' });
});
test('montarApoio: exato vence parcial', () => {
  const r = AC.montarApoio('Maria Souza', ['Maria Aparecida Souza'], ['Maria Souza']);
  assert.strictEqual(r.tipo, 'exato');
  assert.strictEqual(r.rotulo, '✔ Exato: empregado');
});
test('montarApoio: exato em sócio e empregado', () => {
  const r = AC.montarApoio('Ana Lima', ['Ana Lima'], ['Ana Lima']);
  assert.strictEqual(r.rotulo, '✔ Exato: sócio, empregado');
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
