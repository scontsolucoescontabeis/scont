/**
 * Parsing do PDF "Folha de Ponto" exportado pelo sistema Sólides (uma página
 * por colaborador). Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona
 * como <script> global no navegador e via require() em Node (para os testes).
 */

function _agruparLinhas(items) {
    const validos = (items || []).filter(it => it && it.str && it.str.trim().length > 0);
    if (validos.length === 0) return [];

    const ordenadosPorY = validos.slice().sort((a, b) => b.transform[5] - a.transform[5]);
    const LIMIAR_Y = 1.0;

    const grupos = [];
    let grupoAtual = null;
    let anchorY = null;
    for (const it of ordenadosPorY) {
        const y = it.transform[5];
        if (grupoAtual === null || Math.abs(y - anchorY) > LIMIAR_Y) {
            grupoAtual = { y, itens: [] };
            grupos.push(grupoAtual);
            anchorY = y;
        }
        grupoAtual.itens.push({ str: it.str.trim(), x: it.transform[4] });
    }

    return grupos.map(g => ({
        y: g.y,
        str: g.itens.slice().sort((a, b) => a.x - b.x).map(i => i.str).join(' ')
    }));
}

function _linhasDaPagina(items) {
    return _agruparLinhas(items).map(l => l.str);
}

function _pareceSolides(textoCompleto) {
    const t = textoCompleto || '';
    return t.includes('DADOS DO COLABORADOR') && t.includes('PONTOS') && t.includes('TRABALHADAS');
}

function _capturar(texto, regex) {
    const m = texto.match(regex);
    return m ? m[1].trim() : '';
}

function _extrairCabecalhoColaborador(textoPagina) {
    const partes = (textoPagina || '').split('DADOS DO COLABORADOR');
    if (partes.length < 2) {
        return { nome: '', cpf: '', admissao: '', funcao: '', codigo: '' };
    }
    const texto = partes[1];

    return {
        nome: _capturar(texto, /Nome:[ \t]*([^\n]*?)[ \t]*CPF:/),
        cpf: _capturar(texto, /CPF:[ \t]*(\d{11})/),
        admissao: _capturar(texto, /Admiss[ãa]o:[ \t]*(\d{2}\/\d{2}\/\d{4})/),
        funcao: _capturar(texto, /Fun[çc][ãa]o:[ \t]*([^\n]*?)[ \t]*Centro de Custo:/),
        codigo: _capturar(texto, /C[óo]digo:[ \t]*([^\n]*?)(?:\n|$)/)
    };
}

