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

  // ─── PERIODICIDADE DE FECHAMENTO ────────────────────────────
  // O encerramento/validação do Diário segue a periodicidade do contábil
  // (contabil_mapeamento.periodicidade): mensal fecha todo mês (como
  // sempre foi); trimestral fecha só em Mar/Jun/Set/Dez, cobrindo os 3
  // meses do trimestre; semestral fecha só em Jun/Dez, cobrindo os 6
  // meses do semestre; anual fecha só em Dezembro, cobrindo o ano
  // inteiro. A grade de 3 estados (Não Iniciado/Pendência/Concluído)
  // continua granular por mês para todas as periodicidades — só o
  // ENCERRAMENTO (contabil_diario_fechamentos) muda de cadência.

  function qtdMesesNoPeriodo(periodicidade) {
    if (periodicidade === 'trimestral') return 3;
    if (periodicidade === 'semestral') return 6;
    if (periodicidade === 'anual') return 12;
    return 1;
  }

  // Dado um mês qualquer (1-12), devolve o mês final do período de
  // fechamento ao qual ele pertence, conforme a periodicidade.
  function mesFinalDoPeriodo(mes, periodicidade) {
    if (periodicidade === 'trimestral') return Math.ceil(mes / 3) * 3;
    if (periodicidade === 'semestral') return mes <= 6 ? 6 : 12;
    if (periodicidade === 'anual') return 12;
    return mes;
  }

  // Rótulo do período de fechamento para exibição (título de modal, ícone,
  // e-mail, linha do tempo). `mesFinal` é o mês final do período (já
  // resolvido por mesFinalDoPeriodo).
  function descricaoPeriodo(periodicidade, ano, mesFinal) {
    if (periodicidade === 'trimestral') {
      const trimestre = Math.ceil(mesFinal / 3);
      return `${trimestre}º Trimestre/${ano}`;
    }
    if (periodicidade === 'semestral') {
      const semestre = mesFinal <= 6 ? 1 : 2;
      return `${semestre}º Semestre/${ano}`;
    }
    if (periodicidade === 'anual') return String(ano);
    return `${MESES_LABELS[mesFinal - 1]}/${ano}`;
  }

  // ─── QSA (QUADRO DE SÓCIOS E ADMINISTRADORES) POR MÊS ───────
  // Monta a composição do QSA mês a mês do período em análise no
  // Diário, a partir das linhas de rh_socios (campos data_entrada /
  // data_saida, strings 'YYYY-MM-DD' ou vazias). Usado no modal
  // informativo da tela de validação de fechamento — só leitura, sem
  // cruzamento com rh_empregados (isso é a "Análise do QSA" do RH).

  function _dia(ano, mes) {
    return String(ano) + '-' + String(mes).padStart(2, '0');
  }

  function _primeiroDiaMes(ano, mes) {
    return _dia(ano, mes) + '-01';
  }

  function _ultimoDiaMes(ano, mes) {
    return _dia(ano, mes) + '-' + String(new Date(ano, mes, 0).getDate()).padStart(2, '0');
  }

  function _dataStr(v) {
    return v ? String(v).slice(0, 10) : '';
  }

  // A pessoa compõe o QSA no mês (ano, mes) se já havia ingressado até
  // o último dia do mês e ainda não havia saído antes do primeiro dia
  // (data_saida no próprio mês = ainda compõe o QSA daquele mês).
  function socioAtivoNoMes(socio, ano, mes) {
    const entrada = _dataStr(socio && socio.data_entrada);
    const saida = _dataStr(socio && socio.data_saida);
    if (entrada && entrada > _ultimoDiaMes(ano, mes)) return false;
    if (saida && saida < _primeiroDiaMes(ano, mes)) return false;
    return true;
  }

  function _dentroDoMes(dataStr, ano, mes) {
    const d = _dataStr(dataStr);
    return !!d && d >= _primeiroDiaMes(ano, mes) && d <= _ultimoDiaMes(ano, mes);
  }

  // Sócios que compõem o QSA no mês, ordenados por nome.
  function qsaDoMes(socios, ano, mes) {
    return (socios || [])
      .filter((s) => socioAtivoNoMes(s, ano, mes))
      .slice()
      .sort((a, b) => String(a.nome_socio || '').localeCompare(String(b.nome_socio || ''), 'pt-BR'));
  }

  // Meses (crescente) cobertos pelo período de fechamento que termina
  // em mesFinal, conforme a periodicidade.
  function mesesDoPeriodoFechamento(ano, mesFinal, periodicidade) {
    return ultimosNMeses(ano, mesFinal, qtdMesesNoPeriodo(periodicidade));
  }

  // Análise completa do QSA para uma lista de meses (crescente). Marca,
  // em cada mês, quem ingressou ou se desligou naquele mês, e resume
  // ingressos/desligamentos do período inteiro.
  function analisarQsaPeriodo(socios, meses) {
    const lista = meses || [];
    const mesesRender = lista.map(({ ano, mes }) => ({
      ano,
      mes,
      label: MESES_LABELS[mes - 1] + '/' + ano,
      socios: qsaDoMes(socios, ano, mes).map((s) => ({
        ...s,
        ingressou: _dentroDoMes(s.data_entrada, ano, mes),
        desligou: _dentroDoMes(s.data_saida, ano, mes),
      })),
    }));

    let ingressos = 0;
    let desligamentos = 0;
    if (lista.length) {
      const ini = _primeiroDiaMes(lista[0].ano, lista[0].mes);
      const fim = _ultimoDiaMes(lista[lista.length - 1].ano, lista[lista.length - 1].mes);
      (socios || []).forEach((s) => {
        const e = _dataStr(s.data_entrada);
        const sd = _dataStr(s.data_saida);
        if (e && e >= ini && e <= fim) ingressos += 1;
        if (sd && sd >= ini && sd <= fim) desligamentos += 1;
      });
    }

    return {
      meses: mesesRender,
      resumo: { ingressos, desligamentos, semAlteracao: ingressos === 0 && desligamentos === 0 },
    };
  }

  const api = {
    ultimosNMeses, MESES_LABELS, calcularTemposFechamento, formatarDuracaoHumana,
    qtdMesesNoPeriodo, mesFinalDoPeriodo, descricaoPeriodo,
    socioAtivoNoMes, qsaDoMes, mesesDoPeriodoFechamento, analisarQsaPeriodo,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ContabilDiarioUtil = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
