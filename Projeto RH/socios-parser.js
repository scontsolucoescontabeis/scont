/**
 * Parsing do PDF "Sócios Vinculados nas Empresas".
 * Módulo puro: sem DOM, sem Supabase, sem PDF.js. Funciona como
 * <script> global no navegador e via require() em Node (para os testes).
 *
 * Envolto numa IIFE para não colidir com os `const` de mesmo nome já
 * declarados por ferias-parser.js (_RE_DATA, _RE_EMPRESA, _RE_IGNORAR...)
 * no escopo léxico global compartilhado entre <script>s clássicos.
 *
 * A reconstrução das linhas da página é feita por `_reconstruirLinhasPagina`
 * (ferias-parser.js), chamada pelo admin.js antes de passar as linhas aqui.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        Object.assign(root, api);
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // `_dataBRparaISO` vem de ferias-parser.js (global no navegador, require em Node).
    const _dataISO = (typeof module !== 'undefined' && module.exports)
        ? require('./ferias-parser.js')._dataBRparaISO
        : (typeof _dataBRparaISO !== 'undefined' ? _dataBRparaISO : null); // eslint-disable-line no-undef

    // Documento do sócio: CPF (NNN.NNN.NNN-NN) ou CNPJ (NN.NNN.NNN/NNNN-NN).
    // O gerador do PDF insere espaços de kerning entre dígitos, então cada par
    // de caracteres do formato canônico admite um espaço opcional.
    const RE_CNPJ_LOOSE = /\d\s?\d\s?\.\s?\d\s?\d\s?\d\s?\.\s?\d\s?\d\s?\d\s?\/\s?\d\s?\d\s?\d\s?\d\s?-\s?\d\s?\d/;
    const RE_CPF_LOOSE  = /\d\s?\d\s?\d\s?\.\s?\d\s?\d\s?\d\s?\.\s?\d\s?\d\s?\d\s?-\s?\d\s?\d/;
    const RE_CPF  = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    const RE_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

    const RE_DATA_G = /\d{2}\/\d{2}\/\d{4}/g;
    const RE_EMAIL  = /[\w.+-]+@[\w-]+\.[\w.-]+/;

    // Linha de empresa: "COD - NOME  CAPITAL  DATA  [EMAIL]" — sem documento de sócio.
    const RE_LINHA_EMPRESA = /^(\d+)\s*-\s*(.+?)\s+([\d.]+,\d{2})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\S+@\S+))?\s*$/;

    // Cabeçalhos de coluna / topo de página a ignorar.
    const RE_LINHA_IGNORAR = /^(CPF\/CNPJ|Empresa Capital Social|Capital Social|Data Quadro|Societ)/i;

    function _moedaBRparaFloat(valor) {
        if (valor == null || valor === '') return null;
        const n = parseFloat(String(valor).replace(/\./g, '').replace(',', '.'));
        return isNaN(n) ? null : n;
    }

    function _matchDoc(linha) {
        const texto = String(linha || '');
        for (const re of [RE_CNPJ_LOOSE, RE_CPF_LOOSE]) {
            const m = texto.match(re);
            if (!m) continue;
            const limpo = m[0].replace(/\s+/g, '');
            if (RE_CPF.test(limpo) || RE_CNPJ.test(limpo)) {
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

        const datas = (resto.match(RE_DATA_G) || []).filter(d => d !== '00/00/0000');
        const emailM = resto.match(RE_EMAIL);

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
            if (!linha || RE_LINHA_IGNORAR.test(linha)) continue;

            const temDoc = _extrairDoc(linha) !== null;

            if (!temDoc) {
                const mEmp = linha.match(RE_LINHA_EMPRESA);
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

    return { _moedaBRparaFloat, _extrairDoc, _parsearSocio, _parsearLinhasSocios };
});
