(function (root) {
  'use strict';

  const CICLO = ['sem_documentacao', 'pendencias', 'concluido'];

  const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  // Próximo status no ciclo sem_documentacao -> pendencias -> concluido -> sem_documentacao
  function proximoStatus(status) {
    const idx = CICLO.indexOf(status);
    return CICLO[(idx + 1) % CICLO.length] || CICLO[0];
  }

  // Lista os últimos N meses (ano, mes) terminando em (ano, mes) inclusive,
  // em ordem cronológica crescente. mes é 1-12.
  function ultimosNMeses(ano, mes, n) {
    const resultado = [];
    let a = ano, m = mes;
    for (let i = 0; i < n; i++) {
      resultado.unshift({ ano: a, mes: m });
      m -= 1;
      if (m < 1) { m = 12; a -= 1; }
    }
    return resultado;
  }

  const api = { proximoStatus, ultimosNMeses, MESES_LABELS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ContabilDiarioUtil = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
