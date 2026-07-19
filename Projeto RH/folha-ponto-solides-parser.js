/**
 * Parsing do PDF "Folha de Ponto" exportado pelo sistema Sólides (uma página
 * por colaborador). Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona
 * como <script> global no navegador e via require() em Node (para os testes).
 */

function _linhasDaPagina(items) {
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

    return grupos.map(g => g.slice().sort((a, b) => a.x - b.x).map(i => i.str).join(' '));
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

    segmentosPeriodo.forEach(seg => {
        const horarios = _horariosEm(seg);
        if (horarios.length >= 2) {
            const chaveEntrada = chavesPeriodo[periodoIdx * 2];
            const chaveSaida = chavesPeriodo[periodoIdx * 2 + 1];
            if (chaveEntrada && chaveSaida) {
                resultado[chaveEntrada] = horarios[0];
                resultado[chaveSaida] = horarios[1];
            }
        } else {
            const status = _extrairStatus(seg);
            if (status) statusEncontrados.push(status);
        }
        periodoIdx++;
    });

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
    const texto = _linhasDaPagina(items).join('\n');
    const cabecalho = _extrairCabecalhoColaborador(texto);
    const competencia = _extrairCompetencia(texto);
    const ano = competencia ? competencia.split('/')[1] : String(anoFallback || new Date().getFullYear());
    const diasExtraidos = _extrairDiasPontos(texto, ano);
    const diasBase = competencia ? _gerarDiasDoMes(competencia) : [];
    const dias = diasBase.length ? _mesclarDias(diasBase, diasExtraidos) : diasExtraidos;
    return Object.assign({ competencia, dias }, cabecalho);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _linhasDaPagina,
        _pareceSolides,
        _extrairCabecalhoColaborador,
        _extrairCompetencia,
        _dividirBlocosDia,
        _parsearCorpoDia,
        _extrairDiasPontos,
        _gerarDiasDoMes,
        _mesclarDias,
        _normalizarNome,
        _melhorMatchEmpregado,
        _parsearPaginaColaborador
    };
}
