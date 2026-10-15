// Projeto PDI/js/render-html.js — renderiza os blocos de PdiDocumento em HTML (tela, impressão/PDF, apresentação)
window.PdiRender = (function () {
    'use strict';
    const e = (v) => window.PdiUI.esc(v);

    function bloco(b) {
        switch (b.t) {
            case 'titulo': return `<h1 class="doc-titulo">${e(b.texto)}</h1>`;
            case 'secao': return `<h2 class="doc-secao" id="sec-${e(b.id)}">${e(b.texto)}</h2>`;
            case 'sub': return `<h3 class="doc-sub">${e(b.texto)}</h3>`;
            case 'p': return `<p class="doc-p">${b.rotulo ? `<strong>${e(b.rotulo)}:</strong> ` : ''}${window.PdiUI.br(b.texto)}</p>`;
            case 'nota': return `<p class="doc-nota">${e(b.texto)}</p>`;
            case 'kv': return `<table class="doc-kv"><tbody>${b.pares.map(p =>
                `<tr><th>${e(p[0])}</th><td>${e(p[1])}</td></tr>`).join('')}</tbody></table>`;
            case 'tabela': return `<div class="tabela-wrap"><table class="doc-tab"><thead><tr>${b.cab.map(c => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${
                b.linhas.map(l => `<tr${l.destaque ? ' class="destaque"' : ''}>${l.cels.map(c => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
            case 'lista': return `<ul class="doc-lista">${b.itens.map(i => `<li>${e(i)}</li>`).join('')}</ul>`;
            case 'assinaturas': return `<div class="doc-ass">${b.itens.map(i =>
                `<div class="ass ${i.registro ? 'ok' : ''}"><span>${e(i.texto)}</span></div>`).join('')}</div>`;
            default: return '';
        }
    }

    function blocos(lista) { return lista.map(bloco).join(''); }

    /** Divide em "slides": cabeçalho + uma seção por tela (modo Apresentar). */
    function slides(lista) {
        const out = [];
        let atual = [];
        lista.forEach(b => {
            if (b.t === 'secao' && atual.length) { out.push(atual); atual = []; }
            atual.push(b);
        });
        if (atual.length) out.push(atual);
        return out;
    }

    return { bloco, blocos, slides };
})();