function _extrairCompetencia(textoPagina) {
    const m = (textoPagina || '').match(/\d{2}\/\d{2}\/\d{4}\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return `${m[2]}/${m[3]}`;
}

function _dividirBlocosDia(texto) {
    const re = /(\d{2})\/(\d{2})\s+(segunda-feira|ter[çc]a-feira|quarta-feira|quinta-feira|sexta-feira|s[áa]bado|domingo)/gi;
    const anchors = [];
    let m;
    while ((m = re.exec(texto)) !== null) {
        anchors.push({ index: m.index, fim: m.index + m[0].length, dia: m[1], mes: m[2] });
    }

    const blocos = [];
    for (let i = 0; i < anchors.length; i++) {
        const inicio = anchors[i].fim;
        const fim = i + 1 < anchors.length ? anchors[i + 1].index : texto.length;
        let corpo = texto.substring(inicio, fim);
        const idxTotal = corpo.indexOf('Total:');
        if (idxTotal !== -1) corpo = corpo.substring(0, idxTotal);
        blocos.push({ dia: anchors[i].dia, mes: anchors[i].mes, corpo });
    }
    return blocos;
}

const _RE_STATUS = /ATESTADO M[ÉE]DICO|ATESTADO DE COMPARECIMENTO|FALTA\s*-\s*FERIADO:?\s*[^0-9|]*|FALTA\s*N[ÃA]O\s*JUSTIFICADA|FERIADO|ABONO/i;

function _extrairStatus(texto) {
    const m = (texto || '').match(_RE_STATUS);
    if (!m) return '';
    return m[0].replace(/\s+/g, ' ').trim();
}

function _horariosEm(texto) {
    const out = [];
    const re = /([01]?\d|2[0-3]):([0-5]\d)/g;
    let m;
    while ((m = re.exec(texto || '')) !== null) {
        out.push(`${m[1].padStart(2, '0')}:${m[2]}`);
    }
    return out;
}

function _parsearCorpoDia(corpo) {
    const resultado = { entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '', ocorrencia: '' };
    const semQuebras = (corpo || '').replace(/\n/g, ' ').trim();

    if (semQuebras === '-' || semQuebras === '') {
        return resultado;
    }

    const partes = semQuebras.split('|');

    if (partes.length === 1) {
        resultado.ocorrencia = _extrairStatus(partes[0]);
        return resultado;
    }

    const segmentosPeriodo = partes.slice(0, -1);
    const chavesPeriodo = ['entrada1', 'saida1', 'entrada2', 'saida2', 'entrada3', 'saida3'];
    let periodoIdx = 0;
    const statusEncontrados = [];

    for (const seg of segmentosPeriodo) {
        const horarios = _horariosEm(seg);
        if (horarios.length === 2) {
            const chaveEntrada = chavesPeriodo[periodoIdx * 2];
            const chaveSaida = chavesPeriodo[periodoIdx * 2 + 1];
            if (chaveEntrada && chaveSaida) {
                resultado[chaveEntrada] = horarios[0];
                resultado[chaveSaida] = horarios[1];
            }
        } else if (horarios.length === 0) {
            const status = _extrairStatus(seg);
            if (status) statusEncontrados.push(status);
        } else {
            // horarios.length === 1 ou >= 3: segmento contaminado — sinal de que o texto
            // de ocorrência do dia seguinte quebrou em duas linhas no PDF e colou nos
            // totais deste dia. A partir daqui o restante do corpo não é mais confiável
            // (pode pertencer ao dia seguinte), então paramos por aqui propositalmente
            // em vez de gravar horário ou ocorrência errados; a Etapa 4 (revisão manual)
            // é o mecanismo de correção para esse caso raro.
            break;
        }
        periodoIdx++;
    }

    resultado.ocorrencia = statusEncontrados.join(' + ');
    return resultado;
}

function _extrairDiasPontos(textoPagina, ano) {
    const blocos = _dividirBlocosDia(textoPagina || '');
    return blocos.map(b => {
        const dados = _parsearCorpoDia(b.corpo);
        return Object.assign({ data: `${b.dia}/${b.mes}/${ano}` }, dados);
    });
}

const _RE_ANCHOR_DIA = /^(\d{2})\/(\d{2})\s+(segunda-feira|ter[çc]a-feira|quarta-feira|quinta-feira|sexta-feira|s[áa]bado|domingo)/i;

/**
 * Um fragmento de pontos é uma linha do grid que contém só marcação de ponto
 * (horários, "|", "(m)", "-") ou um status conhecido — nunca cabeçalho ou rodapé.
 */
function _pareceFragmentoPonto(str) {
    const s = (str || '').trim();
    if (!s) return false;
    if (/\d{1,2}:\d{2}/.test(s)) return true;      // contém horário
    if (/^[|\-\s()m]+$/i.test(s)) return true;     // só separadores / "(m)"
    if (_extrairStatus(s)) return true;            // status conhecido (ATESTADO, FALTA, ...)
    return false;
}

/**
 * Extrai os dias a partir das linhas POSICIONADAS ({ y, str }).
 *
 * Quando um dia tem 3 períodos, o Sólides quebra a célula PONTOS em duas linhas
 * físicas e o PDF.js as reporta em Y ~±3,5 da linha do dia. A reconstrução por
 * Y do _agruparLinhas separa isso em 3 linhas distintas: a 1ª "flutua" acima da
 * âncora do dia (grudando no dia anterior) e a linha da âncora fica só com as
 * colunas de resumo. Aqui religamos cada fragmento de ponto à âncora de dia
 * verticalmente mais próxima, remontando os 3 períodos.
 */
function _extrairDiasPontosPosicional(linhas, ano) {
    const anchors = [];
    (linhas || []).forEach((l, i) => {
        const m = l.str.match(_RE_ANCHOR_DIA);
        if (m) anchors.push({ i, y: l.y, dia: m[1], mes: m[2], prefixoLen: m[0].length });
    });
    if (!anchors.length) return [];

    // Região do grid de dias: do 1º dia até a linha "Total:" (rodapé)
    let fimRegiao = linhas.length;
    for (let i = anchors[0].i + 1; i < linhas.length; i++) {
        if (linhas[i].str.includes('Total:')) { fimRegiao = i; break; }
    }

    const ehAncora = new Set(anchors.map(a => a.i));
    const fragmentosPorDia = anchors.map(() => []);

    for (let i = anchors[0].i; i < fimRegiao; i++) {
        if (ehAncora.has(i)) continue;
        const l = linhas[i];
        if (!_pareceFragmentoPonto(l.str)) continue;
        let melhor = 0, menorDist = Infinity;
        anchors.forEach((a, ai) => {
            const d = Math.abs(a.y - l.y);
            if (d < menorDist) { menorDist = d; melhor = ai; }
        });
        fragmentosPorDia[melhor].push(l.str);
    }

    return anchors.map((a, ai) => {
        const resto = linhas[a.i].str.slice(a.prefixoLen);
        const temPeriodoNaAncora = resto.includes('|');
        let corpo;
        if (temPeriodoNaAncora || fragmentosPorDia[ai].length === 0) {
            // dia normal (uma linha só) — idêntico ao comportamento anterior
            corpo = resto;
        } else {
            // dia com pontos quebrados em linhas separadas: remonta os pontos ANTES do resumo
            corpo = fragmentosPorDia[ai].join(' ') + ' ' + resto;
        }
        const idxTotal = corpo.indexOf('Total:');
        if (idxTotal !== -1) corpo = corpo.substring(0, idxTotal);
        const dados = _parsearCorpoDia(corpo);
        return Object.assign({ data: `${a.dia}/${a.mes}/${ano}` }, dados);
    });
}

const _DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function _gerarDiasDoMes(competencia) {
    if (!competencia) return [];
    const [mes, ano] = competencia.split('/');
    const mesInt = parseInt(mes, 10);
    const anoInt = parseInt(ano, 10);
    const mesStr = String(mesInt).padStart(2, '0');
    const ultimoDia = new Date(anoInt, mesInt, 0).getDate();
    const dias = [];
    for (let i = 1; i <= ultimoDia; i++) {
        const data = new Date(anoInt, mesInt - 1, i);
        dias.push({
            data: `${String(i).padStart(2, '0')}/${mesStr}/${anoInt}`,
            diaSemana: _DIAS_SEMANA_ABREV[data.getDay()],
            entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '',
            ocorrencia: ''
        });
    }
    return dias;
}

function _mesclarDias(diasBase, diasExtraidos) {
    const porData = new Map((diasExtraidos || []).map(d => [d.data, d]));
    return (diasBase || []).map(dia => {
        const extra = porData.get(dia.data);
        if (!extra) return Object.assign({}, dia);
        return Object.assign({}, dia, {
            entrada1: extra.entrada1, saida1: extra.saida1,
            entrada2: extra.entrada2, saida2: extra.saida2,
            entrada3: extra.entrada3, saida3: extra.saida3,
            ocorrencia: extra.ocorrencia
        });
    });
}

function _normalizarNome(nome) {
    return (nome || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function _melhorMatchEmpregado(nomeExtraido, empregados) {
    const alvo = _normalizarNome(nomeExtraido);
    if (!alvo) return null;

    let parcial = null;
    for (const emp of (empregados || [])) {
        const nomeEmp = _normalizarNome(emp.nome_empregado);
        if (nomeEmp === alvo) return emp;
        if (!parcial && (nomeEmp.includes(alvo) || alvo.includes(nomeEmp))) parcial = emp;
    }
    return parcial;
}

function _parsearPaginaColaborador(items, anoFallback) {
    const linhas = _agruparLinhas(items);
    const texto = linhas.map(l => l.str).join('\n');
    const cabecalho = _extrairCabecalhoColaborador(texto);
    const competencia = _extrairCompetencia(texto);
    const ano = competencia ? competencia.split('/')[1] : String(anoFallback || new Date().getFullYear());
    const diasExtraidos = _extrairDiasPontosPosicional(linhas, ano);
    const diasBase = competencia ? _gerarDiasDoMes(competencia) : [];
    const dias = diasBase.length ? _mesclarDias(diasBase, diasExtraidos) : diasExtraidos;
    return Object.assign({ competencia, dias }, cabecalho);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _agruparLinhas,
        _linhasDaPagina,
        _pareceSolides,
        _extrairCabecalhoColaborador,
        _extrairCompetencia,
        _dividirBlocosDia,
        _parsearCorpoDia,
        _pareceFragmentoPonto,
        _extrairDiasPontos,
        _extrairDiasPontosPosicional,
        _gerarDiasDoMes,
        _mesclarDias,
        _normalizarNome,
        _melhorMatchEmpregado,
        _parsearPaginaColaborador
    };
}
