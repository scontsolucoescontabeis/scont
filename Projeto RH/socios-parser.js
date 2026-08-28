/**
 * Parsing do PDF "Sócios Vinculados nas Empresas".
 * Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona como
 * <script> global no navegador e via require() em Node (para os testes).
 *
 * A reconstrução das linhas da página (agrupar itens por y, ordenar por x)
 * é feita por `_reconstruirLinhasPagina`, definido em ferias-parser.js e
 * reaproveitado aqui — no navegador via global, em Node via require.
 */

// Reaproveita `_dataBRparaISO` de ferias-parser.js. No navegador ele é uma
// função global (script carregado antes) — NÃO redeclarar com esse nome aqui,
// senão `const` colide com a propriedade global não-configurável. Em Node vem
// via require para os testes.
const _dataISO = (typeof module !== 'undefined' && module.exports)
    ? require('./ferias-parser.js')._dataBRparaISO
    : _dataBRparaISO; // eslint-disable-line no-undef

// Documento do sócio: CPF (NNN.NNN.NNN-NN) ou CNPJ (NN.NNN.NNN/NNNN-NN).
// O gerador do PDF insere espaços de kerning entre dígitos, então cada par
// de caracteres do formato canônico admite um espaço opcional.
const _RE_CNPJ_LOOSE = /\d\s?\d\s?\.\s?\d\s?\d\s?\d\s?\.\s?\d\s?\d\s?\d\s?\/\s?\d\s?\d\s?\d\s?\d\s?-\s?\d\s?\d/;
const _RE_CPF_LOOSE  = /\d\s?\d\s?\d\s?\.\s?\d\s?\d\s?\d\s?\.\s?\d\s?\d\s?\d\s?-\s?\d\s?\d/;
const _RE_CPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const _RE_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

const _RE_DATA = /\d{2}\/\d{2}\/\d{4}/g;
const _RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

// Linha de empresa: "COD - NOME  CAPITAL  DATA  [EMAIL]" — sem documento de sócio.
const _RE_EMPRESA = /^(\d+)\s*-\s*(.+?)\s+([\d.]+,\d{2})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\S+@\S+))?\s*$/;

// Cabeçalhos de coluna / topo de página a ignorar.
const _RE_IGNORAR = /^(CPF\/CNPJ|Empresa Capital Social|Capital Social|Data Quadro|Societ)/i;

function _moedaBRparaFloat(valor) {
    if (valor == null || valor === '') return null;
    const n = parseFloat(String(valor).replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
}

function _matchDoc(linha) {
    const texto = String(linha || '');
    for (const re of [_RE_CNPJ_LOOSE, _RE_CPF_LOOSE]) {
        const m = texto.match(re);
        if (!m) continue;
        const limpo = m[0].replace(/\s+/g, '');
        if (_RE_CPF.test(limpo) || _RE_CNPJ.test(limpo)) {
            return { raw: m[0], limpo };
        }
    }
    return null;
}

function _extrairDoc(linha) {
    const m = _matchDoc(linha);
    return m ? m.limpo : null;
}

function _ehEmpresaExemplo(codigo, nome) {
    return codigo === '9999' || /EMPRESA\s+EXEMPLO/i.test(nome || '');
}

function _parsearSocio(linha, contexto) {
    const docM = _matchDoc(linha);
    const doc = docM ? docM.limpo : null;
    const semDoc = (docM ? linha.replace(docM.raw, ' ') : linha).replace(/\s+/g, ' ').trim();

    // Caso normal: "COD - NOME  PART  ..." com espaço antes da participação.
    // Fallback: nomes longos colam na coluna de participação ("...PORTUGAL100,00");
    // aceita só quando o nome resultante não contém dígitos (senão o layout
    // interleaveou os dígitos no nome e o registro fica corrompido).
    let m = semDoc.match(/^(\d+)\s*-\s*(.+?)\s+(\d{1,3},\d{2})\s+(.*)$/);
    if (!m) {
        const g = semDoc.match(/^(\d+)\s*-\s*(.+?)(?<!\d)(\d{1,3},\d{2})\s+(.*)$/);
        if (g && !/\d/.test(g[2])) m = g;
    }
    if (!m) return null;

    const nome = m[2].replace(/\s+/g, ' ').trim();
    const participacao = _moedaBRparaFloat(m[3]);
    const resto = m[4];

    const datas = (resto.match(_RE_DATA) || []).filter(d => d !== '00/00/0000');
    const emailM = resto.match(_RE_EMAIL);

    return {
        codigo_empresa:          contexto.codigo_empresa,
        capital_social:          contexto.capital_social,
        email_empresa:           contexto.email_empresa,
        data_atualizacao_quadro: contexto.data_atualizacao_quadro,
        cpf:                     doc,
        nome_socio:              nome,
        participacao:            participacao,
        data_entrada:            datas[0] ? _dataISO(datas[0]) : null,
        data_saida:              datas[1] ? _dataISO(datas[1]) : null,
        email_socio:             emailM ? emailM[0] : null,
    };
}

function _parsearLinhasSocios(linhas) {
    const registros = [];
    const avisos = [];
    let contexto = null;

    for (const bruta of (linhas || [])) {
        const linha = String(bruta || '').replace(/\s+/g, ' ').trim();
        if (!linha || _RE_IGNORAR.test(linha)) continue;

        const temDoc = _extrairDoc(linha) !== null;

        if (!temDoc) {
            const mEmp = linha.match(_RE_EMPRESA);
            if (mEmp) {
                const codigo = mEmp[1].trim();
                const nomeEmpresa = mEmp[2].trim();
                if (_ehEmpresaExemplo(codigo, nomeEmpresa)) {
                    contexto = { ignorar: true };
                    continue;
                }
                contexto = {
                    codigo_empresa:          codigo,
                    capital_social:          _moedaBRparaFloat(mEmp[3]),
                    data_atualizacao_quadro: mEmp[4] ? _dataISO(mEmp[4]) : null,
                    email_empresa:           mEmp[5] ? mEmp[5].trim() : null,
                };
                continue;
            }
            if (/^\d+\s*-\s*/.test(linha)) {
                avisos.push({ linha, motivo: 'Linha iniciada por "código -" não reconhecida como empresa nem sócio' });
            }
            continue;
        }

        // Linha de sócio.
        if (!contexto) {
            avisos.push({ linha, motivo: 'Sócio encontrado antes de qualquer empresa' });
            continue;
        }
        if (contexto.ignorar) continue;

        const socio = _parsearSocio(linha, contexto);
        if (!socio) {
            avisos.push({ linha, motivo: 'Linha de sócio não reconhecida' });
            continue;
        }
        registros.push(socio);
    }

    return { registros, avisos };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _moedaBRparaFloat, _extrairDoc, _parsearSocio, _parsearLinhasSocios };
}
