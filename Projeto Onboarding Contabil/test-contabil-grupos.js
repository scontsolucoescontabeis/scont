const assert = require('assert');
const { montarGrupos, filtrarPorGrupo, montarUnidades, expandirResponsaveis, ehChaveGrupo, idDoGrupoNaChave } = require('./contabil-grupos.js');

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

// ─── ehChaveGrupo / idDoGrupoNaChave ──────────────────────────

assert.strictEqual(ehChaveGrupo('grupo-abc-123'), true);
assert.strictEqual(ehChaveGrupo('453'), false);
assert.strictEqual(ehChaveGrupo(null), false);
assert.strictEqual(idDoGrupoNaChave('grupo-abc-123'), 'abc-123');
assert.strictEqual(idDoGrupoNaChave('453'), null);
console.log('OK: ehChaveGrupo / idDoGrupoNaChave');

// ─── montarUnidades ──────────────────────────────────────────

const todasAtivas = [
  { codigo_empresa: '001', nome_empresa: 'Alfa', regime_enquadramento: 'Simples' },
  { codigo_empresa: '002', nome_empresa: 'Beta' },
  { codigo_empresa: '003', nome_empresa: 'Gama' },
  { codigo_empresa: '004', nome_empresa: 'Delta' },
];
const comContabil = todasAtivas.filter((e) => e.codigo_empresa !== '004'); // 004 sem possui_contabil
const gruposContabil = [
  { id: 'g1', nome_grupo: 'Grupo Sul', empresas: new Set(['001', '004']) }, // 004 entra mesmo sem possui_contabil
];

const unidades = montarUnidades(comContabil, todasAtivas, gruposContabil);
assert.deepStrictEqual(
  unidades.map((u) => u.nome_empresa),
  ['Beta', 'Gama', 'Grupo Sul'],
  'membros do grupo saem da lista; grupo entra; ordenado por nome'
);
const uGrupo = unidades.find((u) => u.is_grupo);
assert.strictEqual(uGrupo.codigo_empresa, 'grupo-g1');
assert.deepStrictEqual(uGrupo.membros_codigos.sort(), ['001', '004'], 'membros incluem os sem possui_contabil');
assert.strictEqual(uGrupo.membros_nomes, 'Alfa, Delta');
assert.ok(!unidades.some((u) => u.codigo_empresa === '001'), '001 (membro) não aparece avulso');
console.log('OK: montarUnidades absorve membros e adiciona a unidade-grupo');

const unidadesSemGrupo = montarUnidades(comContabil, todasAtivas, []);
assert.deepStrictEqual(unidadesSemGrupo.map((u) => u.codigo_empresa).sort(), ['001', '002', '003']);
console.log('OK: montarUnidades sem grupos = lista original');

// membro inativo (não está em todasAtivas) é ignorado na composição
const unidades2 = montarUnidades(comContabil, todasAtivas, [
  { id: 'g2', nome_grupo: 'Grupo X', empresas: new Set(['002', '999']) },
]);
assert.deepStrictEqual(unidades2.find((u) => u.is_grupo).membros_codigos, ['002'], 'código inexistente/inativo some');
console.log('OK: montarUnidades ignora membro inativo');

// ─── expandirResponsaveis ────────────────────────────────────

const unidadesGrupo = [{ is_grupo: true, codigo_empresa: 'grupo-g1', membros_codigos: ['001', '004'] }];
const exp1 = expandirResponsaveis(new Set(['001']), unidadesGrupo);
assert.ok(exp1.has('grupo-g1') && exp1.has('001') && exp1.has('004'), 'responsável por membro cobre a chave do grupo e os demais membros');
const exp2 = expandirResponsaveis(new Set(['grupo-g1']), unidadesGrupo);
assert.ok(exp2.has('001') && exp2.has('004'), 'responsável pela chave do grupo cobre os membros');
const exp3 = expandirResponsaveis(new Set(['777']), unidadesGrupo);
assert.deepStrictEqual([...exp3].sort(), ['777'], 'sem interseção não expande');
console.log('OK: expandirResponsaveis');

console.log('\nTodos os testes de contabil-grupos passaram.');
