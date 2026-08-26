/**
 * Parsing do PDF "Extrato Mensal" (relatório de folha por competência).
 * Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona como
 * <script> global no navegador e via require() em Node (para os testes).
 *
 * O PDF pode conter uma ou mais competências em sequência (uma atrás da
 * outra, cada uma com seu próprio conjunto de páginas). Cada competência
 * repete o mesmo cabeçalho (Empresa/CNPJ/Competência) em toda página.
 */

function _reconstruirLinhasPagina(items) {
    const validos = (items || []).filter(it => it && it.str && it.str.length > 0);
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
        grupoAtual.push(item);
    }

    return grupos
        .map(g => g.slice()
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map(it => it.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim())
        .filter(linha => linha.length > 0);
}

function _parseNumeroBR(str) {
    if (str === null || str === undefined) return null;
    const limpo = String(str).trim().replace(/\./g, '').replace(',', '.');
    if (limpo === '' || limpo === '-') return null;
    const n = parseFloat(limpo);
    return Number.isNaN(n) ? null : n;
}

const _RE_EMPRESA = /^Empresa:\s*(.+?)\s+Página:\s*\d+\/\d+/;
const _RE_EMPRESA_CODIGO_NOME = /^(\d+)\s*-\s*(.+)$/;
const _RE_CNPJ = /^CNPJ:\s*([\d.\/-]+)/;
const _RE_COMPETENCIA = /^Competência:\s*(\d{2}\/\d{4})/;

