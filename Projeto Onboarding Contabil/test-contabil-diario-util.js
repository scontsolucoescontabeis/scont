const assert = require('assert');
const { proximoStatus, ultimosNMeses, MESES_LABELS } = require('./contabil-diario-util.js');

assert.strictEqual(proximoStatus('sem_documentacao'), 'pendencias');
console.log('OK: sem_documentacao -> pendencias');

assert.strictEqual(proximoStatus('pendencias'), 'concluido');
console.log('OK: pendencias -> concluido');

assert.strictEqual(proximoStatus('concluido'), 'sem_documentacao');
console.log('OK: concluido -> sem_documentacao (ciclo fecha)');

assert.strictEqual(proximoStatus(undefined), 'sem_documentacao');
console.log('OK: status desconhecido/vazio -> sem_documentacao');

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

console.log('Todos os testes passaram.');
