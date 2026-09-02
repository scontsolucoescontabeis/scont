/**
 * Cálculo de escala de trabalho (dias a trabalhar x dias de folga).
 * Módulo puro: sem DOM, sem Supabase. Funciona como <script> global no
 * navegador e via require() em Node (para os testes).
 */

const WEEKDAY_KEYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

const ABREV_PARA_CHAVE = {
    Dom: 'domingo', Seg: 'segunda', Ter: 'terca', Qua: 'quarta',
    Qui: 'quinta', Sex: 'sexta', Sab: 'sabado'
};

function _abrevParaChave(abrev) {
    return ABREV_PARA_CHAVE[abrev] || null;
}

function _brParaIso(dataBR) {
    const [d, m, a] = dataBR.split('/');
    return `${a}-${m}-${d}`;
}

const _DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function _diaResumo(dataObj) {
    const d = String(dataObj.getDate()).padStart(2, '0');
    const m = String(dataObj.getMonth() + 1).padStart(2, '0');
    const a = String(dataObj.getFullYear());
    return { data: `${d}/${m}/${a}`, diaSemana: _DIAS_SEMANA_ABREV[dataObj.getDay()] };
}

// Duplica a lógica de gerarDiasDoMes (script.js) para manter este módulo
// autocontido e testável em Node, sem depender de DOM/estado global.
//
// diaInicio/diaFim (opcionais): quando ambos válidos (1-31), apura de diaInicio do
// mês ANTERIOR ao da competência até diaFim do mês DA competência, em vez do mês
// calendário completo. Usado tanto pelo período de apuração da Frequência quanto
// pelo período de apuração de Benefícios (configs independentes, mesma mecânica).
function _gerarDiasDoMes(competencia, diaInicio = null, diaFim = null) {
    if (!competencia) return [];
    const [mes, ano] = competencia.split('/');
    const mesInt = parseInt(mes, 10);
    const anoInt = parseInt(ano, 10);

    const inicioValido = Number.isInteger(diaInicio) && diaInicio >= 1 && diaInicio <= 31;
    const fimValido = Number.isInteger(diaFim) && diaFim >= 1 && diaFim <= 31;

    if (!inicioValido || !fimValido) {
        const ultimoDia = new Date(anoInt, mesInt, 0).getDate();
        const dias = [];
        for (let i = 1; i <= ultimoDia; i++) {
            dias.push(_diaResumo(new Date(anoInt, mesInt - 1, i)));
        }
        return dias;
    }

    // Mês anterior: clampa o dia de início ao último dia real desse mês
    const ultimoDiaMesAnterior = new Date(anoInt, mesInt - 1, 0).getDate();
    const inicioClamp = Math.min(diaInicio, ultimoDiaMesAnterior);
    const dataInicio = new Date(anoInt, mesInt - 2, inicioClamp);

    // Mês da competência: clampa o dia de fim ao último dia real desse mês
    const ultimoDiaCompetencia = new Date(anoInt, mesInt, 0).getDate();
    const fimClamp = Math.min(diaFim, ultimoDiaCompetencia);
    const dataFim = new Date(anoInt, mesInt - 1, fimClamp);

    if (dataInicio > dataFim) {
        const dias = [];
        for (let i = 1; i <= ultimoDiaCompetencia; i++) {
            dias.push(_diaResumo(new Date(anoInt, mesInt - 1, i)));
        }
        return dias;
    }

    const dias = [];
    const cursor = new Date(dataInicio.getTime());
    while (cursor <= dataFim) {
        dias.push(_diaResumo(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return dias;
}

function _diasEntreIso(isoInicio, isoFim) {
    const [aI, mI, dI] = isoInicio.split('-').map(Number);
    const [aF, mF, dF] = isoFim.split('-').map(Number);
    const inicio = Date.UTC(aI, mI - 1, dI);
    const fim = Date.UTC(aF, mF - 1, dF);
    return Math.round((fim - inicio) / 86400000);
}

function calcularTipoDiaFixa(diasSemana, chaveDiaSemana) {
    return (diasSemana || []).includes(chaveDiaSemana) ? 'trabalho' : 'folga';
}

function calcularTipoDiaVariavelDatas(datasFolga, dataIso) {
    return (datasFolga || []).includes(dataIso) ? 'folga' : 'trabalho';
}

function calcularTipoDiaVariavelPadrao(ancoraIso, blocos, dataIso) {
    if (!ancoraIso || !blocos || blocos.length === 0) return 'trabalho';
    const cicloTotal = blocos.reduce((soma, b) => soma + b.dias, 0);
    if (cicloTotal <= 0) return 'trabalho';

    const diff = _diasEntreIso(ancoraIso, dataIso);
    const posicao = ((diff % cicloTotal) + cicloTotal) % cicloTotal;

    let acumulado = 0;
    for (const bloco of blocos) {
        acumulado += bloco.dias;
        if (posicao < acumulado) return bloco.tipo;
    }
    return blocos[blocos.length - 1].tipo;
}

function calcularTipoDiaPadrao5x2(chaveDiaSemana) {
    return (chaveDiaSemana === 'sabado' || chaveDiaSemana === 'domingo') ? 'folga' : 'trabalho';
}

// escala: linha de rh_escala_trabalho (ou null/undefined => padrão 5x2).
// dataBR: 'DD/MM/AAAA'. abrevDiaSemana: 'Dom'|'Seg'|...
function calcularTipoDia(escala, dataBR, abrevDiaSemana) {
    const chaveDiaSemana = _abrevParaChave(abrevDiaSemana);
    if (!escala) return calcularTipoDiaPadrao5x2(chaveDiaSemana);

    switch (escala.tipo_escala) {
        case 'fixa':
            return calcularTipoDiaFixa(escala.dias_semana, chaveDiaSemana);
        case 'variavel_datas':
            return calcularTipoDiaVariavelDatas(escala.datas_folga, _brParaIso(dataBR));
        case 'variavel_padrao':
            return calcularTipoDiaVariavelPadrao(escala.padrao_ancora, escala.padrao_blocos, _brParaIso(dataBR));
        default:
            return calcularTipoDiaPadrao5x2(chaveDiaSemana);
    }
}

function _dataEmPeriodo(dataIso, periodos) {
    return (periodos || []).some(p => dataIso >= p.inicio && dataIso <= p.fim);
}

// feriados: [{ data: 'DD/MM' (recorrente) | 'DD/MM/AAAA' (específico), tipo, descricao }].
// dataBR: 'DD/MM/AAAA'. Retorna o feriado casado ou null.
function _feriadoDoDia(feriados, dataBR) {
    if (!feriados || !feriados.length) return null;
    const curto = dataBR.slice(0, 5);
    return feriados.find(f => f.data === dataBR || f.data === curto) || null;
}

// Retorna { dias: [{data, diaSemana, tipo, ferias, excecao}], totalTrabalho, totalFolga, totalFerias, totalDias }
// periodosFerias (opcional): [{inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD'}, ...]. Dia que cai em
// algum período de férias sempre vira folga, independente do que a escala diga para aquele dia
// (mesmo critério usado em "Gerar Benefícios": férias sempre sai do cálculo de dias a trabalhar).
// diaInicio/diaFim (opcionais): ver _gerarDiasDoMes — apura um intervalo customizado em vez do
// mês calendário completo.
// datasExcecaoFolga (opcional): array de datas 'AAAA-MM-DD' marcadas manualmente como folga
// pontual (tela "Gerar Escala", sem alterar a escala configurada).
// feriados (opcional): [{ data: 'DD/MM' | 'DD/MM/AAAA', tipo: 'feriado'|'facultativo', descricao }],
// já resolvido para a empresa e o ano da competência (ver feriados-calculo.js). Um dia que casa
// com um feriado (e não está em férias) vira folga e ganha { feriado, feriadoTipo, feriadoDescricao }.
// Prioridade: férias > feriado > exceção > escala — um dia em férias nunca vira "feriado" nem
// "exceção" mesmo que também case.
function calcularResumoMes(escala, competencia, periodosFerias, diaInicio = null, diaFim = null, datasExcecaoFolga = null, feriados = null) {
    const diasDoMes = _gerarDiasDoMes(competencia, diaInicio, diaFim);
    const dias = diasDoMes.map(d => {
        const iso = _brParaIso(d.data);
        const emFerias = _dataEmPeriodo(iso, periodosFerias);
        const fer = !emFerias ? _feriadoDoDia(feriados, d.data) : null;
        const emExcecao = !emFerias && !fer && (datasExcecaoFolga || []).includes(iso);
        return {
            data: d.data,
            diaSemana: d.diaSemana,
            tipo: (emFerias || fer || emExcecao) ? 'folga' : calcularTipoDia(escala, d.data, d.diaSemana),
            ferias: emFerias,
            excecao: emExcecao,
            feriado: !!fer,
            feriadoTipo: fer ? (fer.tipo === 'facultativo' ? 'facultativo' : 'feriado') : null,
            feriadoDescricao: fer ? (fer.descricao || '') : null
        };
    });
    const totalTrabalho = dias.filter(d => d.tipo === 'trabalho').length;
    const totalFerias = dias.filter(d => d.ferias).length;
    const totalFeriados = dias.filter(d => d.feriado).length;
    return { dias, totalTrabalho, totalFolga: dias.length - totalTrabalho, totalFerias, totalFeriados, totalDias: dias.length };
}

// Validação de uma configuração de escala montada na tela, antes de salvar.
// Retorna { ok: true } ou { ok: false, erro: 'mensagem' }.
function validarConfigEscala(escala) {
    if (!escala || !escala.tipo_escala) return { ok: false, erro: 'Selecione um tipo de escala.' };

    if (escala.tipo_escala === 'fixa') {
        if (!escala.dias_semana || escala.dias_semana.length === 0) {
            return { ok: false, erro: 'Selecione ao menos um dia da semana trabalhado.' };
        }
        return { ok: true };
    }

    if (escala.tipo_escala === 'variavel_datas') {
        return { ok: true }; // lista pode começar vazia e crescer depois
    }

    if (escala.tipo_escala === 'variavel_padrao') {
        if (!escala.padrao_ancora) return { ok: false, erro: 'Informe a data âncora do ciclo.' };
        if (!escala.padrao_blocos || escala.padrao_blocos.length === 0) {
            return { ok: false, erro: 'Adicione ao menos um bloco de trabalho/folga.' };
        }
        const blocoInvalido = escala.padrao_blocos.find(b => !b.dias || b.dias < 1 || !['trabalho', 'folga'].includes(b.tipo));
        if (blocoInvalido) return { ok: false, erro: 'Cada bloco precisa de um tipo (trabalho/folga) e ao menos 1 dia.' };
        return { ok: true };
    }

    return { ok: false, erro: 'Tipo de escala desconhecido.' };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WEEKDAY_KEYS,
        _abrevParaChave,
        _brParaIso,
        _gerarDiasDoMes,
        _diasEntreIso,
        _dataEmPeriodo,
        _feriadoDoDia,
        calcularTipoDiaFixa,
        calcularTipoDiaVariavelDatas,
        calcularTipoDiaVariavelPadrao,
        calcularTipoDiaPadrao5x2,
        calcularTipoDia,
        calcularResumoMes,
        validarConfigEscala
    };
}
