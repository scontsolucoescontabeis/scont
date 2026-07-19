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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _linhasDaPagina,
        _pareceSolides,
        _extrairCabecalhoColaborador,
        _extrairCompetencia
    };
}
