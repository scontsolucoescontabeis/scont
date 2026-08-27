/**
 * Monta a folha gerencial (empregados × rubricas) de UMA competência já
 * parseada pelo extrato-parser.js. Módulo puro: sem DOM. Funciona como
 * <script> global no navegador e via require() em Node (para os testes).
 */

function _descricaoCanonica(descricao) {
    return (descricao || '').replace(/\s+N[º°]\s*[\w\d]+\s*$/, '').trim() || descricao;
}

function _parseNumeroBR(str) {
    if (str === null || str === undefined) return null;
    const limpo = String(str).trim().replace(/\./g, '').replace(',', '.');
    if (limpo === '' || limpo === '-') return null;
    const n = parseFloat(limpo);
    return Number.isNaN(n) ? null : n;
}

function _formatarNumeroBR(n) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _formatarMinutosComoHora(totalMinutos) {
    const negativo = totalMinutos < 0;
    const abs = Math.round(Math.abs(totalMinutos));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return (negativo ? '-' : '') + h + ':' + String(m).padStart(2, '0');
}

/**
 * Soma referências de rubrica (uma por linha, quando o código se repete
 * no mesmo empregado). Referências em formato hora (hh:mm) são somadas
 * em minutos e reformatadas; as demais são somadas como número
 * decimal brasileiro.
 */
function _somarReferencias(referencias) {
    const temTempo = referencias.some(r => r.includes(':'));
    if (temTempo) {
        const totalMinutos = referencias.reduce((acc, r) => {
            if (r.includes(':')) {
                const [h, m] = r.split(':').map(Number);
                return acc + h * 60 + m;
            }
            return acc + (_parseNumeroBR(r) || 0);
        }, 0);
        return _formatarMinutosComoHora(totalMinutos);
    }
    const total = referencias.reduce((acc, r) => acc + (_parseNumeroBR(r) || 0), 0);
    return _formatarNumeroBR(total);
}

/**
 * Une as rubricas de todos os empregados da competência em duas listas
 * (proventos/descontos), uma entrada por código distinto, ordenadas por
 * código. A descrição usada é a "canônica" (sem número de contrato) do
 * primeiro empregado em que o código aparece.
 */
function construirRubricasDistintas(empregados) {
    const mapa = new Map();
    for (const emp of empregados) {
        for (const r of emp.rubricas || []) {
            if (!mapa.has(r.codigo)) {
                mapa.set(r.codigo, { codigo: r.codigo, descricao: _descricaoCanonica(r.descricao), tipo: r.tipo });
            }
        }
    }
    const todas = Array.from(mapa.values())
        .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    return {
        proventos: todas.filter(r => r.tipo === 'P'),
        descontos: todas.filter(r => r.tipo === 'D')
    };
}

/**
 * Agrupa as rubricas de um empregado por código, somando valor e
 * referência (um empregado pode ter mais de uma linha com o mesmo
 * código, ex.: descontos de empréstimo repetidos).
 */
function _agruparPorCodigo(empregado) {
    const grupos = new Map();
    for (const r of empregado.rubricas || []) {
        if (!grupos.has(r.codigo)) grupos.set(r.codigo, { valor: 0, referencias: [] });
        const g = grupos.get(r.codigo);
        g.valor += (r.valor || 0);
        g.referencias.push(r.referencia);
    }
    return grupos;
}

/**
 * Monta a matriz final: linhas = empregados selecionados (na ordem
 * original), colunas = rubricas selecionadas (proventos, depois
 * descontos). Cada célula é { referencia, valor } daquele código para
 * aquele empregado, ou null se o empregado não tiver aquela rubrica.
 */
function construirMatriz(empregados, rubricasSelecionadasCodigos, empregadosSelecionadosChaves, chaveEmpregadoFn) {
    const chaveDe = chaveEmpregadoFn || ((e) => `${e.tipo}:${e.matricula}`);
    const { proventos, descontos } = construirRubricasDistintas(empregados);
    const colunas = [
        ...proventos.filter(r => rubricasSelecionadasCodigos.has(r.codigo)),
        ...descontos.filter(r => rubricasSelecionadasCodigos.has(r.codigo))
    ];

    const linhas = empregados
        .filter(e => empregadosSelecionadosChaves.has(chaveDe(e)))
        .map(emp => {
            const grupos = _agruparPorCodigo(emp);
            return {
                matricula: emp.matricula,
                tipoRegistro: emp.tipo,
                nome: emp.nome,
                valores: colunas.map(col => {
                    if (!grupos.has(col.codigo)) return null;
                    const g = grupos.get(col.codigo);
                    return { referencia: _somarReferencias(g.referencias), valor: g.valor };
                })
            };
        });

    return { colunas, linhas, nProventos: proventos.filter(r => rubricasSelecionadasCodigos.has(r.codigo)).length };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _descricaoCanonica, _somarReferencias, construirRubricasDistintas, construirMatriz };
}
if (typeof window !== 'undefined') {
    window.MatrizCompetencia = { _descricaoCanonica, _somarReferencias, construirRubricasDistintas, construirMatriz };
}
