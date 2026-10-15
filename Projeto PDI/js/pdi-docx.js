// Projeto PDI/js/pdi-docx.js — converte os blocos de PdiDocumento em um Document da lib `docx`
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory();
    else root.PdiDocx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const COR = '8B3A3A';

    /**
     * @param {object} docx  módulo da biblioteca docx
     * @param {Array} blocos saída de PdiDocumento.montar
     * @param {{logo?: Uint8Array}} [opts]
     */
    function construir(docx, blocos, opts) {
        opts = opts || {};
        const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
            HeadingLevel, ImageRun, BorderStyle } = docx;

        const run = (t, o) => new TextRun({ text: String(t == null ? '' : t), font: 'Calibri', ...(o || {}) });
        const par = (children, o) => new Paragraph({ children, spacing: { after: 120 }, ...(o || {}) });

        const celula = (texto, o) => new TableCell({
            width: { size: o && o.largura ? o.largura : 1, type: WidthType.AUTO },
            shading: o && o.cab ? { type: ShadingType.CLEAR, fill: COR, color: 'auto' }
                : (o && o.destaque ? { type: ShadingType.CLEAR, fill: 'F6E9E9', color: 'auto' } : undefined),
            margins: { top: 60, bottom: 60, left: 90, right: 90 },
            children: [new Paragraph({ children: [run(texto, o && o.cab ? { bold: true, color: 'FFFFFF', size: 20 } : { size: 20, bold: !!(o && o.destaque) })] })],
        });

        const tabela = (cab, linhas) => new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({ tableHeader: true, children: cab.map(c => celula(c, { cab: true })) }),
                ...linhas.map(l => new TableRow({ children: l.cels.map(c => celula(c, { destaque: l.destaque })) })),
            ],
        });

        const filhos = [];
        if (opts.logo) {
            filhos.push(new Paragraph({
                children: [new ImageRun({ data: opts.logo, transformation: { width: 150, height: 53 }, type: 'png' })],
            }));
        }

        blocos.forEach(b => {
            switch (b.t) {
                case 'titulo':
                    filhos.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 200 },
                        children: [run(b.texto, { bold: true, color: COR, size: 36 })] }));
                    break;
                case 'secao':
                    filhos.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 },
                        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COR, space: 2 } },
                        children: [run(b.texto, { bold: true, color: COR, size: 28 })] }));
                    break;
                case 'sub':
                    filhos.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 },
                        children: [run(b.texto, { bold: true, size: 24 })] }));
                    break;
                case 'p': {
                    const rs = [];
                    if (b.rotulo) rs.push(run(`${b.rotulo}: `, { bold: true }));
                    String(b.texto == null ? '' : b.texto).split('\n').forEach((linha, i) => {
                        rs.push(i ? new TextRun({ text: linha, break: 1, font: 'Calibri' }) : run(linha));
                    });
                    filhos.push(par(rs));
                    break;
                }
                case 'nota':
                    filhos.push(par([run(b.texto, { italics: true, color: '555555' })]));
                    break;
                case 'kv':
                    filhos.push(new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: b.pares.map(p => new TableRow({ children: [
                            new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'F0F2F5', color: 'auto' },
                                margins: { top: 60, bottom: 60, left: 90, right: 90 },
                                children: [new Paragraph({ children: [run(p[0], { bold: true, size: 20 })] })] }),
                            celula(p[1]),
                        ] })),
                    }));
                    filhos.push(par([]));
                    break;
                case 'tabela':
                    filhos.push(tabela(b.cab, b.linhas));
                    filhos.push(par([]));
                    break;
                case 'lista':
                    b.itens.forEach(i => filhos.push(new Paragraph({ children: [run(i)], bullet: { level: 0 }, spacing: { after: 60 } })));
                    break;
                case 'assinaturas':
                    b.itens.forEach(i => filhos.push(par([run(i.texto, { bold: !!i.registro })], { spacing: { before: 360, after: 120 } })));
                    break;
                default:
            }
        });

        return new Document({
            creator: 'Portal Scont',
            title: 'Plano de Desenvolvimento Individual',
            styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
            sections: [{ properties: {}, children: filhos }],
        });
    }

    return { construir };
});
