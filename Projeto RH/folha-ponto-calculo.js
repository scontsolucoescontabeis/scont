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

const _DIAS_SEMANA_ORDEM = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const _DIA_CHAVE_PARA_ABREV = {
    segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui',
    sexta: 'Sex', sabado: 'Sáb', domingo: 'Dom'
};

// Resume a jornada da semana numa linha compacta para o cabeçalho da folha,
// agrupando dias consecutivos com o mesmo horário: "Seg a Sex: 08:00-12:00 /
// 13:00-17:48 · Sáb: 08:00-12:00". Dias sem registro quebram o agrupamento e
// não aparecem. Retorna '' quando não há nenhuma jornada cadastrada.
function resumirJornadaSemana(jornadaPorDiaSemana) {
    const mapa = jornadaPorDiaSemana || {};
    const grupos = [];
    let atual = null;
    for (const dia of _DIAS_SEMANA_ORDEM) {
        const registro = mapa[dia];
        if (!registro) { atual = null; continue; }
        const horario = formatarHorarioJornadaDia(registro);
        if (atual && atual.horario === horario) {
            atual.fim = dia;
        } else {
            atual = { inicio: dia, fim: dia, horario };
            grupos.push(atual);
        }
    }
    return grupos.map(g => {
        const rotulo = g.inicio === g.fim
            ? _DIA_CHAVE_PARA_ABREV[g.inicio]
            : `${_DIA_CHAVE_PARA_ABREV[g.inicio]} a ${_DIA_CHAVE_PARA_ABREV[g.fim]}`;
        return `${rotulo}: ${g.horario}`;
    }).join(' · ');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _DIA_ABREV_PARA_CHAVE,
        agruparJornadaPorDiaSemana,
        formatarHorarioJornadaDia,
        montarLinhasFolhaPonto,
        resumirJornadaSemana
    };
}
