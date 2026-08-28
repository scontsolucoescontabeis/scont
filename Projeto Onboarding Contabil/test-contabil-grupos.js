const assert = require('assert');
const { montarGrupos, filtrarPorGrupo } = require('./contabil-grupos.js');

// ─── montarGrupos ──────────────────────────────────────────────

const gruposRows = [
  { id: 'g1', nome_grupo: 'Shopping Sul', observacoes: 'obs 1', email_responsavel: 'a@x.com' },
  { id: 'g2', nome_grupo: 'Alfa', observacoes: '', email_responsavel: null },
  { id: 'g3', nome_grupo: 'Beta', observacoes: '', email_responsavel: '' },
];
const itensRows = [
  { grupo_id: 'g1', codigo_empresa: '001' },
  { grupo_id: 'g1', codigo_empresa: '002' },
  { grupo_id: 'g2', codigo_empresa: '003' },
];
const configRows = [
  { grupo_id: 'g1', usar_contabil: true },
  { grupo_id: 'g2', usar_contabil: false },
];

const montados = montarGrupos(gruposRows, itensRows, configRows);

assert.deepStrictEqual(
  montados.map((g) => g.nome_grupo),
  ['Alfa', 'Beta', 'Shopping Sul'],
  'ordena por nome_grupo (locale pt-BR)'
);
console.log('OK: montarGrupos ordena por nome_grupo');

const g1 = montados.find((g) => g.id === 'g1');
assert.ok(g1.empresas instanceof Set, 'empresas é Set');
assert.deepStrictEqual([...g1.empresas].sort(), ['001', '002']);
assert.strictEqual(g1.usarContabil, true, 'usar_contabil true respeitado');
console.log('OK: montarGrupos monta empresas como Set e lê usarContabil');

const g2 = montados.find((g) => g.id === 'g2');
assert.strictEqual(g2.usarContabil, false, 'usar_contabil false explícito');

const g3 = montados.find((g) => g.id === 'g3');
assert.strictEqual(g3.usarContabil, false, 'sem linha em config => usarContabil false (opt-in)');
assert.strictEqual(g3.empresas.size, 0, 'grupo sem itens => Set vazio');
console.log('OK: montarGrupos default opt-in quando não há linha de config');

assert.deepStrictEqual(montarGrupos(null, null, null), [], 'entradas nulas => []');
console.log('OK: montarGrupos tolera entradas nulas');

// ─── filtrarPorGrupo ───────────────────────────────────────────

// _grupos internos não são acessíveis aqui; filtrarPorGrupo recebe o
// conjunto de códigos resolvido por quem chama. Assinatura:
// filtrarPorGrupo(lista, codigosSet, getCodigo)
const lista = [
  { codigo_empresa: '001', nome: 'Um' },
  { codigo_empresa: '002', nome: 'Dois' },
  { codigo_empresa: '009', nome: 'Nove' },
];

assert.strictEqual(
  filtrarPorGrupo(lista, null, (x) => x.codigo_empresa),
  lista,
  'codigosSet nulo => lista intacta (mesma referência)'
);
console.log('OK: filtrarPorGrupo sem grupo devolve a lista original');

assert.deepStrictEqual(
  filtrarPorGrupo(lista, new Set(['001', '002']), (x) => x.codigo_empresa).map((x) => x.nome),
  ['Um', 'Dois']
);
console.log('OK: filtrarPorGrupo faz interseção pelo código');

assert.deepStrictEqual(
  filtrarPorGrupo(lista, new Set(), (x) => x.codigo_empresa),
  [],
  'grupo sem empresas => nada passa'
);
console.log('OK: filtrarPorGrupo com Set vazio devolve []');

assert.deepStrictEqual(
  filtrarPorGrupo(
    [{ cod: 'A' }, { cod: 'B' }],
    new Set(['B']),
    (x) => x.cod
  ),
  [{ cod: 'B' }],
  'getCodigo customizável'
);
console.log('OK: filtrarPorGrupo aceita getCodigo customizado');

console.log('\nTodos os testes de contabil-grupos passaram.');
