/**
 * Parsing de contrato social / alteração contratual (texto já extraído).
 * Módulo puro: sem DOM, sem rede. <script> global no navegador + require() em Node.
 *
 * analisarContrato(texto) -> { capa, clausulas, blocoConsolidacao, avisos }
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ContratoParser = api;
})(typeof self !== 'undefined' ? self : this, function () {

    // ─── util ────────────────────────────────────────────────────────────

    function semAcento(s) {
        return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function normalizarEspaco(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Comparação de corpos só para decidir igualdade (o diff usa o original).
     * Remove acento e TODA pontuação — mudança só de pontuação não conta como
     * alteração de cláusula.
     */
    function corpoNormalizado(s) {
        return semAcento(s || '')
            .toLowerCase()
            .replace(/[^a-z0-9%\s]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ─── rodapé repetido da Junta (limpeza) ──────────────────────────────

    const RE_RODAPE = [
        /junta comercial.*(distrito federal|do estado)/i,
        /^certifico registro sob o n[ºo]/i,
        /esta c[óo]pia foi autenticada/i,
        /para validar este documento/i,
        /^p[áa]g\.\s*\d+\s*\/\s*\d+/i,
        /^p[áa]gina\s+\d+\s+de\s+\d+/i,
        /secret[áa]ria?-geral/i,
        /autentica[çc][ãa]o:\s*[0-9A-F]{8,}/i,
        /^registro digital$/i,
    ];

    function limparRodape(texto) {
        return (texto || '')
            .split('\n')
            .filter(linha => {
                const l = linha.trim();
                if (!l) return true;
                return !RE_RODAPE.some(re => re.test(l));
            })
            .join('\n');
    }

    function normalizarTexto(texto) {
        return limparRodape(
            (texto || '')
                .replace(/\r\n?/g, '\n')
                .replace(/[ \t\u00a0]+/g, ' ')
                .replace(/ *\n */g, '\n')
                .replace(/\n{3,}/g, '\n\n')
        ).trim();
    }

    // ─── isolar a CONSOLIDAÇÃO CONTRATUAL ────────────────────────────────

    // "CONSOLIDAÇÃO CONTRATUAL" tolerando o espaçamento "C O N S O L I D A Ç Ã O"
    const RE_CABECALHO_CONSOLIDACAO =
        /^\s*c\s*o\s*n\s*s\s*o\s*l\s*i\s*d\s*a\s*[çc]\s*[ãa]\s*o\s+c\s*o\s*n\s*t\s*r\s*a\s*t\s*u\s*a\s*l\s*$/i;

    const RE_FIM_BLOCO = [
        /^\s*bras[ií]lia\/[a-z]{2},/i,
        /^\s*_{5,}\s*$/,
        /termo de autentica[çc][ãa]o/i,
        /^\s*assinatura eletr[ôo]nica\s*$/i,
    ];

    function extrairBlocoConsolidacao(textoNorm) {
        const linhas = textoNorm.split('\n');
        let inicio = -1;
        for (let i = 0; i < linhas.length; i++) {
            if (RE_CABECALHO_CONSOLIDACAO.test(linhas[i].trim())) inicio = i;
        }
        if (inicio === -1) {
            return { bloco: textoNorm, achou: false };
        }
        let fim = linhas.length;
        for (let i = inicio + 1; i < linhas.length; i++) {
            if (RE_FIM_BLOCO.some(re => re.test(linhas[i]))) { fim = i; break; }
        }
        return { bloco: linhas.slice(inicio + 1, fim).join('\n').trim(), achou: true };
    }

    // ─── segmentar cláusulas ────────────────────────────────────────────

    const ORDINAIS = [
        'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta',
        'setima', 'oitava', 'nona', 'decima', 'decima primeira',
        'decima segunda', 'decima terceira', 'decima quarta', 'decima quinta',
        'decima sexta', 'decima setima', 'decima oitava', 'decima nona',
        'vigesima', 'vigesima primeira', 'vigesima segunda', 'vigesima terceira',
        'vigesima quarta', 'vigesima quinta',
    ];

    function ordinalParaNumero(txt) {
        const chave = normalizarEspaco(semAcento(txt).toLowerCase());
        const idx = ORDINAIS.indexOf(chave);
        return idx === -1 ? null : idx + 1;
    }

    const GRUPO_ORD =
        '(?:d[ée]cima|vig[ée]sima)\\s+(?:primeira|segunda|terceira|quarta|quinta|sexta|s[ée]tima|oitava|nona)' +
        '|primeira|segunda|terceira|quarta|quinta|sexta|s[ée]tima|oitava|nona|d[ée]cima|vig[ée]sima';

    const RE_CABECALHO_CLAUSULA = new RegExp(
        '^\\s*(?:(' + GRUPO_ORD + ')\\s+cl[áa]usula|cl[áa]usula\\s+(' + GRUPO_ORD + '))' +
        '\\s*[–\\-—:.]*\\s*(.*)$',
        'i'
    );

    function segmentarClausulas(bloco) {
        const linhas = (bloco || '').split('\n');
        const clausulas = [];
        let atual = null;

        for (const linha of linhas) {
            const m = linha.match(RE_CABECALHO_CLAUSULA);
            if (m) {
                if (atual) clausulas.push(finalizar(atual));
                const ext = m[1] || m[2];
                atual = {
                    ordinal: ordinalParaNumero(ext),
                    titulo: normalizarEspaco(m[3]).replace(/[–\-—:.\s]+$/, ''),
                    linhasCorpo: [],
                };
            } else if (atual) {
                atual.linhasCorpo.push(linha);
            }
        }
        if (atual) clausulas.push(finalizar(atual));
        return clausulas;

        function finalizar(c) {
            const corpo = normalizarEspaco(c.linhasCorpo.join(' '));
            return {
                ordinal: c.ordinal,
                titulo: c.titulo,
                corpo,
                textoCompleto: normalizarEspaco((c.titulo ? c.titulo + '. ' : '') + corpo),
            };
        }
    }

    // ─── normalização de título (chave de casamento) ────────────────────

    const SINONIMOS_TITULO = {
        'FORUM': 'FORO',
        'ENDERECO': 'SEDE',
        'ENDERECO TRANSFERENCIA DE UF': 'SEDE',
        'ALTERACAO DE ENDERECO': 'SEDE',
        'ALTERACAO DE ENDERECO TRANSFERENCIA DE UF': 'SEDE',
        'TRANSFERENCIA DE SEDE': 'SEDE',
        'DENOMINACAO': 'NOME EMPRESARIAL',
        'DENOMINACAO SOCIAL': 'NOME EMPRESARIAL',
        'ALTERACAO DE OBJETO SOCIAL': 'OBJETO SOCIAL',
        'ALTERACAO DE CAPITAL SOCIAL': 'CAPITAL SOCIAL',
        'FILIAIS E OUTRAS DEPENDENCIAS': 'FILIAIS',
        'ABERTURA DE FILIAL': 'FILIAIS',
        'DA RESPONSABILIDADE DO SOCIO': 'RESPONSABILIDADE DO SOCIO',
        'ADMINISTRACAO': 'ADMINISTRACAO DA SOCIEDADE',
        'PRAZO DE DURACAO E TERMINO DO EXERCICIO SOCIAL': 'PRAZO DE DURACAO',
        'EXERCICIO SOCIAL RESULTADO E SUA DISTRIBUICAO': 'EXERCICIO SOCIAL',
        'EXERCICIO SOCIAL E RESULTADO': 'EXERCICIO SOCIAL',
    };

    function normalizarTitulo(titulo) {
        let t = normalizarEspaco(semAcento(titulo || '').toUpperCase())
            .replace(/[^A-Z0-9 ]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!t) return '';
        if (SINONIMOS_TITULO[t]) return SINONIMOS_TITULO[t];
        return t;
    }

    // ─── dados de capa ─────────────────────────────────────────────────

    const MESES = {
        janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05',
        junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10',
        novembro: '11', dezembro: '12',
    };

    function extrairCapa(textoNorm) {
        const capa = {
            razaoSocial: '', nomeFantasia: '', cnpj: '',
            numeroAlteracao: null, dataAto: '', socios: [],
        };

        const mCnpj = textoNorm.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
        if (mCnpj) capa.cnpj = mCnpj[0];

        const mNum = textoNorm.match(/(\d+)\s*[ªº]?\s*ALTERA[ÇC][ÃA]O\s+CONTRATUAL/i);
        if (mNum) capa.numeroAlteracao = parseInt(mNum[1], 10);

        const mRazaoFant = textoNorm.match(
            /gira sob o nome empresarial\s+(.+?)\s+e\s+nome\s+fantasia\s+([^.\n]+)/i
        );
        if (mRazaoFant) {
            capa.razaoSocial = normalizarEspaco(mRazaoFant[1]);
            capa.nomeFantasia = normalizarEspaco(mRazaoFant[2]).replace(/[.\s]+$/, '');
        } else {
            const mRazao = textoNorm.match(/gira sob o nome empresarial\s+([^.\n]+)/i)
                || textoNorm.match(/\d+ª?\s+ALTERA[ÇC][ÃA]O\s+CONTRATUAL\s+DA\s+SOCIEDADE\s+LIMITADA\s*\n(.+)/i);
            if (mRazao) capa.razaoSocial = normalizarEspaco(mRazao[1]).replace(/[.\s]+$/, '');
        }

        // data do ato: última "Brasília/UF, DD de mês de AAAA"
        const reData = /bras[ií]lia\/[a-z]{2},?\s*(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/gi;
        let md, ultima = null;
        while ((md = reData.exec(textoNorm)) !== null) ultima = md;
        if (ultima) {
            const mes = MESES[semAcento(ultima[2]).toLowerCase()];
            if (mes) capa.dataAto = `${ultima[1].padStart(2, '0')}/${mes}/${ultima[3]}`;
        }
        if (!capa.dataAto) {
            const mReg = textoNorm.match(/COM\s+EFEITOS\s+DO\s+REGISTRO\s+EM:?\s*(\d{2}\/\d{2}\/\d{4})/i)
                || textoNorm.match(/Certifico registro sob o n[ºo]\s*\d+\s*em\s*(\d{2}\/\d{2}\/\d{4})/i);
            if (mReg) capa.dataAto = mReg[1];
        }

        capa.socios = extrairSocios(textoNorm);
        return capa;
    }

    const LETRA_MAI = 'A-ZÁÉÍÓÚÂÊÎÔÛÀÃÕÇ';

    function formatarCpf(digitos) {
        const d = (digitos || '').replace(/\D/g, '');
        if (d.length !== 11) return digitos;
        return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }

    function extrairSocios(textoNorm) {
        const corte = textoNorm.search(/mediante\s+as\s+seguintes|resolvem\s+alterar\s+o\s+contrato/i);
        const preambulo = corte > 0 ? textoNorm.slice(0, corte + 200) : textoNorm.slice(0, 3000);
        const socios = [];
        const vistos = new Set();
        // NOME EM MAIÚSCULAS (>=2 palavras) , brasileir(o|a) ... CPF ... XXX.XXX.XXX-XX
        const re = new RegExp(
            '([' + LETRA_MAI + ']{2,}(?:\\s+(?:[' + LETRA_MAI + ']{2,}|DA|DE|DO|DAS|DOS|E)){1,5})' +
            '\\s*,\\s*brasileir[oa][\\s\\S]{0,240}?CPF[^0-9]{0,14}' +
            '(\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2})',
            'g'
        );
        let m;
        while ((m = re.exec(preambulo)) !== null) {
            const nome = normalizarEspaco(m[1]).replace(/\s+(DA|DE|DO|DAS|DOS|E)$/i, '');
            const cpf = formatarCpf(m[2]);
            if (nome.split(/\s+/).length < 2 || nome.length > 60) continue;
            if (vistos.has(cpf)) continue;
            vistos.add(cpf);
            socios.push({ nome, cpf });
        }
        return socios;
    }

    // ─── entrada principal ─────────────────────────────────────────────

    function analisarContrato(textoBruto) {
        const avisos = [];
        const textoNorm = normalizarTexto(textoBruto);

        const { bloco, achou } = extrairBlocoConsolidacao(textoNorm);
        if (!achou) avisos.push('layout');

        let clausulas = segmentarClausulas(bloco);
        if (clausulas.length === 0) {
            avisos.push('sem-clausulas');
            clausulas = [{
                ordinal: null, titulo: '', corpo: normalizarEspaco(bloco),
                textoCompleto: normalizarEspaco(bloco),
            }];
        }

        return {
            capa: extrairCapa(textoNorm),
            clausulas,
            blocoConsolidacao: bloco,
            avisos,
        };
    }

    return {
        analisarContrato,
        // expostos para testes
        normalizarTexto, limparRodape,
        extrairBlocoConsolidacao, segmentarClausulas,
        normalizarTitulo, ordinalParaNumero,
        extrairCapa, extrairSocios,
        corpoNormalizado, semAcento, normalizarEspaco,
    };
});
