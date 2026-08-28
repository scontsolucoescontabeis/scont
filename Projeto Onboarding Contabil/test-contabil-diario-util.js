const assert = require('assert');
const {
  ultimosNMeses, MESES_LABELS, calcularTemposFechamento, formatarDuracaoHumana,
  socioAtivoNoMes, qsaDoMes, mesesDoPeriodoFechamento, analisarQsaPeriodo,
} = require('./contabil-diario-util.js');

assert.deepStrictEqual(
  ultimosNMeses(2026, 3, 6),
  [
    { ano: 2025, mes: 10 },
    { ano: 2025, mes: 11 },
    { ano: 2025, mes: 12 },
    { ano: 2026, mes: 1 },
    { ano: 2026, mes: 2 },
    { ano: 2026, mes: 3 },
  ]
);
console.log('OK: ultimosNMeses cruza virada de ano corretamente');

assert.deepStrictEqual(
  ultimosNMeses(2026, 7, 1),
  [{ ano: 2026, mes: 7 }]
);
console.log('OK: ultimosNMeses com n=1 retorna só o mês atual');

assert.strictEqual(MESES_LABELS.length, 12);
assert.strictEqual(MESES_LABELS[0], 'JAN');
assert.strictEqual(MESES_LABELS[11], 'DEZ');
console.log('OK: MESES_LABELS tem 12 meses, JAN a DEZ');

// ─── calcularTemposFechamento ────────────────────────────────

assert.strictEqual(calcularTemposFechamento([]), null);
assert.strictEqual(calcularTemposFechamento(null), null);
console.log('OK: calcularTemposFechamento sem eventos -> null');

assert.strictEqual(calcularTemposFechamento([
  { valor_novo: 'Em Andamento', created_at: '2026-08-01T09:00:00Z' },
  { valor_novo: 'Pendência', created_at: '2026-08-02T09:00:00Z' },
]), null);
console.log('OK: calcularTemposFechamento sem "Concluído" ainda -> null (nada a mostrar)');

// Sem pendência: Em Andamento -> Concluído direto, 1 dia inteiro.
{
  const r = calcularTemposFechamento([
    { valor_novo: 'Em Andamento', created_at: '2026-08-01T09:00:00Z' },
    { valor_novo: 'Concluído', created_at: '2026-08-02T09:00:00Z' },
  ]);
  assert.strictEqual(r.totalMs, 24 * 3600 * 1000);
  assert.strictEqual(r.pendenciaMs, 0);
  assert.strictEqual(r.efetivoMs, r.totalMs);
}
console.log('OK: calcularTemposFechamento sem pendência -> efetivo == total');

// Com 1 episódio de pendência de 5h dentro de um total de 24h.
{
  const r = calcularTemposFechamento([
    { valor_novo: 'Em Andamento', created_at: '2026-08-01T09:00:00Z' },
    { valor_novo: 'Pendência', created_at: '2026-08-01T12:00:00Z' },
    { valor_novo: 'Em Andamento', created_at: '2026-08-01T17:00:00Z' },
    { valor_novo: 'Concluído', created_at: '2026-08-02T09:00:00Z' },
  ]);
  assert.strictEqual(r.totalMs, 24 * 3600 * 1000);
  assert.strictEqual(r.pendenciaMs, 5 * 3600 * 1000);
  assert.strictEqual(r.efetivoMs, 19 * 3600 * 1000);
}
console.log('OK: calcularTemposFechamento soma corretamente 1 episódio de pendência');

// Com 2 episódios de pendência (2h + 3h) intercalados.
{
  const r = calcularTemposFechamento([
    { valor_novo: 'Em Andamento', created_at: '2026-08-01T00:00:00Z' },
    { valor_novo: 'Pendência', created_at: '2026-08-01T02:00:00Z' },
    { valor_novo: 'Em Andamento', created_at: '2026-08-01T04:00:00Z' },
    { valor_novo: 'Pendência', created_at: '2026-08-01T10:00:00Z' },
    { valor_novo: 'Em Andamento', created_at: '2026-08-01T13:00:00Z' },
    { valor_novo: 'Concluído', created_at: '2026-08-01T20:00:00Z' },
  ]);
  assert.strictEqual(r.pendenciaMs, 5 * 3600 * 1000);
  assert.strictEqual(r.totalMs, 20 * 3600 * 1000);
  assert.strictEqual(r.efetivoMs, 15 * 3600 * 1000);
}
console.log('OK: calcularTemposFechamento soma múltiplos episódios de pendência');

// Eventos fora de ordem devem ser reordenados internamente.
{
  const r = calcularTemposFechamento([
    { valor_novo: 'Concluído', created_at: '2026-08-02T09:00:00Z' },
    { valor_novo: 'Em Andamento', created_at: '2026-08-01T09:00:00Z' },
  ]);
  assert.strictEqual(r.totalMs, 24 * 3600 * 1000);
}
console.log('OK: calcularTemposFechamento reordena eventos fora de ordem cronológica');

// ─── formatarDuracaoHumana ───────────────────────────────────

assert.strictEqual(formatarDuracaoHumana(0), '0min');
assert.strictEqual(formatarDuracaoHumana(30 * 60 * 1000), '30min');
assert.strictEqual(formatarDuracaoHumana(5 * 3600 * 1000 + 30 * 60 * 1000), '5h 30min');
assert.strictEqual(formatarDuracaoHumana(2 * 86400000 + 3 * 3600 * 1000), '2d 3h');
console.log('OK: formatarDuracaoHumana formata min/h/dias corretamente');