const _RE_EMPREGADO = /^(Empr\.|Contr):\s*(\d+)\s+(.+?)\s+Situação:\s*(.+?)\s+CPF:\s*([\d.\-]+)\s+Adm:\s*(\d{2}\/\d{2}\/\d{4})/;
const _RE_VINCULO = /^Vínculo:\s*(.+?)\s+CC:\s*(\S+)\s+Depto:\s*(\S+)\s+Horas Mês:\s*([\d.,]*)/;
const _RE_CARGO = /^Cargo:\s*(\d+)\s+(.+?)\s+C\.B\.O:\s*(\S+)\s+Filial:\s*(\S+)\s+Salário:\s*([\d.,]+)/;
const _RE_RUBRICA = /(\d{1,5})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,3}:\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+([PD])(?=\s|$)/g;
const _RE_ND = /^ND:\s*(\d+)\s*Proventos:\s*([\d.,]+)\s*Descontos:\s*([\d.,]+)\s*([\d.,]+)\s*([\d.,]+)\s*Líquido:\s*([\d.,]+)/;
const _RE_NF = /^NF:\s*(\d+)\s*Base INSS:\s*([\d.,]+)\s*Excedente INSS:\s*([\d.,]+)\s*Base FGTS:\s*([\d.,]+)\s*Valor FGTS:\s*([\d.,]+)\s*Base IRRF:\s*(-?[\d.,]+)/;
const _RE_FERIAS = /FERIAS DE (\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/;
const _RE_DEMITIDO = /DEMITIDO EM (\d{2}\/\d{2}\/\d{4})\s*-\s*MOTIVO\s+(.+?)(?:\s*$)/;
const _RE_SUSPENSAO = /^Suspensão:\s*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/;
const _RE_TOTAL_GERAL = /^Total Geral Proventos:\s*([\d.,]+)\s*Total Geral Descontos:\s*([\d.,]+)/;
const _RE_LIQUIDO_GERAL = /^Líquido Geral:\s*([\d.,]+)/;
const _RE_INICIO_TOTAIS_PAGINA = /^INSS\s+FGTS, PIS e ISS/;

function _extrairRubricasDaLinha(linha) {
    const rubricas = [];
    _RE_RUBRICA.lastIndex = 0;
    let m;
    while ((m = _RE_RUBRICA.exec(linha))) {
        rubricas.push({
            codigo: m[1],
            descricao: m[2].trim(),
            referencia: m[3],
            valor: _parseNumeroBR(m[4]),
            tipo: m[5]
        });
    }
    return rubricas;
}

/**
 * Processa a lista completa de linhas reconstruídas (todas as páginas do
 * PDF, em ordem, já concatenadas em um único array) e devolve uma
 * competência por documento encontrado.
 */
function parseExtratoMensal(linhas) {
    const competencias = [];
    let atual = null;
    let empregadoAtual = null;
    let dentroDeTotaisPagina = false;

    let empresaCodigoPagina = null;
    let empresaNomePagina = null;
    let cnpjPagina = null;

    function finalizarEmpregado() {
        if (empregadoAtual) {
            atual.empregados.push(empregadoAtual);
            empregadoAtual = null;
        }
    }

    function ultimoEmpregado() {
        if (!atual || atual.empregados.length === 0) return null;
        return atual.empregados[atual.empregados.length - 1];
    }

    for (const linha of linhas) {
        let m;

        if ((m = _RE_EMPRESA.exec(linha))) {
            empresaNomePagina = m[1];
            const partes = _RE_EMPRESA_CODIGO_NOME.exec(m[1]);
            if (partes) {
                empresaCodigoPagina = partes[1];
                empresaNomePagina = partes[2];
            } else {
                empresaCodigoPagina = null;
            }
            continue;
        }
        if ((m = _RE_CNPJ.exec(linha))) {
            cnpjPagina = m[1];
            continue;
        }
        if ((m = _RE_COMPETENCIA.exec(linha))) {
            const competencia = m[1];
            if (!atual || atual.competencia !== competencia || atual.cnpj !== cnpjPagina) {
                finalizarEmpregado();
                if (atual) competencias.push(atual);
                atual = {
                    competencia,
                    empresaCodigo: empresaCodigoPagina,
                    empresaNome: empresaNomePagina,
                    cnpj: cnpjPagina,
                    empregados: [],
                    totalGeral: null
                };
            }
            dentroDeTotaisPagina = false;
            continue;
        }
        if (linha === 'EXTRATO MENSAL' || linha.startsWith('Sistema licenciado')) {
            continue;
        }
        if (!atual) continue;

        if (_RE_INICIO_TOTAIS_PAGINA.test(linha)) {
            finalizarEmpregado();
            dentroDeTotaisPagina = true;
            continue;
        }

        if ((m = _RE_EMPREGADO.exec(linha))) {
            finalizarEmpregado();
            dentroDeTotaisPagina = false;
            empregadoAtual = {
                tipo: m[1].replace('.', ''),
                matricula: m[2],
                nome: m[3].trim(),
                situacao: m[4].trim(),
                cpf: m[5],
                admissao: m[6],
                vinculo: null, cc: null, depto: null, horasMes: null,
                cargoCodigo: null, cargoNome: null, cbo: null, filial: null, salario: null,
                rubricas: [],
                proventos: null, descontos: null, informativa: null, informativaDedutora: null, liquido: null,
                baseInss: null, excedenteInss: null, baseFgts: null, valorFgts: null, baseIrrf: null,
                ferias: null, demissao: null, suspensao: null
            };
            continue;
        }

        if (dentroDeTotaisPagina) continue;

        if (!empregadoAtual) {
            // linhas fora de um bloco de empregado (ex.: Total Geral) tratadas abaixo
        } else {
            if ((m = _RE_VINCULO.exec(linha))) {
                empregadoAtual.vinculo = m[1].trim();
                empregadoAtual.cc = m[2];
                empregadoAtual.depto = m[3];
                empregadoAtual.horasMes = _parseNumeroBR(m[4]);
                continue;
            }
            if ((m = _RE_CARGO.exec(linha))) {
                empregadoAtual.cargoCodigo = m[1];
                empregadoAtual.cargoNome = m[2].trim();
                empregadoAtual.cbo = m[3];
                empregadoAtual.filial = m[4];
                empregadoAtual.salario = _parseNumeroBR(m[5]);
                continue;
            }
            if ((m = _RE_ND.exec(linha))) {
                empregadoAtual.numeroDependentes = parseInt(m[1], 10);
                empregadoAtual.proventos = _parseNumeroBR(m[2]);
                empregadoAtual.descontos = _parseNumeroBR(m[3]);
                empregadoAtual.informativa = _parseNumeroBR(m[4]);
                empregadoAtual.informativaDedutora = _parseNumeroBR(m[5]);
                empregadoAtual.liquido = _parseNumeroBR(m[6]);
                continue;
            }
            if ((m = _RE_NF.exec(linha))) {
                empregadoAtual.baseInss = _parseNumeroBR(m[2]);
                empregadoAtual.excedenteInss = _parseNumeroBR(m[3]);
                empregadoAtual.baseFgts = _parseNumeroBR(m[4]);
                empregadoAtual.valorFgts = _parseNumeroBR(m[5]);
                empregadoAtual.baseIrrf = _parseNumeroBR(m[6]);
                finalizarEmpregado();
                continue;
            }
            if (/^\d{1,5}\s/.test(linha)) {
                empregadoAtual.rubricas.push(..._extrairRubricasDaLinha(linha));
                continue;
            }
        }

        if ((m = _RE_TOTAL_GERAL.exec(linha))) {
            atual.totalGeral = atual.totalGeral || {};
            atual.totalGeral.proventos = _parseNumeroBR(m[1]);
            atual.totalGeral.descontos = _parseNumeroBR(m[2]);
            continue;
        }
        if ((m = _RE_LIQUIDO_GERAL.exec(linha))) {
            atual.totalGeral = atual.totalGeral || {};
            atual.totalGeral.liquido = _parseNumeroBR(m[1]);
            continue;
        }

        const ultimo = ultimoEmpregado();
        if (ultimo) {
            if ((m = _RE_FERIAS.exec(linha))) {
                ultimo.ferias = { inicio: m[1], fim: m[2] };
            }
            if ((m = _RE_DEMITIDO.exec(linha))) {
                ultimo.demissao = { data: m[1], motivo: m[2].trim() };
            }
            if ((m = _RE_SUSPENSAO.exec(linha))) {
                ultimo.suspensao = { inicio: m[1], fim: m[2] };
            }
        }
    }

    finalizarEmpregado();
    if (atual) competencias.push(atual);

    return competencias;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _reconstruirLinhasPagina,
        _parseNumeroBR,
        _extrairRubricasDaLinha,
        parseExtratoMensal
    };
}
if (typeof window !== 'undefined') {
    window.ExtratoParser = {
        _reconstruirLinhasPagina,
        _parseNumeroBR,
        _extrairRubricasDaLinha,
        parseExtratoMensal
    };
}
