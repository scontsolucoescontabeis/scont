/**
 * Parsing do PDF "Relação de Férias Calculadas".
 * Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona como
 * <script> global no navegador (funções ficam em `window`/global
 * implícito) e via require() em Node (para os testes).
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

function _dataBRparaISO(dataBR) {
    const [d, m, a] = dataBR.split('/');
    return `${a}-${m}-${d}`;
}

const _RE_DATA = /\d{2}\/\d{2}\/\d{4}/g;
const _RE_EMPRESA = /^Empresa:\s*(\d+)\s*-\s*(.+)$/;
const _RE_IGNORAR = /^(Total da empresa:|Página:|Emissão:|Hora:|CNPJ:|Código|Nome do empregado|Início|Fim|Sistema licenciado|RELAÇÃO DE FÉRIAS|no período de)/;
const _RE_PRIMEIRA_LINHA = /^(\d+)\s+([^\d].*?)\s+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}\/\d{2}\/\d{4}){1,2})\s+[\d.,\s]+$/;
const _RE_LINHA_FIM = /^\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}\/\d{2}\/\d{4}){0,2}\s*[\d.,\s]*$/;

function _parsearLinhasFerias(linhas) {
    const registros = [];
    const avisos = [];
    let empresaAtual = null;
    let pendente = null;

    for (const linha of (linhas || [])) {
        const mEmpresa = linha.match(_RE_EMPRESA);
        if (mEmpresa) {
            if (pendente) {
                avisos.push({ linha: `${pendente.codigo_empregado} ${pendente.nome_empregado}`, motivo: 'Linha de fim não encontrada antes do próximo cabeçalho de empresa' });
            }
            empresaAtual = { codigo: mEmpresa[1].trim(), nome: mEmpresa[2].trim() };
            pendente = null;
            continue;
        }

        if (_RE_IGNORAR.test(linha)) {
            continue;
        }

        const mPrimeira = linha.match(_RE_PRIMEIRA_LINHA);
        if (mPrimeira) {
            if (pendente) {
                avisos.push({ linha: `${pendente.codigo_empregado} ${pendente.nome_empregado}`, motivo: 'Linha de fim não encontrada antes do próximo registro' });
            }
            if (!empresaAtual) {
                avisos.push({ linha, motivo: 'Registro de empregado antes de qualquer cabeçalho de empresa' });
                pendente = null;
                continue;
            }
            const datas = linha.match(_RE_DATA) || [];
            if (datas.length < 2) {
                avisos.push({ linha, motivo: 'Menos de 2 datas na linha de início' });
                pendente = null;
                continue;
            }
            pendente = {
                codigo_empregado: mPrimeira[1].trim(),
                nome_empregado: mPrimeira[2].trim(),
                feriasInicioISO: _dataBRparaISO(datas[1]),
                qtdDatas: datas.length
            };
            continue;
        }

        if (pendente && _RE_LINHA_FIM.test(linha)) {
            const datas = linha.match(_RE_DATA) || [];
            if (datas.length !== pendente.qtdDatas) {
                avisos.push({ linha, motivo: `Linha de fim com ${datas.length} data(s), esperado ${pendente.qtdDatas}` });
                pendente = null;
                continue;
            }
            registros.push({
                codigo_empresa: empresaAtual.codigo,
                nome_empresa: empresaAtual.nome,
                codigo_empregado: pendente.codigo_empregado,
                nome_empregado: pendente.nome_empregado,
                ferias_inicio: pendente.feriasInicioISO,
                ferias_fim: _dataBRparaISO(datas[1])
            });
            pendente = null;
            continue;
        }
    }

    if (pendente) {
        avisos.push({ linha: `${pendente.codigo_empregado} ${pendente.nome_empregado}`, motivo: 'Linha de fim não encontrada até o fim do documento' });
    }

    return { registros, avisos };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _reconstruirLinhasPagina, _dataBRparaISO, _parsearLinhasFerias };
}
