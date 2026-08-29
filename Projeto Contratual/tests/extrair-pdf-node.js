/**
 * Helper de teste: extrai texto dos PDFs reais usando pdfjs-dist (legacy build),
 * aplicando a MESMA heurística de reconstrução de linhas do extract.js do browser.
 */
const path = require('node:path');
const fs = require('node:fs');

const pdfjs = require('../../node_modules/pdfjs-dist/legacy/build/pdf.js');

// Cópia sincronizada de js/extract.js::reconstruirLinhasPagina (o original
// vive num IIFE que depende de `window`, por isso não é require-ável aqui).
function reconstruirLinhasPagina(items) {
    const validos = (items || []).filter(it => {
        if (!it || !it.str || !it.str.length) return false;
        if (/^\s+$/.test(it.str) && typeof it.width === 'number' && it.width < 0.15) return false;
        return true;
    });
    if (!validos.length) return [];
    const porY = validos.slice().sort((a, b) => b.transform[5] - a.transform[5]);
    const LIMIAR_Y = 2.0;
    const grupos = [];
    let grupo = null, anchor = null;
    for (const it of porY) {
        const y = it.transform[5];
        if (grupo === null || Math.abs(y - anchor) > LIMIAR_Y) {
            grupo = [];
            grupos.push(grupo);
            anchor = y;
        }
        grupo.push(it);
    }
    return grupos
        .map(g => g.slice()
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map(it => it.str).join('')
            .replace(/[ \t ]+/g, ' ').trim())
        .filter(Boolean);
}

async function extrairTextoPdf(caminhoAbs) {
    const data = new Uint8Array(fs.readFileSync(caminhoAbs));
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const paginas = [];
    for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        paginas.push(reconstruirLinhasPagina(content.items).join('\n'));
    }
    return paginas.join('\n\n').trim();
}

const DIR = path.join(__dirname, '..');
const ARQUIVOS = {
    v1: '1ª ALTERAÇÃO CONTRATUAL_18-04-2023.pdf',
    v2: '2ª Alteração Contratual_Set-2024.pdf',
    v3: '3ª Alteração Contratual_FH Tecnologia Ltda.pdf',
};

/** true se os 3 PDFs de exemplo estão presentes (não são versionados). */
function fixturesDisponiveis() {
    return Object.values(ARQUIVOS).every(nome => fs.existsSync(path.join(DIR, nome)));
}

async function carregarVias() {
    const out = {};
    for (const [k, nome] of Object.entries(ARQUIVOS)) {
        out[k] = await extrairTextoPdf(path.join(DIR, nome));
    }
    return out;
}

module.exports = { extrairTextoPdf, carregarVias, fixturesDisponiveis, reconstruirLinhasPagina, ARQUIVOS, DIR };
