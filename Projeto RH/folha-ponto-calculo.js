/**
 * Cálculo do "Horário Previsto" por dia na Folha de Ponto gerada.
 * Módulo puro: sem DOM, sem Supabase. Combina os dias já classificados por
 * calcularResumoMes (escala-calculo.js) com o horário de rh_jornada_trabalho
 * (por dia da semana) para decidir o texto exibido em cada linha da folha.
 */

const _DIA_ABREV_PARA_CHAVE = {
    Dom: 'domingo', Seg: 'segunda', Ter: 'terca', Qua: 'quarta',
    Qui: 'quinta', Sex: 'sexta', Sab: 'sabado'
};

// linhasJornada: linhas de rh_jornada_trabalho de UM empregado (todas as dia_semana).
function agruparJornadaPorDiaSemana(linhasJornada) {
    const porDia = {};
    (linhasJornada || []).forEach(l => { porDia[l.dia_semana] = l; });
    return porDia;
}

function formatarHorarioJornadaDia(registro) {
    if (!registro) return '—';
    if (registro.intervalo_inicio && registro.intervalo_fim) {
        return `${registro.entrada}-${registro.intervalo_inicio} / ${registro.intervalo_fim}-${registro.saida}`;
    }
    return `${registro.entrada}-${registro.saida}`;
}

// dias: saída de calcularResumoMes(...).dias — [{data, diaSemana, tipo, ferias, excecao}]
// jornadaPorDiaSemana: saída de agruparJornadaPorDiaSemana(...)
function montarLinhasFolhaPonto(dias, jornadaPorDiaSemana) {
    return (dias || []).map(d => {
        const chaveDia = _DIA_ABREV_PARA_CHAVE[d.diaSemana] || null;
        const horarioPrevisto = (d.tipo === 'trabalho' && chaveDia)
            ? formatarHorarioJornadaDia((jornadaPorDiaSemana || {})[chaveDia])
            : '—';
        return { ...d, horarioPrevisto };
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _DIA_ABREV_PARA_CHAVE,
        agruparJornadaPorDiaSemana,
        formatarHorarioJornadaDia,
        montarLinhasFolhaPonto
    };
}
