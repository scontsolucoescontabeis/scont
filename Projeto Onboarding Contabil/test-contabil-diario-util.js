const assert = require('assert');
const { ultimosNMeses, MESES_LABELS, calcularTemposFechamento, formatarDuracaoHumana } = require('./contabil-diario-util.js');

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

console.log('Todos os testes passaram.');
