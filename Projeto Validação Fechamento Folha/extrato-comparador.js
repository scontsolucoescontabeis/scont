/**
 * Comparação entre duas competências já parseadas pelo extrato-parser.js.
 * Módulo puro: sem DOM. Funciona como <script> global no navegador e via
 * require() em Node (para os testes).
 */

const LIMIAR_PERCENTUAL_PADRAO = 15;

function _chaveEmpregado(emp) {
    return `${emp.tipo}:${emp.matricula}`;
}

function _competenciaParaOrdem(competencia) {
    const [mes, ano] = competencia.split('/').map(Number);
    return ano * 100 + mes;
}

/**
 * Recebe a lista de competências extraídas de um mesmo PDF (mesma
 * empresa) e devolve { anterior, atual } ordenadas pela data da
 * competência. Se só houver uma, "anterior" vem null.
 */
function ordenarCompetencias(competencias) {
    if (!competencias || competencias.length === 0) return { anterior: null, atual: null };
    if (competencias.length === 1) return { anterior: null, atual: competencias[0] };
    const ordenadas = competencias.slice().sort((a, b) => _competenciaParaOrdem(a.competencia) - _competenciaParaOrdem(b.competencia));
    return { anterior: ordenadas[ordenadas.length - 2], atual: ordenadas[ordenadas.length - 1] };
}

function _deltaPercentual(valorAnterior, valorAtual) {
    if (valorAnterior === null || valorAnterior === undefined) return null;
    if (valorAnterior === 0) {
        if (valorAtual === 0) return 0;
        return null; // variação percentual indefinida (base zero)
    }
    return ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
}

function _compararTotais(anteriorVal, atualVal) {
    const deltaAbsoluto = Math.round(((atualVal ?? 0) - (anteriorVal ?? 0)) * 100) / 100;
    return {
        anterior: anteriorVal,
        atual: atualVal,
        deltaAbsoluto,
        deltaPercentual: _deltaPercentual(anteriorVal, atualVal)
    };
}

function _apurarMudancasQuadro(anterior, atual) {
    const mudancas = [];
    const mapaAnterior = new Map(anterior.empregados.map(e => [_chaveEmpregado(e), e]));
    const mapaAtual = new Map(atual.empregados.map(e => [_chaveEmpregado(e), e]));

    for (const emp of atual.empregados) {
        const anteriorEmp = mapaAnterior.get(_chaveEmpregado(emp));
        if (!anteriorEmp) {
            mudancas.push({ tipo: 'admissao', matricula: emp.matricula, tipoRegistro: emp.tipo, nome: emp.nome, situacao: emp.situacao });
            continue;
        }
        if (emp.ferias && !anteriorEmp.ferias) {
            mudancas.push({ tipo: 'entrouFerias', matricula: emp.matricula, tipoRegistro: emp.tipo, nome: emp.nome, ferias: emp.ferias });
        } else if (!emp.ferias && anteriorEmp.ferias) {
            mudancas.push({ tipo: 'voltouFerias', matricula: emp.matricula, tipoRegistro: emp.tipo, nome: emp.nome, feriasAnterior: anteriorEmp.ferias });
        }
        if (emp.situacao !== anteriorEmp.situacao) {
            mudancas.push({ tipo: 'mudancaSituacao', matricula: emp.matricula, tipoRegistro: emp.tipo, nome: emp.nome, situacaoAnterior: anteriorEmp.situacao, situacaoAtual: emp.situacao });
        }
    }

    for (const emp of anterior.empregados) {
        if (!mapaAtual.has(_chaveEmpregado(emp))) {
            mudancas.push({ tipo: 'saida', matricula: emp.matricula, tipoRegistro: emp.tipo, nome: emp.nome, situacaoAnterior: emp.situacao, demissao: emp.demissao || null });
        }
    }

    return mudancas;
}

function _apurarVariacaoTotais(anterior, atual, limiarPercentual) {
    const mapaAnterior = new Map(anterior.empregados.map(e => [_chaveEmpregado(e), e]));
    const linhas = [];

    for (const emp of atual.empregados) {
        const anteriorEmp = mapaAnterior.get(_chaveEmpregado(emp));
        if (!anteriorEmp) continue; // admissões entram só em mudancasQuadro

        const proventos = _compararTotais(anteriorEmp.proventos, emp.proventos);
        const descontos = _compararTotais(anteriorEmp.descontos, emp.descontos);
        const liquido = _compararTotais(anteriorEmp.liquido, emp.liquido);

        const deltas = [proventos.deltaPercentual, descontos.deltaPercentual, liquido.deltaPercentual].filter(d => d !== null);
        const acimaDoLimiar = deltas.some(d => Math.abs(d) > limiarPercentual)
            || [proventos, descontos, liquido].some(t => t.deltaPercentual === null && t.deltaAbsoluto !== 0);

        linhas.push({
            matricula: emp.matricula,
            tipoRegistro: emp.tipo,
            nome: emp.nome,
            proventos, descontos, liquido,
            acimaDoLimiar
        });
    }

    linhas.sort((a, b) => Math.abs(b.liquido.deltaAbsoluto) - Math.abs(a.liquido.deltaAbsoluto));
    return linhas;
}

function compararCompetencias(anterior, atual, opcoes) {
    const limiarPercentual = (opcoes && opcoes.limiarPercentual) || LIMIAR_PERCENTUAL_PADRAO;

    const totalGeral = {
        proventos: _compararTotais(anterior.totalGeral?.proventos ?? null, atual.totalGeral?.proventos ?? null),
        descontos: _compararTotais(anterior.totalGeral?.descontos ?? null, atual.totalGeral?.descontos ?? null),
        liquido: _compararTotais(anterior.totalGeral?.liquido ?? null, atual.totalGeral?.liquido ?? null)
    };

    return {
        competenciaAnterior: anterior.competencia,
        competenciaAtual: atual.competencia,
        limiarPercentual,
        totalGeral,
        mudancasQuadro: _apurarMudancasQuadro(anterior, atual),
        variacaoTotais: _apurarVariacaoTotais(anterior, atual, limiarPercentual)
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LIMIAR_PERCENTUAL_PADRAO,
        _chaveEmpregado,
        _deltaPercentual,
        ordenarCompetencias,
        compararCompetencias
    };
}
if (typeof window !== 'undefined') {
    window.ExtratoComparador = {
        LIMIAR_PERCENTUAL_PADRAO,
        _chaveEmpregado,
        _deltaPercentual,
        ordenarCompetencias,
        compararCompetencias
    };
}
