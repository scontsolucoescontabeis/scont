/**
 * Parsing do PDF "Cartão de Ponto" exportado pelo sistema SMART PONTO (uma
 * página por colaborador). Módulo puro: sem DOM, sem Supabase, sem PDF.js.
 * Funciona como <script> global no navegador e via require() em Node (para
 * os testes).
 *
 * Todas as funções exportadas usam o sufixo "Smart" para não colidir, no
 * escopo global do navegador, com as funções de mesmo nome do
 * folha-ponto-solides-parser.js (os dois arquivos são carregados como
 * <script> comuns na mesma página — sem isso o segundo script carregado
 * sobrescreveria silenciosamente as funções do primeiro).
 *
 * Diferente do layout do Sólides (colunas separadas por "|"), este layout é
 * tabular denso: JORNADAS REALIZADAS | NORMAL | EXTRA | LIMITE 1/2/3 |
 * BANCO HR. | HORÁRIOS PREVISTOS, todos em colunas de largura fixa com
 * valores no formato HH:MM. Um corte único por posição X não é confiável
 * (o valor real de uma coluna pode renderizar a poucos pontos do rótulo da
 * coluna vizinha) — por isso a extração usa "âncora mais próxima": cada
 * token de uma linha de dia é comparado à âncora de coluna mais próxima
 * dentro de JORNADAS REALIZADAS versus a âncora do início de NORMAL: se a
 * primeira for mais próxima, o token pertence às batidas reais; senão é
 * descartado (Normal/Extra/Limites/Banco de Horas/Horários Previstos).
 */

function _linhasComItens(items) {
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
            grupoAtual = [];
            grupos.push(grupoAtual);
            anchorY = y;
        }
        grupoAtual.push({ str: it.str.trim(), x: it.transform[4] });
    }

    return grupos.map(g => g.slice().sort((a, b) => a.x - b.x));
}

function _pareceSmartPonto(textoCompleto) {
    const t = textoCompleto || '';
    return t.includes('CARTÃO DE PONTO') && t.includes('JORNADAS REALIZADAS') && t.includes('HORÁRIOS PREVISTOS');
}

function _capturarSmart(texto, regex) {
    const m = (texto || '').match(regex);
    return m ? m[1].trim() : '';
}

function _extrairCabecalhoColaboradorSmart(textoPagina) {
    return {
        nome: _capturarSmart(textoPagina, /FUNCION[ÁA]RIO:[ \t]*([^\n]*?)[ \t]*ADMISS[ÃA]O:/i),
        cpf: _capturarSmart(textoPagina, /(?:^|[^/])CPF:[ \t]*(\d{3}\.\d{3}\.\d{3}-\d{2})/i),
        admissao: _capturarSmart(textoPagina, /ADMISS[ÃA]O:[ \t]*(\d{2}\/\d{2}\/\d{4})/i),
        funcao: _capturarSmart(textoPagina, /CARGO:[ \t]*([^\n]*?)[ \t]*SETOR:/i),
        codigo: ''
    };
}

function _extrairCompetenciaSmart(textoPagina) {
    const m = (textoPagina || '').match(/PER[ÍI]ODO:[ \t]*\d{2}\/\d{2}\/\d{4}[ \t]+A[ \t]+(\d{2})\/(\d{2})\/(\d{4})/i);
    return m ? `${m[2]}/${m[3]}` : null;
}

const _RE_DATA_SMART = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const _RE_DIA_ABREV_SMART = /^(Seg|Ter|Qua|Qui|Sex|S[áa]b|Dom)$/i;
const _RE_HORA_SMART = /^([01]\d|2[0-3]):([0-5]\d)$/;

function _acharBoundaryXSmart(linhas) {
    for (const linha of (linhas || [])) {
        const alvo = linha.find(it => it.str === 'NORMAL');
        if (alvo) return alvo.x;
    }
    return null;
}

function _acharJornadaAnchorsSmart(linhas, boundaryX) {
    for (const linha of (linhas || [])) {
        const anchors = linha
            .filter(it => (it.str === 'ENT.' || it.str === 'SAÍ.') && it.x < boundaryX)
            .map(it => it.x);
        if (anchors.length) return anchors;
    }
    return [];
}

function _distMinSmart(x, anchors) {
    if (!anchors || !anchors.length) return Infinity;
    let min = Infinity;
    for (const a of anchors) {
        const d = Math.abs(x - a);
        if (d < min) min = d;
    }
    return min;
}

function _pertenceJornadaSmart(x, jornadaAnchors, boundaryX) {
    if (boundaryX == null) return false;
    return _distMinSmart(x, jornadaAnchors) <= Math.abs(x - boundaryX);
}

