/**
 * Parsing do PDF "Horário de Trabalho" (jornada de trabalho por empregado).
 * Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona como
 * <script> global no navegador (funções ficam em window/global
 * implícito) e via require() em Node (para os testes).
 *
 * Ao contrário do parser de férias (ferias-parser.js), que reconstrói uma
 * única string de texto por linha, este parser mantém cada item do PDF.js
 * com sua posição X e agrupa por COLUNA (código/nome/dia/entrada/intervalo/
 * saída/observação). Motivo: o PDF de origem às vezes gruda o nome do
 * empregado com a data de admissão no mesmo item de texto, sem espaço
 * separador, quando o nome é comprido demais para a coluna (ex.:
 * "SANTOS14/07/2018"). Agrupar por coluna (posição X fixa em todo o
 * documento) evita que esse vazamento contamine os outros campos —
 * só a coluna "nome" precisa de uma limpeza (cortar a partir da 1ª data).
 */

const _COLS_JORNADA = {
    codigo:     [0, 20],
    nome:       [20, 118],
    // 118–280: Data de Admissão / Cargo / Nº CTPS / Série — não capturados
    dia:        [285, 345],
    entrada:    [345, 372],
    intervalo:  [372, 400],
    saida:      [400, 430],
    observacao: [430, 500]
    // >=500: Visto Fiscal — não capturado
};

function _colunaJornada(x) {
    for (const nome of Object.keys(_COLS_JORNADA)) {
        const [min, max] = _COLS_JORNADA[nome];
        if (x >= min && x < max) return nome;
    }
    return null;
}

function _agruparItensPorLinha(items) {
    const validos = (items || []).filter(it => it && it.str && it.str.trim().length > 0);
    if (validos.length === 0) return [];

    const ordenadosPorY = validos.slice().sort((a, b) => b.transform[5] - a.transform[5]);
    const LIMIAR_Y = 1.0;

    const grupos = [];
    let grupoAtual = null;
    let anchorY = null;
    for (const item of ordenadosPorY) {
        const y = item.transform[5];
        if (grupoAtual === null || Math.abs(y - anchorY) > LIMIAR_Y) {
            grupoAtual = [];
            grupos.push(grupoAtual);
            anchorY = y;
        }
        grupoAtual.push({ str: item.str.trim(), x: item.transform[4] });
    }

    return grupos.map(g => g.slice().sort((a, b) => a.x - b.x));
}

const _RE_EMPRESA_JORNADA = /^(\d+)-(.+)$/;
const _RE_DATA_GRUDADA = /\d{2}\/\d{2}\/\d{4}/;
const _RE_HORA = /^\d{2}:\d{2}$/;
const _RE_INTERVALO = /^(\d{2}:\d{2})\s+as\s+(\d{2}:\d{2})$/i;
const _RE_DIA_FAIXA = /^Segunda\s+[aà]\s+sexta$/i;
const _RE_PAGINA = /^P[aá]gina:?$/i;
const _RE_NUM_PAGINA = /^\d+\/\d+$/;

const _DIA_MAP = {
    'segunda': 'segunda',
    'terça': 'terca', 'terca': 'terca',
    'quarta': 'quarta',
    'quinta': 'quinta',
    'sexta': 'sexta',
    'sábado': 'sabado', 'sabado': 'sabado',
    'domingo': 'domingo'
};
const _DIAS_UTEIS_SEG_SEX = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

const _IGNORAR_PREFIXOS = [
    'CNPJ:', 'Empregador:', 'Endereço:', 'Endereço:',
    'HORÁRIO DE TRABALHO', 'HORÁRIO DE TRABALHO',
    'Sistema licenciado', 'Código', 'Código'
];

function _normalizarDia(texto) {
    if (!texto) return null;
    if (_RE_DIA_FAIXA.test(texto.trim())) return _DIAS_UTEIS_SEG_SEX.slice();
    const chave = texto.trim().toLowerCase();
    return _DIA_MAP[chave] ? [_DIA_MAP[chave]] : null;
}

