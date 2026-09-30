/**
 * Parsing do PDF "Programação de Férias" (uma ou várias empresas no mesmo arquivo).
 * Módulo puro: sem DOM e sem PDF.js. Funciona como <script> global no navegador
 * e via require() em Node (para os testes).
 *
 * Entrada: páginas já extraídas pelo PDF.js —
 *   [{ height, items: [{ str, x, y, width }] }]   (y = coordenada PDF, origem embaixo)
 * Saída: { headers: string[], empresas: [{ nome, cnpj, rotulo, rows: string[][] }]  (cnpj = número do documento; rotulo = CNPJ|CAEPF|CPF|CEI), ignoradas: [{nome,cnpj}] }
 *        ou null se o cabeçalho (Código + Empregado) não for encontrado.
 */

const _FERIAS_Y_TOL = 6;
// Identificador da empresa: CNPJ, ou CAEPF/CPF/CEI para empregador pessoa física.
const _FERIAS_DOC_RE = /\b(CNPJ|CAEPF|CPF|CEI)\s*:\s*([\d./-]{8,})/i;

function _feriasLinhasDaPagina(page) {
    const itens = [];
    (page.items || []).forEach(it => {
        const s = String(it.str || '').replace(/\s+/g, ' ').trim();
        if (!s) return;
        itens.push({ str: s, x: it.x, y: page.height - it.y });
    });
    itens.sort((a, b) => a.y - b.y || a.x - b.x);

    const linhas = [];
    let cur = null;
    itens.forEach(item => {
        if (cur && Math.abs(item.y - cur.baseY) <= _FERIAS_Y_TOL) cur.items.push(item);
        else { cur = { baseY: item.y, items: [item] }; linhas.push(cur); }
    });
    linhas.forEach(l => l.items.sort((a, b) => a.x - b.x));
    return linhas;
}

function _feriasTxt(items) { return items.map(it => it.str).join(' '); }

function _feriasEhCabecalhoColunas(txt) { return /c[oó]digo/i.test(txt) && /empregado/i.test(txt); }

function _feriasEhCabecalhoRepetido(items) {
    if (!items.length) return false;
    const txt = _feriasTxt(items);
    if (_feriasEhCabecalhoColunas(txt)) return true;
    if (/admiss[aã]o|venc\.|aquisitivo/i.test(txt) && !/\d{2}\/\d{2}\/\d{4}/.test(txt)) return true;
    if (/^(Data\b|Vencto\.?|In[ií]cio\b)/i.test(txt.trim()) && !/\d{2}\/\d{2}\/\d{4}/.test(txt)) return true;
    return false;
}

function _feriasEhRodape(items) {
    const txt = _feriasTxt(items).trim();
    if (/sistema licenciado|observa[çc][oõ]es|total de empregados/i.test(txt)) return true;
    if (/\bp[aá]g(ina)?[\s.:]/i.test(txt)) return true;
    if (/^(emiss[aã]o|horas|data\s*base|cnpj|caepf|cpf|cei)\b/i.test(txt)) return true;
    if (/programa[çc][aã]o\s+de\s+f[eé]rias/i.test(txt)) return true;
    if (/^\d+(\s+de\s+\d+)?$/.test(txt)) return true;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(txt)) return true;   // hora de emissão isolada
    return false;
}

function _feriasMetaPagina(linhas) {
    let nome = '', cnpj = '', rotulo = 'CNPJ', n = null;
    const lim = Math.min(linhas.length, 8);
    for (let i = 0; i < lim; i++) {
        const txt = _feriasTxt(linhas[i].items);
        if (!cnpj) { const m = txt.match(_FERIAS_DOC_RE); if (m) { rotulo = m[1].toUpperCase(); cnpj = m[2].trim(); } }
        if (n === null) { const m = txt.match(/p[aá]gina:?\s*(\d+)\s*\/\s*(\d+)/i); if (m) n = +m[1]; }
        if (!nome && linhas[i].items[0]) {
            const s = linhas[i].items[0].str;
            if (s.length > 8 && /^[A-ZÀ-Ú]/.test(s)
                && !/^(CNPJ|CAEPF|CPF|CEI|Data\s*base|P[aá]g|Emiss[aã]o|Horas|PROGRAMA[ÇC]|Sistema)/i.test(s))
                nome = s.substring(0, 100);
        }
    }
    return { nome, cnpj, rotulo, n };
}