// ─── QSA por mês ─────────────────────────────────────────────

// socioAtivoNoMes: sem datas -> sempre compõe o QSA.
assert.strictEqual(socioAtivoNoMes({ data_entrada: null, data_saida: null }, 2026, 3), true);
assert.strictEqual(socioAtivoNoMes({}, 1999, 12), true);

// Ingresso no meio do mês: compõe a partir do mês de entrada.
assert.strictEqual(socioAtivoNoMes({ data_entrada: '2026-03-15' }, 2026, 2), false);
assert.strictEqual(socioAtivoNoMes({ data_entrada: '2026-03-15' }, 2026, 3), true);
assert.strictEqual(socioAtivoNoMes({ data_entrada: '2026-03-15' }, 2026, 4), true);

// Saída: ainda compõe o QSA no mês da saída, some no seguinte.
assert.strictEqual(socioAtivoNoMes({ data_saida: '2026-03-10' }, 2026, 3), true);
assert.strictEqual(socioAtivoNoMes({ data_saida: '2026-03-10' }, 2026, 4), false);
assert.strictEqual(socioAtivoNoMes({ data_saida: '2026-03-10' }, 2026, 2), true);

// Janela fechada entrada+saída no mesmo mês.
assert.strictEqual(socioAtivoNoMes({ data_entrada: '2026-03-05', data_saida: '2026-03-20' }, 2026, 3), true);
assert.strictEqual(socioAtivoNoMes({ data_entrada: '2026-03-05', data_saida: '2026-03-20' }, 2026, 4), false);
console.log('OK: socioAtivoNoMes trata limites abertos, ingresso e saída');

// qsaDoMes: filtra pelo mês e ordena por nome.
{
  const socios = [
    { nome_socio: 'Zeca', data_entrada: '2020-01-01' },
    { nome_socio: 'Ana', data_entrada: '2026-03-01' },
    { nome_socio: 'Bruno', data_entrada: '2026-04-01' },
  ];
  assert.deepStrictEqual(qsaDoMes(socios, 2026, 3).map((s) => s.nome_socio), ['Ana', 'Zeca']);
  assert.deepStrictEqual(qsaDoMes(socios, 2026, 2).map((s) => s.nome_socio), ['Zeca']);
}
console.log('OK: qsaDoMes filtra por mês e ordena por nome');

// mesesDoPeriodoFechamento: cobre o período conforme periodicidade.
assert.deepStrictEqual(mesesDoPeriodoFechamento(2026, 3, 'mensal'), [{ ano: 2026, mes: 3 }]);
assert.deepStrictEqual(
  mesesDoPeriodoFechamento(2026, 3, 'trimestral'),
  [{ ano: 2026, mes: 1 }, { ano: 2026, mes: 2 }, { ano: 2026, mes: 3 }]
);
assert.strictEqual(mesesDoPeriodoFechamento(2026, 12, 'anual').length, 12);
console.log('OK: mesesDoPeriodoFechamento cobre o período da periodicidade');

// analisarQsaPeriodo: quadro estável no mês -> sem alteração.
{
  const socios = [
    { nome_socio: 'Ana', data_entrada: '2019-01-01' },
    { nome_socio: 'Bruno', data_entrada: '2019-01-01' },
  ];
  const r = analisarQsaPeriodo(socios, mesesDoPeriodoFechamento(2026, 3, 'mensal'));
  assert.strictEqual(r.meses.length, 1);
  assert.strictEqual(r.meses[0].label, 'MAR/2026');
  assert.deepStrictEqual(r.meses[0].socios.map((s) => s.nome_socio), ['Ana', 'Bruno']);
  assert.deepStrictEqual(r.resumo, { ingressos: 0, desligamentos: 0, semAlteracao: true });
}
console.log('OK: analisarQsaPeriodo detecta quadro sem alteração');

// analisarQsaPeriodo: ingresso e desligamento dentro de um trimestre.
{
  const socios = [
    { nome_socio: 'Ana', data_entrada: '2019-01-01' },
    { nome_socio: 'Bruno', data_entrada: '2026-02-10' },
    { nome_socio: 'Cida', data_entrada: '2019-01-01', data_saida: '2026-02-25' },
  ];
  const r = analisarQsaPeriodo(socios, mesesDoPeriodoFechamento(2026, 3, 'trimestral'));
  const [jan, fev, mar] = r.meses;
  assert.deepStrictEqual(jan.socios.map((s) => s.nome_socio), ['Ana', 'Cida']);
  assert.deepStrictEqual(fev.socios.map((s) => s.nome_socio), ['Ana', 'Bruno', 'Cida']);
  assert.deepStrictEqual(mar.socios.map((s) => s.nome_socio), ['Ana', 'Bruno']);
  assert.strictEqual(fev.socios.find((s) => s.nome_socio === 'Bruno').ingressou, true);
  assert.strictEqual(fev.socios.find((s) => s.nome_socio === 'Cida').desligou, true);
  assert.strictEqual(jan.socios.find((s) => s.nome_socio === 'Ana').ingressou, false);
  assert.deepStrictEqual(r.resumo, { ingressos: 1, desligamentos: 1, semAlteracao: false });
}
console.log('OK: analisarQsaPeriodo marca ingresso/desligamento e resume o período');

console.log('Todos os testes passaram.');