function _extrairColunas(linha) {
    const porColuna = {};
    for (const item of linha) {
        const col = _colunaJornada(item.x);
        if (!col) continue;
        porColuna[col] = porColuna[col] ? `${porColuna[col]} ${item.str}` : item.str;
    }
    return porColuna;
}

function _parsearLinhasJornada(linhas) {
    const registros = [];
    const avisos = [];
    let empresaAtual = null;
    let empregadoAtual = null;

    for (const linha of (linhas || [])) {
        if (!linha || linha.length === 0) continue;

        const textoLinha = () => linha.map(i => i.str).join(' ');
        const primeiraStr = linha[0].str;

        if (primeiraStr === 'Empresa:') {
            const valor = linha.find(it =>
                it.str !== 'Empresa:' && !_RE_PAGINA.test(it.str) && !_RE_NUM_PAGINA.test(it.str)
            );
            const m = valor && valor.str.match(_RE_EMPRESA_JORNADA);
            if (m) {
                const novoCodigo = m[1].trim();
                // Empresa que continua na página seguinte repete o mesmo cabeçalho
                // (ex.: "Página: 2/2") — não descarta o empregado em andamento nesse caso.
                if (!empresaAtual || empresaAtual.codigo !== novoCodigo) {
                    empregadoAtual = null;
                }
                empresaAtual = { codigo: novoCodigo, nome: m[2].trim() };
            } else {
                avisos.push({ linha: textoLinha(), motivo: 'Cabeçalho de empresa não reconhecido' });
                empregadoAtual = null;
            }
            continue;
        }

        if (_IGNORAR_PREFIXOS.some(p => primeiraStr.startsWith(p))) continue;

        const cols = _extrairColunas(linha);

        if (!cols.dia) continue; // linha sem coluna de dia (rótulos residuais etc.)

        const dias = _normalizarDia(cols.dia);
        if (!dias) {
            avisos.push({ linha: textoLinha(), motivo: `Dia da semana não reconhecido: "${cols.dia}"` });
            continue;
        }

        if (cols.codigo && cols.nome) {
            const nomeLimpo = cols.nome.split(_RE_DATA_GRUDADA)[0].trim();
            empregadoAtual = { codigo: cols.codigo.trim(), nome: nomeLimpo };
        }

        if (!empresaAtual) {
            avisos.push({ linha: textoLinha(), motivo: 'Linha de horário antes de qualquer cabeçalho de empresa' });
            continue;
        }
        if (!empregadoAtual) {
            avisos.push({ linha: textoLinha(), motivo: 'Linha de horário sem empregado associado' });
            continue;
        }

        const isFolga = /folga|compensado/i.test(cols.observacao || '');
        if (isFolga) continue; // dia listado explicitamente como folga/compensado: não é dia trabalhado

        if (!cols.entrada || !_RE_HORA.test(cols.entrada) || !cols.saida || !_RE_HORA.test(cols.saida)) {
            avisos.push({ linha: textoLinha(), motivo: 'Horário de entrada/saída ausente ou inválido' });
            continue;
        }

        let intervaloInicio = null;
        let intervaloFim = null;
        if (cols.intervalo) {
            const mi = cols.intervalo.match(_RE_INTERVALO);
            if (mi) {
                intervaloInicio = mi[1];
                intervaloFim = mi[2];
            } else {
                avisos.push({ linha: textoLinha(), motivo: `Intervalo não reconhecido: "${cols.intervalo}"` });
            }
        }

        for (const dia of dias) {
            registros.push({
                codigo_empresa: empresaAtual.codigo,
                nome_empresa: empresaAtual.nome,
                codigo_empregado: empregadoAtual.codigo,
                nome_empregado: empregadoAtual.nome,
                dia_semana: dia,
                entrada: cols.entrada,
                intervalo_inicio: intervaloInicio,
                intervalo_fim: intervaloFim,
                saida: cols.saida
            });
        }
    }

    return { registros, avisos };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _agruparItensPorLinha,
        _extrairColunas,
        _normalizarDia,
        _parsearLinhasJornada
    };
}
