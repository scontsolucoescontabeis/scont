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

// Duplica a lógica de gerarDiasDoMes (script.js) para manter este módulo
// autocontido e testável em Node, sem depender de DOM/estado global.
function _gerarDiasDoMes(competencia) {
    if (!competencia) return [];
    const [mes, ano] = competencia.split('/');
    const mesInt = parseInt(mes, 10);
    const anoInt = parseInt(ano, 10);
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const mesStr = String(mesInt).padStart(2, '0');
    const anoStr = String(anoInt);
    const ultimoDia = new Date(anoInt, mesInt, 0).getDate();
    const dias = [];
    for (let i = 1; i <= ultimoDia; i++) {
        const data = new Date(anoInt, mesInt - 1, i);
        dias.push({
            data: `${String(i).padStart(2, '0')}/${mesStr}/${anoStr}`,
            diaSemana: diasSemana[data.getDay()]
        });
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

// Retorna { dias: [{data, diaSemana, tipo, ferias}], totalTrabalho, totalFolga, totalFerias, totalDias }
// periodosFerias (opcional): [{inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD'}, ...]. Dia que cai em
// algum período de férias sempre vira folga, independente do que a escala diga para aquele dia
// (mesmo critério usado em "Gerar Benefícios": férias sempre sai do cálculo de dias a trabalhar).
function calcularResumoMes(escala, competencia, periodosFerias) {
    const diasDoMes = _gerarDiasDoMes(competencia);
    const dias = diasDoMes.map(d => {
        const emFerias = _dataEmPeriodo(_brParaIso(d.data), periodosFerias);
        return {
            data: d.data,
            diaSemana: d.diaSemana,
            tipo: emFerias ? 'folga' : calcularTipoDia(escala, d.data, d.diaSemana),
            ferias: emFerias
        };
    });
    const totalTrabalho = dias.filter(d => d.tipo === 'trabalho').length;
    const totalFerias = dias.filter(d => d.ferias).length;
    return { dias, totalTrabalho, totalFolga: dias.length - totalTrabalho, totalFerias, totalDias: dias.length };
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
        calcularTipoDiaFixa,
        calcularTipoDiaVariavelDatas,
        calcularTipoDiaVariavelPadrao,
        calcularTipoDiaPadrao5x2,
        calcularTipoDia,
        calcularResumoMes,
        validarConfigEscala
    };
}
