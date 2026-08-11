/**
 * SCONT – Fechamento Folha de Pagamento
 * Funções de casamento de nome (normalização, Levenshtein, similaridade) e
 * parsing monetário básico, compartilhadas por quadrante.js / trackfield.js
 * / ananke.js.
 *
 * Antes cada um dos 3 arquivos tinha sua própria cópia dessas funções —
 * normalizarNome/levenshtein/similaridade eram idênticas nos três;
 * parseMoney e buscarCodigoEmpregado eram idênticas em quadrante.js e
 * ananke.js, mas trackfield.js já tinha divergido de propósito (parseMoney
 * soma múltiplos "R$" para COMISSÃO DOMINGOS/FERIADOS; buscarCodigoEmpregado
 * usa mapas por loja, não um mapa único). Corrigir um bug no algoritmo de
 * casamento (ex.: no Levenshtein) exigia replicar a correção nos 3 lugares.
 *
 * Aqui só entra o que é 100% idêntico e seguro de unificar sem mudar
 * comportamento: normalizarNome/levenshtein/similaridade (usadas pelas 3
 * empresas, sem parâmetro específico de empresa) + um helper de busca fuzzy
 * genérico + a versão "básica" de parseMoney (igual em quadrante.js e
 * ananke.js). trackfield.js mantém seu buscarCodigoEmpregado e parseMoney
 * próprios — só passou a reaproveitar normalizarNome/levenshtein/
 * similaridade daqui, sem alterar a lógica de multi-loja/soma de R$ que já
 * tinha.
 *
 * Script solto (sem bundler) — carregar via <script> ANTES de
 * quadrante.js/trackfield.js/ananke.js, que consomem essas funções como
 * globais (mesmo padrão do resto do portal, sem framework/build step).
 */
(function (root) {
    'use strict';

    function normalizarNome(s) {
        return (s || '').trim().toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/\s+/g, ' ');
    }

    function levenshtein(a, b) {
        const m = a.length, n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;
        const dp = [];
        for (let i = 0; i <= m; i++) { dp[i] = [i]; }
        for (let j = 0; j <= n; j++) { dp[0][j] = j; }
        for (let i = 1; i <= m; i++)
            for (let j = 1; j <= n; j++)
                dp[i][j] = a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        return dp[m][n];
    }

    function similaridade(a, b) {
        const na = normalizarNome(a), nb = normalizarNome(b);
        if (na === nb) return 1;
        if (!na || !nb) return 0;
        const dist = levenshtein(na, nb);
        return 1 - dist / Math.max(na.length, nb.length);
    }

    // Percorre um mapa {nomeNormalizado: codigo} e retorna o código com maior
    // similaridade ao nome (já normalizado) informado, se >= limiar
    // (padrão 0.75 — mesmo limiar usado nas 3 empresas antes desta extração).
    function encontrarMelhorCorrespondenciaFuzzy(nomeNormalizado, mapa, limiar) {
        limiar = limiar === undefined ? 0.75 : limiar;
        let melhorScore = 0, melhorCod = null;
        for (const [chave, cod] of Object.entries(mapa || {})) {
            const s = similaridade(nomeNormalizado, chave);
            if (s > melhorScore) { melhorScore = s; melhorCod = cod; }
        }
        return melhorScore >= limiar ? melhorCod : null;
    }

    // Converte "R$ 2.990,26" ou 2990.26 (número do Excel) → 299026 (centavos
    // inteiros). Versão básica, sem o tratamento de múltiplos "R$" somados
    // que trackfield.js precisa (esse continua só lá, como extensão).
    function parseMoneyBasico(s) {
        if (!s && s !== 0) return 0;
        const str = String(s).replace(/R\$|\s/g, '').trim();
        if (!str) return 0;
        let num;
        if (str.includes(',')) {
            num = parseFloat(str.replace(/\./g, '').replace(',', '.'));
        } else {
            num = parseFloat(str.replace(/[^\d.]/g, ''));
        }
        if (isNaN(num) || num <= 0) return 0;
        return Math.round(num * 100);
    }

    const api = { normalizarNome, levenshtein, similaridade, encontrarMelhorCorrespondenciaFuzzy, parseMoneyBasico };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        Object.assign(root, api);
        root.FechamentoMatching = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
