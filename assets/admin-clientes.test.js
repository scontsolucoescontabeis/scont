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