function _feriasColDefs(linhas, hdrIdx) {
    const subItems  = linhas[hdrIdx].items;
    const prevItems = hdrIdx > 0 ? linhas[hdrIdx - 1].items : [];
    const prevTxt   = _feriasTxt(prevItems);
    const isGrpRow  = /data|vencto\.?|in[ií]cio|fim\b/i.test(prevTxt) && !/\d{4}/.test(prevTxt);

    const colDefs = subItems.map(si => {
        const sub = si.str.trim();
        let grp = '';
        if (isGrpRow) {
            const closest = prevItems.reduce((best, gi) => {
                const d = Math.abs(gi.x - si.x);
                return (!best || d < Math.abs(best.x - si.x)) ? gi : best;
            }, null);
            if (closest && Math.abs(closest.x - si.x) < 60) grp = closest.str.trim();
        }
        let label;
        if (!grp || grp.toLowerCase() === sub.toLowerCase()) label = sub;
        else if (sub.toLowerCase().startsWith(grp.toLowerCase().slice(0, 4))) label = sub;
        else label = `${grp} ${sub}`;
        return { x: si.x, label };
    });

    // Fronteiras: ponto médio entre colunas; 1ª coluna (Código) alargada a 90% porque
    // os códigos são alinhados à direita no PDF.
    for (let i = 0; i < colDefs.length; i++) {
        colDefs[i].xStart = i === 0 ? -Infinity : colDefs[i - 1].xEnd;
        if (i === colDefs.length - 1) colDefs[i].xEnd = Infinity;
        else if (i === 0) colDefs[i].xEnd = colDefs[i].x + (colDefs[i + 1].x - colDefs[i].x) * 0.90;
        else colDefs[i].xEnd = (colDefs[i].x + colDefs[i + 1].x) / 2;
    }
    return colDefs;
}

const _feriasPlaceholder = s => /^[.\-/\s]+$/.test(s.trim());

function _feriasLinhaParaColunas(items, colDefs) {
    const rowArr = new Array(colDefs.length).fill('');
    items.forEach(item => {
        let ci = colDefs.findIndex(c => item.x >= c.xStart && item.x < c.xEnd);
        if (ci === -1) {
            let bestD = Infinity;
            colDefs.forEach((c, idx) => {
                const d = Math.abs(item.x - c.x);
                if (d < bestD) { bestD = d; ci = idx; }
            });
        }
        rowArr[ci] = rowArr[ci] ? rowArr[ci] + ' ' + item.str : item.str;
    });
    return rowArr.map(c => { const v = c.trim(); return _feriasPlaceholder(v) ? '' : v; });
}

function parsearFerias(pages) {
    const paginas = (pages || []).map(p => {
        const linhas = _feriasLinhasDaPagina(p);
        const hdrIdx = linhas.findIndex(l => _feriasEhCabecalhoColunas(_feriasTxt(l.items)));
        return { linhas, hdrIdx, meta: _feriasMetaPagina(linhas) };
    });

    const primeira = paginas.find(p => p.hdrIdx !== -1);
    if (!primeira) return null;
    const colDefs = _feriasColDefs(primeira.linhas, primeira.hdrIdx);

    const empresas = [];
    let atual = null;
    paginas.forEach(pg => {
        const { nome, cnpj, rotulo, n } = pg.meta;
        const nova = !atual
            || (cnpj && atual.cnpj && cnpj !== atual.cnpj)
            || (n === 1 && atual.paginas > 0);
        if (nova) {
            atual = { nome, cnpj, rotulo, rows: [], paginas: 0 };
            empresas.push(atual);
        } else {
            if (!atual.nome && nome) atual.nome = nome;
            if (!atual.cnpj && cnpj) atual.cnpj = cnpj;
        }
        atual.paginas++;

        for (let i = pg.hdrIdx + 1; i < pg.linhas.length; i++) {   // hdrIdx -1 → todas
            const items = pg.linhas[i].items;
            if (!items.length) continue;
            if (_feriasEhCabecalhoRepetido(items) || _feriasEhRodape(items)) continue;
            const clean = _feriasLinhaParaColunas(items, colDefs);
            if (clean.every(c => !c)) continue;
            atual.rows.push(clean);
        }
    });

    const comDados  = empresas.filter(e => e.rows.length);
    const ignoradas = empresas.filter(e => !e.rows.length).map(e => ({ nome: e.nome, cnpj: e.cnpj }));
    return {
        headers: colDefs.map(c => c.label),
        empresas: comDados.map(e => ({ nome: e.nome, cnpj: e.cnpj, rotulo: e.rotulo, rows: e.rows })),
        ignoradas,
    };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { parsearFerias };
