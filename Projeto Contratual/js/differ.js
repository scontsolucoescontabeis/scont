/**
 * Diff palavra a palavra entre dois textos de cláusula.
 * Módulo puro: sem DOM, sem rede. Funciona como <script> global no
 * navegador e via require() em Node (testes).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Differ = api;
})(typeof self !== 'undefined' ? self : this, function () {

    /**
     * Quebra o texto em tokens preservando os espaços como tokens próprios,
     * para que o diff reconstrua o texto exatamente ao concatenar.
     * "a  b\nc" -> ["a", "  ", "b", "\n", "c"]
     */
    function tokenizar(texto) {
        if (!texto) return [];
        return texto.match(/\s+|\S+/g) || [];
    }

    function ehEspaco(tok) {
        return /^\s+$/.test(tok);
    }

    /**
     * Diff clássico por LCS sobre tokens.
     * Retorna [{ tipo: 'igual'|'add'|'del', texto }] na ordem de leitura,
     * agrupando tokens consecutivos de mesmo tipo.
     */
    function diffPalavras(a, b) {
        const ta = tokenizar(a);
        const tb = tokenizar(b);
        const n = ta.length;
        const m = tb.length;

        // matriz LCS (n+1) x (m+1)
        const lcs = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                lcs[i][j] = ta[i] === tb[j]
                    ? lcs[i + 1][j + 1] + 1
                    : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }

        const bruto = [];
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (ta[i] === tb[j]) {
                bruto.push({ tipo: 'igual', texto: ta[i] });
                i++; j++;
            } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
                bruto.push({ tipo: 'del', texto: ta[i] });
                i++;
            } else {
                bruto.push({ tipo: 'add', texto: tb[j] });
                j++;
            }
        }
        while (i < n) { bruto.push({ tipo: 'del', texto: ta[i] }); i++; }
        while (j < m) { bruto.push({ tipo: 'add', texto: tb[j] }); j++; }

        // Espaços entre duas alterações do mesmo tipo entram na alteração;
        // espaços isolados entre trechos iguais ficam "igual". Simplificação:
        // reclassifica espaço puro cercado por 'igual' como 'igual'.
        for (let k = 0; k < bruto.length; k++) {
            if (bruto[k].tipo !== 'igual' && ehEspaco(bruto[k].texto)) {
                const antes = bruto[k - 1];
                const depois = bruto[k + 1];
                const antesOk = !antes || antes.tipo === 'igual';
                const depoisOk = !depois || depois.tipo === 'igual';
                if (antesOk && depoisOk) bruto[k].tipo = 'igual';
            }
        }

        // agrupa consecutivos de mesmo tipo
        const segs = [];
        for (const seg of bruto) {
            const ult = segs[segs.length - 1];
            if (ult && ult.tipo === seg.tipo) ult.texto += seg.texto;
            else segs.push({ tipo: seg.tipo, texto: seg.texto });
        }
        return segs;
    }

    /**
     * Filtra os segmentos para renderizar um lado do comparativo.
     * lado 'ant'  -> remove 'add' (mostra o texto anterior, com 'del' destacado)
     * lado 'nova' -> remove 'del' (mostra o texto atual, com 'add' destacado)
     */
    function segmentosParaLado(segs, lado) {
        const remover = lado === 'ant' ? 'add' : 'del';
        return segs.filter(s => s.tipo !== remover);
    }

    /** true se houver qualquer add/del (i.e. os textos diferem de fato). */
    function temAlteracao(segs) {
        return segs.some(s => s.tipo !== 'igual');
    }

    return { tokenizar, diffPalavras, segmentosParaLado, temAlteracao };
});
