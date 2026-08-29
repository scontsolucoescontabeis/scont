/**
 * Casamento e classificação de cláusulas entre duas versões de contrato.
 * Módulo puro. <script> global no navegador + require() em Node (testes).
 *
 * comparar(clausulasAnt, clausulasNova) -> { linhas, resumo }
 *
 * Depende de ContratoParser (normalizarTitulo, corpoNormalizado).
 */
(function (root, factory) {
    const dep = (typeof module === 'object' && module.exports)
        ? require('./parser.js')
        : root.ContratoParser;
    const api = factory(dep);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ContratoMatcher = api;
})(typeof self !== 'undefined' ? self : this, function (ContratoParser) {

    const { normalizarTitulo, corpoNormalizado } = ContratoParser;

    const LIMIAR_DICE = 0.6;

    function bigramas(texto) {
        const palavras = corpoNormalizado(texto).split(' ').filter(Boolean);
        const set = new Set();
        for (let i = 0; i < palavras.length - 1; i++) {
            set.add(palavras[i] + ' ' + palavras[i + 1]);
        }
        if (palavras.length === 1) set.add(palavras[0]);
        return set;
    }

    function dice(a, b) {
        const A = bigramas(a);
        const B = bigramas(b);
        if (A.size === 0 && B.size === 0) return 1;
        if (A.size === 0 || B.size === 0) return 0;
        let inter = 0;
        for (const g of A) if (B.has(g)) inter++;
        return (2 * inter) / (A.size + B.size);
    }

    function classificarPar(a, b) {
        return corpoNormalizado(a.corpo) === corpoNormalizado(b.corpo)
            ? 'igual'
            : 'alterada';
    }

    function montarLinha(chave, titulo, classificacao, a, b) {
        return {
            chave,
            titulo: titulo || (b && b.titulo) || (a && a.titulo) || '(sem título)',
            classificacao,
            corpoAnt: a ? a.corpo : '',
            corpoNova: b ? b.corpo : '',
            ordinalAnt: a ? a.ordinal : null,
            ordinalNova: b ? b.ordinal : null,
        };
    }

    function comparar(clausulasAnt, clausulasNova) {
        const ant = (clausulasAnt || []).map((c, i) => ({ ...c, _i: i, _usada: false }));
        const nova = (clausulasNova || []).map((c, i) => ({ ...c, _i: i, _usada: false }));

        const linhas = [];

        // ── passo 1: match exato por título normalizado ──────────────
        const idxAntPorTitulo = new Map();
        for (const c of ant) {
            const k = normalizarTitulo(c.titulo);
            if (!k) continue;
            if (!idxAntPorTitulo.has(k)) idxAntPorTitulo.set(k, []);
            idxAntPorTitulo.get(k).push(c);
        }
        for (const b of nova) {
            const k = normalizarTitulo(b.titulo);
            if (!k) continue;
            const cands = idxAntPorTitulo.get(k);
            if (!cands || !cands.length) continue;
            const a = cands.shift();
            a._usada = true;
            b._usada = true;
            linhas.push(montarLinha(k, b.titulo, classificarPar(a, b), a, b));
        }

        // ── passo 2: sobras por similaridade de conteúdo ─────────────
        for (const b of nova) {
            if (b._usada) continue;
            let melhor = null, melhorScore = 0;
            for (const a of ant) {
                if (a._usada) continue;
                const s = dice(a.corpo, b.corpo);
                if (s > melhorScore) { melhorScore = s; melhor = a; }
            }
            if (melhor && melhorScore >= LIMIAR_DICE) {
                melhor._usada = true;
                b._usada = true;
                const chave = normalizarTitulo(b.titulo) || normalizarTitulo(melhor.titulo) || `~${b.ordinal}`;
                linhas.push(montarLinha(chave, b.titulo || melhor.titulo, classificarPar(melhor, b), melhor, b));
            }
        }

        // ── passo 3: remanescentes ──────────────────────────────────
        for (const b of nova) {
            if (b._usada) continue;
            linhas.push(montarLinha(normalizarTitulo(b.titulo) || `nova-${b._i}`, b.titulo, 'nova', null, b));
        }
        for (const a of ant) {
            if (a._usada) continue;
            linhas.push(montarLinha(normalizarTitulo(a.titulo) || `sup-${a._i}`, a.titulo, 'suprimida', a, null));
        }

        // ── ordenação ───────────────────────────────────────────────
        const ordemClasse = { alterada: 0, nova: 0, igual: 0, suprimida: 1 };
        linhas.sort((x, y) => {
            const cx = ordemClasse[x.classificacao];
            const cy = ordemClasse[y.classificacao];
            if (cx !== cy) return cx - cy;
            const ox = x.ordinalNova ?? x.ordinalAnt ?? 999;
            const oy = y.ordinalNova ?? y.ordinalAnt ?? 999;
            return ox - oy;
        });

        const resumo = { alteradas: 0, novas: 0, suprimidas: 0, iguais: 0 };
        for (const l of linhas) {
            if (l.classificacao === 'alterada') resumo.alteradas++;
            else if (l.classificacao === 'nova') resumo.novas++;
            else if (l.classificacao === 'suprimida') resumo.suprimidas++;
            else resumo.iguais++;
        }

        return { linhas, resumo };
    }

    return { comparar, dice, bigramas };
});
