(function (root) {
  'use strict';

  const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

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

  // Calcula os tempos do ciclo de status da grade mensal (Não Iniciado ->
  // Em Andamento -> Pendência <-> Em Andamento -> Concluído) a partir dos
  // eventos de contabil_diario_auditoria daquele codigo_empresa/ano/mes
  // (campo "Status Mensal — MES/ANO"). `eventos` é uma lista de
  // { valor_novo, created_at } em qualquer ordem.
  //
  // Retorna null se o mês ainda não chegou a "Concluído" (nada a mostrar
  // ainda). `fim` é a última transição para "Concluído" — o fim da
  // atividade contábil em si, não a validação (aprovação) posterior da
  // Scont, que pode acontecer dias depois por motivos administrativos.
  function calcularTemposFechamento(eventos) {
    if (!eventos || !eventos.length) return null;
    const ordenados = eventos.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let indiceUltimoConcluido = -1;
    for (let i = ordenados.length - 1; i >= 0; i--) {
      if (ordenados[i].valor_novo === 'Concluído') { indiceUltimoConcluido = i; break; }
    }
    if (indiceUltimoConcluido === -1) return null;

    const inicio = ordenados[0].created_at;
    const fim = ordenados[indiceUltimoConcluido].created_at;

    let pendenciaMs = 0;
    for (let i = 0; i < indiceUltimoConcluido; i++) {
      if (ordenados[i].valor_novo === 'Pendência') {
        pendenciaMs += new Date(ordenados[i + 1].created_at) - new Date(ordenados[i].created_at);
      }
    }

    const totalMs = new Date(fim) - new Date(inicio);
    return { inicio, fim, totalMs, pendenciaMs, efetivoMs: totalMs - pendenciaMs };
  }

  // Formata uma duração em milissegundos como "Xd Yh" / "Xh Ymin" / "Xmin",
  // sempre com no máximo 2 unidades, para exibição compacta na UI.
  function formatarDuracaoHumana(ms) {
    if (!ms || ms < 0) return '0min';
    const totalMin = Math.round(ms / 60000);
    const dias = Math.floor(totalMin / 1440);
    const horas = Math.floor((totalMin % 1440) / 60);
    const min = totalMin % 60;
    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${min}min`;
    return `${min}min`;
  }

  const api = { ultimosNMeses, MESES_LABELS, calcularTemposFechamento, formatarDuracaoHumana };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ContabilDiarioUtil = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
