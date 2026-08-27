/**
 * Monta a folha gerencial (empregados × rubricas) de UMA competência já
 * parseada pelo extrato-parser.js. Módulo puro: sem DOM. Funciona como
 * <script> global no navegador e via require() em Node (para os testes).
 */

function _descricaoCanonica(descricao) {
    return (descricao || '').replace(/\s+N[º°]\s*[\w\d]+\s*$/, '').trim() || descricao;
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
 * Soma os valores de rubrica de um empregado por código (um empregado
 * pode ter mais de uma linha com o mesmo código, ex.: descontos de
 * empréstimo repetidos).
 */
function _somarValoresPorCodigo(empregado) {
    const totais = new Map();
    for (const r of empregado.rubricas || []) {
        totais.set(r.codigo, (totais.get(r.codigo) || 0) + (r.valor || 0));
    }
    return totais;
}

/**
 * Monta a matriz final: linhas = empregados selecionados (na ordem
 * original), colunas = rubricas selecionadas (proventos, depois
 * descontos). Cada célula é o valor somado daquele código para aquele
 * empregado, ou null se o empregado não tiver aquela rubrica.
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
            const totais = _somarValoresPorCodigo(emp);
            return {
                matricula: emp.matricula,
                tipoRegistro: emp.tipo,
                nome: emp.nome,
                valores: colunas.map(col => totais.has(col.codigo) ? totais.get(col.codigo) : null)
            };
        });

    return { colunas, linhas, nProventos: proventos.filter(r => rubricasSelecionadasCodigos.has(r.codigo)).length };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _descricaoCanonica, construirRubricasDistintas, construirMatriz };
}
if (typeof window !== 'undefined') {
    window.MatrizCompetencia = { _descricaoCanonica, construirRubricasDistintas, construirMatriz };
}
