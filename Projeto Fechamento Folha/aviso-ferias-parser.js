/**
 * Parsing do PDF "Aviso de Férias" (modelo: Aviso Prévio de Férias.pdf).
 * Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona como
 * <script> global no navegador e via require() em Node (para os testes).
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

const _RE_TITULO_AVISO = /AVISO\s+DE\s+F[EÉ]RIAS/i;
const _RE_TITULO_ABONO = /SOLICITA[ÇC][AÃ]O\s+DE\s+ABONO/i;

function _classificarTipoPagina(linhas) {
    const primeira = (linhas || []).find(l => l.trim().length > 0);
    if (!primeira) return null;
    if (_RE_TITULO_ABONO.test(primeira)) return 'abono';
    if (_RE_TITULO_AVISO.test(primeira)) return 'aviso';
    return null;
}

const _RE_SR_SRA = /^(?:Sr|Sra)\.?:\s*(.+)$/i;
const _RE_CTPS = /^C\.T\.P\.S\.:\s*(\S+)/i;
const _RE_PERIODO_AQUISITIVO = /Per[íi]odo\s+Aquisitivo\.*\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i;
const _RE_PERIODO_GOZO = /Per[íi]odo\s+de\s+Gozo\.*\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i;
const _RE_RETORNO = /Retorno\s+ao\s+trabalho\.*\s*:\s*(\d{2}\/\d{2}\/\d{4})/i;
const _RE_BOILERPLATE_FIM = /anota[çc][õo]es\s+necess[áa]rias\.?\s*$/i;

function _extrairNomeEmpresaAssinatura(linhas, idxBoilerplate, nomeEmpregado) {
    if (idxBoilerplate < 0 || !nomeEmpregado) return null;
    const bloco = linhas.slice(idxBoilerplate + 1).filter(l => l.trim().length > 0);
    if (bloco.length === 0) return null;

    const nomeUpper = nomeEmpregado.trim().toUpperCase();
    const idxLinhaComNome = bloco.findIndex(l => l.toUpperCase().includes(nomeUpper));
    if (idxLinhaComNome === -1) {
        return bloco.join(' ').replace(/\s+/g, ' ').trim();
    }

    const linhaComNome = bloco[idxLinhaComNome];
    const idxPos = linhaComNome.toUpperCase().indexOf(nomeUpper);
    const partePrefixo = linhaComNome.slice(0, idxPos).trim();
    const outrasLinhas = bloco.filter((_, i) => i !== idxLinhaComNome);

    return [partePrefixo, ...outrasLinhas]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function _extrairDadosAviso(linhas) {
    const dados = {
        nome_empregado: null, ctps: null,
        periodo_aquisitivo_inicio: null, periodo_aquisitivo_fim: null,
        periodo_gozo_inicio: null, periodo_gozo_fim: null,
        retorno_trabalho: null, nome_empresa: null
    };

    let idxBoilerplate = -1;
    (linhas || []).forEach((linha, idx) => {
        const mSr = linha.match(_RE_SR_SRA);
        if (mSr && !dados.nome_empregado) dados.nome_empregado = mSr[1].trim();

        const mCtps = linha.match(_RE_CTPS);
        if (mCtps) dados.ctps = mCtps[1].trim();

        const mAquis = linha.match(_RE_PERIODO_AQUISITIVO);
        if (mAquis) { dados.periodo_aquisitivo_inicio = mAquis[1]; dados.periodo_aquisitivo_fim = mAquis[2]; }

        const mGozo = linha.match(_RE_PERIODO_GOZO);
        if (mGozo) { dados.periodo_gozo_inicio = mGozo[1]; dados.periodo_gozo_fim = mGozo[2]; }

        const mRet = linha.match(_RE_RETORNO);
        if (mRet) dados.retorno_trabalho = mRet[1];

        if (_RE_BOILERPLATE_FIM.test(linha)) idxBoilerplate = idx;
    });

    dados.nome_empresa = _extrairNomeEmpresaAssinatura(linhas, idxBoilerplate, dados.nome_empregado);
    return dados;
}

const _RE_EMPRESA_CNPJ = /Empresa:\s*(.+?)\s*CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i;
const _RE_CADASTRO_CPF = /Cadastro:\s*(\d+)\s*-\s*(.+?)\s*CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})?/i;

function _extrairDadosAbono(linhas) {
    const dados = { nome_empresa: null, cnpj: null, cadastro_codigo: null, nome_empregado: null, cpf: null };

    for (const linha of (linhas || [])) {
        const mEmp = linha.match(_RE_EMPRESA_CNPJ);
        if (mEmp) { dados.nome_empresa = mEmp[1].trim(); dados.cnpj = mEmp[2].trim(); }

        const mCad = linha.match(_RE_CADASTRO_CPF);
        if (mCad) {
            dados.cadastro_codigo = mCad[1].trim();
            dados.nome_empregado = mCad[2].trim();
            dados.cpf = mCad[3] ? mCad[3].trim() : null;
        }
    }
    return dados;
}

function _normalizarNome(s) {
    return String(s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function _normalizarCNPJ(s) {
    return String(s || '').replace(/\D/g, '');
}

function _montarRegistrosEmpregados(paginas) {
    const registros = [];
    const avisos = [];
    let i = 0;
    const lista = paginas || [];

    while (i < lista.length) {
        const pg = lista[i];
        if (pg.tipo !== 'aviso') {
            avisos.push({ pagina: pg.numero, motivo: `Página ${pg.numero} não é do tipo "aviso" e não foi associada a nenhum registro anterior` });
            i++;
            continue;
        }

        const registro = {
            nome_empregado: pg.dados.nome_empregado,
            nome_empresa: pg.dados.nome_empresa,
            cnpj: null,
            paginas: [pg.numero]
        };

        const prox = lista[i + 1];
        if (prox && prox.tipo === 'abono' &&
            _normalizarNome(prox.dados.nome_empregado) === _normalizarNome(pg.dados.nome_empregado)) {
            registro.cnpj = _normalizarCNPJ(prox.dados.cnpj || '') || null;
            if (prox.dados.nome_empresa) registro.nome_empresa = prox.dados.nome_empresa;
            registro.paginas.push(prox.numero);
            i += 2;
        } else {
            i += 1;
        }

        registros.push(registro);
    }

    return { registros, avisos };
}

function _agruparPorEmpresa(registros) {
    const grupos = new Map();
    for (const r of (registros || [])) {
        const chave = r.cnpj ? r.cnpj : `NOME:${_normalizarNome(r.nome_empresa)}`;
        if (!grupos.has(chave)) {
            grupos.set(chave, { chave, nome_empresa: r.nome_empresa, cnpj: r.cnpj || null, empregados: [], paginas: [] });
        }
        const g = grupos.get(chave);
        g.empregados.push(r.nome_empregado);
        g.paginas.push(...r.paginas);
    }
    return Array.from(grupos.values());
}

function _resolverCodigoEmpresa(cnpjNormalizado, mapaPorCnpj) {
    if (!cnpjNormalizado || !mapaPorCnpj) return null;
    return mapaPorCnpj[cnpjNormalizado] || null;
}

function _sanitizarNomeArquivo(s) {
    return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim();
}

function _montarNomeArquivo(codigo, intervalo) {
    return `${codigo}_AVISO DE FERIAS_${_sanitizarNomeArquivo(intervalo)}.pdf`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        _reconstruirLinhasPagina, _classificarTipoPagina,
        _extrairDadosAviso, _extrairDadosAbono,
        _normalizarNome, _normalizarCNPJ,
        _montarRegistrosEmpregados, _agruparPorEmpresa,
        _resolverCodigoEmpresa, _sanitizarNomeArquivo, _montarNomeArquivo
    };
}