function _parsearLinhaDiaSmart(linha, jornadaAnchors, boundaryX) {
    if (!linha || !linha.length) return null;
    const m = linha[0].str.match(_RE_DATA_SMART);
    if (!m) return null;

    let i = 1;
    if (linha[i] && _RE_DIA_ABREV_SMART.test(linha[i].str)) i++;

    const zona = linha.slice(i).filter(it => _pertenceJornadaSmart(it.x, jornadaAnchors, boundaryX));

    const dado = { data: `${m[1]}/${m[2]}/${m[3]}`, ocorrencia: '' };
    const horas = [];
    const statusPartes = [];
    for (const it of zona) {
        if (_RE_HORA_SMART.test(it.str)) horas.push(it.str);
        else statusPartes.push(it.str);
    }

    horas.forEach((h, idx) => {
        const par = Math.floor(idx / 2) + 1;
        const campo = (idx % 2 === 0) ? `entrada${par}` : `saida${par}`;
        dado[campo] = h;
    });

    const status = statusPartes.join(' ').trim();
    if (status && status.toUpperCase() !== 'FOLGA') dado.ocorrencia = status;

    return dado;
}

function _extrairDiasPontosSmart(linhas, jornadaAnchors, boundaryX) {
    const dias = [];
    for (const linha of (linhas || [])) {
        const dia = _parsearLinhaDiaSmart(linha, jornadaAnchors, boundaryX);
        if (dia) dias.push(dia);
    }
    return dias;
}

const _DIAS_SEMANA_ABREV_SMART = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function _gerarDiasDoMesSmart(competencia) {
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
            diaSemana: _DIAS_SEMANA_ABREV_SMART[data.getDay()],
            entrada1: '', saida1: '',
            ocorrencia: ''
        });
    }
    return dias;
}

function _mesclarDiasSmart(diasBase, diasExtraidos) {
    const porData = new Map((diasExtraidos || []).map(d => [d.data, d]));
    return (diasBase || []).map(dia => {
        const extra = porData.get(dia.data);
        if (!extra) return Object.assign({}, dia);
        const copia = Object.assign({}, dia, { ocorrencia: extra.ocorrencia || '' });
        Object.keys(extra).forEach(k => {
            if (/^(entrada|saida)\d+$/.test(k)) copia[k] = extra[k];
        });
        return copia;
    });
}

function _normalizarNomeSmart(nome) {
    return (nome || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function _melhorMatchEmpregadoSmart(nomeExtraido, empregados) {
    const alvo = _normalizarNomeSmart(nomeExtraido);
    if (!alvo) return null;

    let parcial = null;
    for (const emp of (empregados || [])) {
        const nomeEmp = _normalizarNomeSmart(emp.nome_empregado);
        if (nomeEmp === alvo) return emp;
        if (!parcial && (nomeEmp.includes(alvo) || alvo.includes(nomeEmp))) parcial = emp;
    }
    return parcial;
}

function _parsearPaginaColaboradorSmart(items, anoFallback) {
    const linhas = _linhasComItens(items);
    const textoPagina = linhas.map(l => l.map(it => it.str).join(' ')).join('\n');

    const cabecalho = _extrairCabecalhoColaboradorSmart(textoPagina);
    const competencia = _extrairCompetenciaSmart(textoPagina);

    const boundaryX = _acharBoundaryXSmart(linhas);
    const jornadaAnchors = boundaryX != null ? _acharJornadaAnchorsSmart(linhas, boundaryX) : [];
    const diasExtraidos = boundaryX != null ? _extrairDiasPontosSmart(linhas, jornadaAnchors, boundaryX) : [];

    const diasBase = competencia ? _gerarDiasDoMesSmart(competencia) : [];
    const dias = diasBase.length ? _mesclarDiasSmart(diasBase, diasExtraidos) : diasExtraidos;

    return Object.assign({ competencia, dias }, cabecalho);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _linhasComItens,
        _pareceSmartPonto,
        _extrairCabecalhoColaboradorSmart,
        _extrairCompetenciaSmart,
        _acharBoundaryXSmart,
        _acharJornadaAnchorsSmart,
        _pertenceJornadaSmart,
        _parsearLinhaDiaSmart,
        _extrairDiasPontosSmart,
        _gerarDiasDoMesSmart,
        _mesclarDiasSmart,
        _normalizarNomeSmart,
        _melhorMatchEmpregadoSmart,
        _parsearPaginaColaboradorSmart
    };
}
