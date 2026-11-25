'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizarNome, acharApoio } = require('./nome-apoio.js');

test('normalizarNome remove acentos, pontuação, caixa e espaços extras', () => {
  assert.strictEqual(normalizarNome('  José  da SILVA. '), 'jose da silva');
});

test('normalizarNome aceita null e undefined sem lançar erro', () => {
  assert.strictEqual(normalizarNome(null), '');
  assert.strictEqual(normalizarNome(undefined), '');
});

test('acharApoio retorna exato quando nomes normalizados são iguais', () => {
  const r = acharApoio('JOSE DA SILVA', [{ nome: 'José da Silva', origem: 'sócio' }]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].tipo, 'exato');
  assert.strictEqual(r[0].nome, 'José da Silva');
  assert.strictEqual(r[0].origem, 'sócio');
});

test('acharApoio retorna parcial quando todos os termos do menor nome estão no maior', () => {
  const r = acharApoio('Jose Silva', [{ nome: 'José Carlos da Silva', origem: 'empregado' }]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].tipo, 'parcial');
  assert.strictEqual(r[0].origem, 'empregado');
});

test('acharApoio não gera parcial para nome com 1 termo', () => {
  assert.deepStrictEqual(acharApoio('Maria', [{ nome: 'Maria Souza', origem: 'sócio' }]), []);
});

test('acharApoio retorna exato para nome de 1 termo idêntico', () => {
  const r = acharApoio('maria', [{ nome: 'Maria', origem: 'sócio' }]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].tipo, 'exato');
});

test('acharApoio retorna [] para nome vazio ou só espaços', () => {
  const pessoas = [{ nome: 'José da Silva', origem: 'sócio' }];
  assert.deepStrictEqual(acharApoio('', pessoas), []);
  assert.deepStrictEqual(acharApoio('   ', pessoas), []);
});

test('acharApoio aceita nome null/undefined sem lançar erro', () => {
  const pessoas = [{ nome: 'José da Silva', origem: 'sócio' }];
  assert.deepStrictEqual(acharApoio(null, pessoas), []);
  assert.deepStrictEqual(acharApoio(undefined, pessoas), []);
});

test('acharApoio ignora pessoa sem nome', () => {
  const r = acharApoio('José da Silva', [
    { origem: 'sócio' },
    { nome: null, origem: 'empregado' },
    { nome: 'José da Silva', origem: 'empregado' },
  ]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].origem, 'empregado');
});

test('acharApoio ordena exatos antes de parciais, preservando ordem de entrada em cada grupo', () => {
  const r = acharApoio('Jose Silva', [
    { nome: 'Jose Carlos Silva', origem: 'parcial-1' },
    { nome: 'Jose Silva', origem: 'exato-1' },
    { nome: 'Jose Maria Silva', origem: 'parcial-2' },
    { nome: 'JOSÉ SILVA.', origem: 'exato-2' },
  ]);
  assert.deepStrictEqual(
    r.map((x) => [x.origem, x.tipo]),
    [
      ['exato-1', 'exato'],
      ['exato-2', 'exato'],
      ['parcial-1', 'parcial'],
      ['parcial-2', 'parcial'],
    ]
  );
});

test('acharApoio retorna cada pessoa no máximo uma vez', () => {
  const pessoa = { nome: 'José Silva', origem: 'sócio' };
  const r = acharApoio('José Silva', [pessoa]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].tipo, 'exato');
});
