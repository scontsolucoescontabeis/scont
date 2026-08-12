(function (root) {
  'use strict';

  // Parse 'YYYY-MM-DD' como data local, evitando o deslocamento de fuso que
  // ocorre ao usar `new Date(string)` (interpretada como UTC) e depois ler
  // com getMonth()/getFullYear() (métodos locais) em fusos atrás de UTC.
  function parseDataLocal(str) {
    if (str instanceof Date) return str;
    const [ano, mes, dia] = String(str).split('-').map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1);
  }

  function mesesEntre(dataA, dataB) {
    return (dataB.getFullYear() - dataA.getFullYear()) * 12 + (dataB.getMonth() - dataA.getMonth());
  }

  // Meses de atraso além da tolerância normal do ciclo de fechamento: para
  // periodicidade mensal, ter fechado até o mês anterior é normal (tolerância
  // de 1 mês); trimestral tolera 1 trimestre; semestral tolera 1 semestre;
  // anual tolera 1 ano.
  const TOLERANCIA_MESES_POR_PERIODICIDADE = { trimestral: 3, semestral: 6, anual: 12 };
  function atrasoEmMeses(ultimoMesFechado, periodicidade, hoje) {
    if (!ultimoMesFechado) return 99;
    const fechado = parseDataLocal(ultimoMesFechado);
    const gap = mesesEntre(fechado, hoje);
    const tolerancia = TOLERANCIA_MESES_POR_PERIODICIDADE[periodicidade] || 1;
    return Math.max(0, gap - tolerancia);
  }

  function calcularNivelSugerido(mapeamento, pendencias, hoje) {
    hoje = hoje || new Date();
    mapeamento = mapeamento || {};
    pendencias = pendencias || [];

    const situacaoCritica = mapeamento.situacao_2025_status === 'critico' || mapeamento.situacao_2026_status === 'critico';
    if (situacaoCritica) return 'critico';

    const atraso = atrasoEmMeses(mapeamento.ultimo_mes_fechado, mapeamento.periodicidade, hoje);
    const pendenciasVencidas = pendencias.filter((p) => p.status === 'aberta' && p.prazo && parseDataLocal(p.prazo) < hoje).length;

    if (atraso >= 3 || pendenciasVencidas >= 3) return 'critico';
    if (atraso === 2 || pendenciasVencidas === 2) return 'alto';
    if (atraso === 1 || pendenciasVencidas === 1) return 'medio';
    return 'baixo';
  }

  const api = { calcularNivelSugerido, parseDataLocal };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.calcularNivelSugerido = calcularNivelSugerido;
    root.parseDataLocal = parseDataLocal;
  }
})(typeof window !== 'undefined' ? window : globalThis);
