const assert = require('assert');
const { calcularNivelSugerido } = require('./mapeamento-nivel-atencao.js');

function caso(nome, mapeamento, pendencias, hoje, esperado) {
  const resultado = calcularNivelSugerido(mapeamento, pendencias, hoje);
  assert.strictEqual(resultado, esperado, `${nome}: esperado "${esperado}", recebido "${resultado}"`);
  console.log(`OK: ${nome}`);
}

const HOJE = new Date('2026-07-31');

caso(
  'sem atraso, sem pendencia, sem situacao critica -> baixo',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'baixo'
);

caso(
  'situacao 2026 critica -> critico, independente do resto',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'critico' },
  [],
  HOJE,
  'critico'
);

caso(
  'mensal com 3 meses de atraso -> critico',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-03-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'critico'
);

caso(
  'mensal com 2 meses de atraso -> alto',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-04-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'alto'
);

caso(
  'mensal com 1 pendencia vencida -> medio',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [{ status: 'aberta', prazo: '2026-07-01' }],
  HOJE,
  'medio'
);

caso(
  '2 pendencias vencidas -> alto',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [{ status: 'aberta', prazo: '2026-07-01' }, { status: 'aberta', prazo: '2026-07-10' }],
  HOJE,
  'alto'
);

caso(
  'pendencia vencida mas ja resolvida nao conta',
  { periodicidade: 'mensal', ultimo_mes_fechado: '2026-06-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [{ status: 'resolvida', prazo: '2026-01-01' }],
  HOJE,
  'baixo'
);

caso(
  'trimestral, 1 mes alem da tolerancia de 3 meses -> medio',
  { periodicidade: 'trimestral', ultimo_mes_fechado: '2026-03-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'medio'
);

caso(
  'trimestral dentro da tolerancia de 3 meses -> baixo',
  { periodicidade: 'trimestral', ultimo_mes_fechado: '2026-05-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'baixo'
);

caso(
  'semestral, 1 mes alem da tolerancia de 6 meses -> medio',
  { periodicidade: 'semestral', ultimo_mes_fechado: '2025-12-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'medio'
);

caso(
  'semestral dentro da tolerancia de 6 meses -> baixo',
  { periodicidade: 'semestral', ultimo_mes_fechado: '2026-01-01', situacao_2025_status: 'regularizado', situacao_2026_status: 'regularizado' },
  [],
  HOJE,
  'baixo'
);

console.log('Todos os testes passaram.');
