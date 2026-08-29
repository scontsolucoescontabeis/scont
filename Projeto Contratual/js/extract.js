/**
 * Extração de texto de PDF (pdf.js) e Word .docx (mammoth).
 * Único módulo com dependências externas — usado só no navegador.
 *
 * window.ContratoExtract.extrairTexto(file) -> Promise<{ texto, origem, aviso }>
 */
(function () {
    'use strict';

    const PDFJS_VER = '3.11.174';

    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js`;
    }

    class ErroSemTextoSelecionavel extends Error {}

    /**
     * Agrupa itens de texto por linha (Y) e ordena por X.
     * Concatena direto (sem espaço automático) e descarta os itens de espaço
     * com largura ~0 — que o pdf.js emite como artefato de kerning entre a
     * primeira letra e o resto da palavra em fontes "small-caps" (comuns nos
     * títulos de cláusula de contratos da Junta). Sem isso, "CLÁUSULA" sai
     * como "C LÁUSULA".
     */
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
                .replace(/[ \t ]+/g, ' ').trim())
            .filter(Boolean);
    }

    async function extrairPdf(arrayBuffer) {
        if (!window.pdfjsLib) throw new Error('pdf.js não carregado');
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const paginas = [];
        for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            const content = await page.getTextContent();
            const linhas = reconstruirLinhasPagina(content.items);
            paginas.push(linhas.join('\n'));
        }
        const texto = paginas.join('\n\n').trim();
        if (texto.replace(/\s/g, '').length < 40) {
            throw new ErroSemTextoSelecionavel(
                'Este PDF não tem texto selecionável (provável documento escaneado). ' +
                'A versão atual da ferramenta não faz OCR.'
            );
        }
        return texto;
    }

    async function extrairDocx(arrayBuffer) {
        if (!window.mammoth) throw new Error('mammoth não carregado');
        const res = await window.mammoth.extractRawText({ arrayBuffer });
        return (res.value || '').trim();
    }

    async function extrairTexto(file) {
        const nome = (file.name || '').toLowerCase();
        const buf = await file.arrayBuffer();
        if (nome.endsWith('.pdf') || file.type === 'application/pdf') {
            return { texto: await extrairPdf(buf), origem: 'pdf' };
        }
        if (nome.endsWith('.docx') ||
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return { texto: await extrairDocx(buf), origem: 'docx' };
        }
        if (nome.endsWith('.doc')) {
            throw new Error('Formato .doc antigo não suportado. Salve como .docx ou PDF.');
        }
        throw new Error('Formato não suportado. Envie um PDF ou um arquivo Word (.docx).');
    }

    window.ContratoExtract = { extrairTexto, ErroSemTextoSelecionavel, reconstruirLinhasPagina };
})();
