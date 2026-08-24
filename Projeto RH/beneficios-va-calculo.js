/**
 * Regra: dias com jornada de trabalho configurada para até 4 horas não geram
 * direito a Vale Alimentação naquele dia (Vale Transporte continua sendo
 * devido todos os dias, independente da carga horária).
 *
 * "Jornada" aqui é a mesma configuração usada no cálculo de horas extras da
 * Exportação TXT (_construirConteudoTXTExportacao, script.js): jornada diária
 * padrão + overrides opcionais de Sexta/Sábado. NÃO é a rh_jornada_trabalho
 * (entrada/saída), que só alimenta o layout da Folha de Ponto.
 *
 * Módulo puro: sem DOM, sem Supabase. Funciona como <script> global no
 * navegador e via require() em Node (para os testes).
 */

const LIMITE_MINUTOS_SEM_VA = 240; // 4h

function _converterHoraParaMinutosVA(hora) {
    if (!hora) return 0;
    const [h, m] = hora.split(':').map(Number);
    return (h * 60) + m;
}

// jornada: { jornadaDiaria, jornadaSextaAtiva, jornadaSexta, jornadaSabadoAtiva,
// jornadaSabado, sabadoSempreExtra }. diaSemanaAbrev: 'Dom'|'Seg'|...|'Sab'.
// Retorna minutos da jornada efetiva do dia, ou null quando o dia está fora
// desta regra (sábado marcado como "sempre extra" — não tem jornada normal
// prevista, então não entra na checagem de "até 4h").
function minutosJornadaEfetivaDia(jornada, diaSemanaAbrev) {
    const j = jornada || {};
    const diariaMin = _converterHoraParaMinutosVA(j.jornadaDiaria || '08:00');

    if (diaSemanaAbrev === 'Sab') {
        if (j.sabadoSempreExtra) return null;
        if (j.jornadaSabadoAtiva && j.jornadaSabado) return _converterHoraParaMinutosVA(j.jornadaSabado);
        return diariaMin;
    }
    if (diaSemanaAbrev === 'Sex') {
        if (j.jornadaSextaAtiva && j.jornadaSexta) return _converterHoraParaMinutosVA(j.jornadaSexta);
        return diariaMin;
    }
    return diariaMin;
}

function diaSemJornadaVA(jornada, diaSemanaAbrev) {
    const min = minutosJornadaEfetivaDia(jornada, diaSemanaAbrev);
    return min !== null && min <= LIMITE_MINUTOS_SEM_VA;
}

// dias: saída de calcularResumoMes(...).dias — [{data, diaSemana, tipo, ...}].
// datasJaDescontadas (opcional): datas 'DD/MM/AAAA' já removidas de "Dias a
// Pagar" por outro motivo (falta/atestado na Folha de Ponto salva) — excluídas
// daqui para não descontar o mesmo dia duas vezes do VA (uma pela falta, outra
// pela jornada reduzida).
// Retorna { total, dias: ['DD/MM/AAAA', ...] } com os dias de trabalho cuja
// jornada efetiva é <= 4h (sem direito a VA nesse dia específico).
function calcularDiasReduzidosVA(dias, jornada, datasJaDescontadas = []) {
    const diasAfetados = (dias || []).filter(d =>
        d.tipo === 'trabalho' && diaSemJornadaVA(jornada, d.diaSemana) && !datasJaDescontadas.includes(d.data)
    );
    return { total: diasAfetados.length, dias: diasAfetados.map(d => d.data) };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LIMITE_MINUTOS_SEM_VA,
        minutosJornadaEfetivaDia,
        diaSemJornadaVA,
        calcularDiasReduzidosVA
    };
}
