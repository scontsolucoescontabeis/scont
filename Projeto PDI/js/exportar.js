// Projeto PDI/js/exportar.js — impressão/PDF, DOCX e Excel do PDI
window.PdiExportar = (function () {
    'use strict';
    const U = window.PdiUI, Doc = window.PdiDocumento;
    const LIB_DOCX = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
    const LIB_XLSX = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

    function carregarScript(src, global) {
        if (window[global]) return Promise.resolve(window[global]);
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => (window[global] ? resolve(window[global]) : reject(new Error('Biblioteca não carregou.')));
            s.onerror = () => reject(new Error('Não foi possível carregar a biblioteca de exportação (verifique a conexão).'));
            document.head.appendChild(s);
        });
    }

    function nomeArquivo(d, ext) {
        const base = `PDI - ${d.pdi.colaborador_nome} - ${d.pdi.cargo_setor}`.replace(/[\\/:*?"<>|]/g, '');
        return `${base}.${ext}`;
    }

    function baixar(blob, nome) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    function imprimir(d) {
        const logo = new URL('assets/logo-scont.png', window.location.href).href;
        const w = window.open('', '_blank');
        if (!w) { U.toast('Permita pop-ups para imprimir.', 'erro'); return; }
        w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
          <title>${U.esc(nomeArquivo(d, '').replace(/\.$/, ''))}</title>
          <link rel="stylesheet" href="${new URL('css/pdi.css', window.location.href).href}">
          <style>body{background:#fff;color:#111;font-family:'DM Sans',Calibri,Arial,sans-serif;margin:0}
          .folha{max-width:190mm;margin:0 auto;padding:12mm 8mm}.cab{border-bottom:3px solid #8B3A3A;margin-bottom:10px;padding-bottom:6px}
          .cab img{height:42px}.doc-secao{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}
          @media print{@page{size:A4;margin:12mm}.noprint{display:none}}</style></head>
          <body><div class="folha"><div class="cab"><img src="${logo}" alt="SCONT"></div>
          <button class="noprint" onclick="window.print()" style="margin:8px 0">Imprimir / salvar como PDF</button>
          <article class="documento">${window.PdiRender.blocos(Doc.montar(d))}</article></div>
          <script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})<\/script></body></html>`);
        w.document.close();
    }

    async function docx(d) {
        const lib = await carregarScript(LIB_DOCX, 'docx');
        let logo;
        try {
            const r = await fetch('assets/logo-scont.png');
            logo = new Uint8Array(await r.arrayBuffer());
        } catch (_) { logo = undefined; }
        const documento = window.PdiDocx.construir(lib, Doc.montar(d), { logo });
        const blob = await lib.Packer.toBlob(documento);
        baixar(blob, nomeArquivo(d, 'docx'));
    }

    async function xlsx(d) {
        const X = await carregarScript(LIB_XLSX, 'XLSX');
        const C = window.PdiCalculo;
        const resumo = d.indicadores.map(i => {
            const v = Doc.valorIndicador(i, d);
            return { Indicador: i.nome, Cálculo: i.formula, 'Meta proposta': i.meta_texto, Evidência: i.evidencia,
                'Resultado (%)': v == null ? '' : v, Situação: window.PdiTextos.ATINGIMENTO[C.atingimento(i, v)] };
        });
        const apuracoes = [];
        d.indicadores.forEach(i => i.apuracoes.forEach(a => apuracoes.push({
            Indicador: i.nome, Competência: String(a.competencia_mes).slice(0, 7), Numerador: Number(a.numerador),
            Denominador: Number(a.denominador), 'Percentual (%)': a.percentual == null ? '' : Number(a.percentual),
            'Linha de base': a.linha_base ? 'Sim' : 'Não', Observação: a.observacao || '',
        })));
        const wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, X.utils.json_to_sheet(resumo), 'Indicadores');
        X.utils.book_append_sheet(wb, X.utils.json_to_sheet(apuracoes), 'Apurações');
        X.writeFile(wb, nomeArquivo(d, 'xlsx').replace(/^PDI/, 'Indicadores PDI'));
    }

    return { imprimir, docx, xlsx };
})();
