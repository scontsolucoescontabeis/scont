(function () {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let _urlsAutorizadas = [];
    let _grupoAtivo = null;

    if (window.mermaid) {
        window.mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    }

    function normalizarUrl(u) {
        return decodeURIComponent(u || '').replace(/\\/g, '/').toLowerCase();
    }

    function grupoAutorizado(grupo) {
        return grupo.prefixos.some(prefixo =>
            _urlsAutorizadas.some(u => u.startsWith(prefixo))
        );
    }

    async function carregarFerramentasAutorizadas(isAdmin) {
        if (isAdmin) {
            const { data, error } = await sb.from('ferramentas').select('url_base').eq('ativa', true);
            if (error) throw error;
            return (data || []).map(f => normalizarUrl(f.url_base));
        }
        const { data, error } = await sb.from('usuario_ferramentas').select('ferramentas ( url_base, ativa )');
        if (error) throw error;
        return (data || [])
            .map(r => r.ferramentas)
            .filter(f => f && f.ativa)
            .map(f => normalizarUrl(f.url_base));
    }

    function renderMenu(grupos) {
        const nav = document.getElementById('manualNav');
        nav.innerHTML = '';
        if (!grupos.length) {
            nav.innerHTML = '<div class="manual-nav-vazio">Nenhuma especificação disponível para as ferramentas liberadas para você ainda.</div>';
            return;
        }
        grupos.forEach(grupo => {
            const btn = document.createElement('button');
            btn.className = 'manual-nav-link';
            btn.dataset.slug = grupo.slug;
            btn.innerHTML = `<span class="manual-nav-icone">${grupo.icone}</span><span>${grupo.nome}</span>`;
            btn.addEventListener('click', () => abrirGrupo(grupo));
            nav.appendChild(btn);
        });
    }

    function marcarAtivo(slug) {
        document.querySelectorAll('.manual-nav-link').forEach(el => {
            el.classList.toggle('ativo', el.dataset.slug === slug);
        });
    }

    async function abrirGrupo(grupo) {
        _grupoAtivo = grupo;
        marcarAtivo(grupo.slug);
        history.replaceState(null, '', '#' + grupo.slug);

        const header = document.getElementById('manualHeaderTitulo');
        header.textContent = `${grupo.icone} ${grupo.nome}`;

        const corpo = document.getElementById('manualCorpo');
        const html = window.MANUAL_CONTENT && window.MANUAL_CONTENT[grupo.slug];
        const btnPdf = document.getElementById('manualBtnPdf');
        if (btnPdf) btnPdf.style.display = 'none'; // some enquanto os diagramas ainda não renderizaram

        if (html) {
            corpo.innerHTML = html;
            // Mermaid substitui o texto de cada <pre class="mermaid"> pelo SVG
            // renderizado — precisa terminar antes de liberar o botão de PDF,
            // que lê os <svg> já prontos direto do DOM.
            if (window.mermaid) {
                try {
                    await window.mermaid.run({ querySelector: '#manualCorpo pre.mermaid' });
                } catch (err) {
                    console.error('Erro ao renderizar diagrama(s) Mermaid:', err);
                }
            }
            if (btnPdf) {
                btnPdf.style.display = '';
                btnPdf.onclick = () => gerarPdfEspecificacao(grupo);
            }
        } else {
            console.error('Conteúdo não encontrado para o grupo:', grupo.slug);
            corpo.innerHTML = '<div class="manual-erro"><div class="icone">⚠️</div><p>Não foi possível carregar este conteúdo.</p></div>';
        }
    }

    function aplicarBusca(grupos) {
        const termo = document.getElementById('manualBusca').value.trim().toLowerCase();
        if (!termo) { renderMenu(grupos); if (_grupoAtivo) marcarAtivo(_grupoAtivo.slug); return; }
        const filtrados = grupos.filter(g => g.nome.toLowerCase().includes(termo));
        renderMenu(filtrados);
        if (_grupoAtivo) marcarAtivo(_grupoAtivo.slug);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const auth = await window.PortalAuthGuard.init(1);
        if (!auth) return;
        document.getElementById('authOverlay').remove();
        document.getElementById('app').style.display = '';

        try {
            _urlsAutorizadas = await carregarFerramentasAutorizadas(!!auth.isAdmin);
        } catch (err) {
            console.error('Erro ao carregar ferramentas autorizadas:', err);
            document.getElementById('manualNav').innerHTML = '<div class="manual-nav-vazio">Erro ao carregar o menu. Recarregue a página.</div>';
            return;
        }

        const grupos = window.MANUAL_GRUPOS.filter(grupoAutorizado);
        renderMenu(grupos);

        document.getElementById('manualBusca').addEventListener('input', () => aplicarBusca(grupos));

        if (!grupos.length) {
            document.getElementById('manualCorpo').innerHTML = '<div class="manual-vazio"><div class="icone">🛠️</div><p>Você ainda não tem ferramentas com especificação técnica liberada.</p><p>Assim que ganhar acesso a uma ferramenta, a documentação técnica correspondente aparece aqui.</p></div>';
            const btnPdf = document.getElementById('manualBtnPdf');
            if (btnPdf) btnPdf.style.display = 'none';
            return;
        }

        const slugInicial = window.location.hash.replace('#', '');
        const grupoInicial = grupos.find(g => g.slug === slugInicial) || grupos[0];
        abrirGrupo(grupoInicial);
    });

    // ============================================
    // GERAR PDF DA ESPECIFICAÇÃO DE UMA FERRAMENTA
    // ============================================

    // As fontes padrão do jsPDF (helvetica/times/courier) não têm glyphs de
    // emoji — sem isso, cada emoji do conteúdo vira uma caixinha em branco
    // no PDF. Removemos só os blocos de emoji/pictogramas, mantendo
    // acentuação e pontuação normal (setas, travessões etc.) intactas.
    function limparEmojiParaPdf(str) {
        return String(str || '')
            .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
    }

    // Converte o <svg> já renderizado pelo Mermaid em PNG (data URL), pra
    // poder entrar no PDF via doc.addImage — jsPDF não desenha <svg> direto.
    // Desenha sobre fundo branco porque o SVG do Mermaid tem fundo
    // transparente (a página do PDF já é branca, mas garante consistência
    // se algum dia isso for embutido sobre outra cor).
    function svgParaPngDataUrl(svgEl, escala) {
        escala = escala || 2;
        return new Promise((resolve, reject) => {
            const rect = svgEl.getBoundingClientRect();
            const viewBoxW = svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width;
            const viewBoxH = svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.height;
            const w = Math.max(rect.width, viewBoxW || 0, 100);
            const h = Math.max(rect.height, viewBoxH || 0, 60);

            const xml = new XMLSerializer().serializeToString(svgEl);
            const svg64 = window.btoa(unescape(encodeURIComponent(xml)));
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(w * escala);
                canvas.height = Math.round(h * escala);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve({ dataUrl: canvas.toDataURL('image/png'), w, h });
            };
            img.onerror = reject;
            img.src = 'data:image/svg+xml;base64,' + svg64;
        });
    }

    async function gerarPdfEspecificacao(grupo) {
        if (!window.jspdf) { alert('Biblioteca de PDF não carregada. Recarregue a página e tente de novo.'); return; }
        const corpo = document.getElementById('manualCorpo');
        if (!corpo) return;

        const btnPdf = document.getElementById('manualBtnPdf');
        if (btnPdf) { btnPdf.disabled = true; btnPdf.textContent = '⏳ Gerando...'; }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const MARGEM = 14;
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const largura = pageW - MARGEM * 2;
            let y = MARGEM;

            function quebraSeNecessario(alturaPrevista) {
                if (y + alturaPrevista > pageH - MARGEM) { doc.addPage(); y = MARGEM; }
            }

            function paragrafo(texto, opts) {
                opts = opts || {};
                const tamanho = opts.tamanho || 10;
                const cor = opts.cor || [44, 62, 80];
                const negrito = !!opts.negrito;
                const italico = !!opts.italico;
                const recuo = opts.recuo || 0;
                const limpo = limparEmojiParaPdf(texto);
                if (!limpo) return;
                doc.setFontSize(tamanho);
                doc.setFont('helvetica', negrito ? 'bold' : (italico ? 'italic' : 'normal'));
                doc.setTextColor(cor[0], cor[1], cor[2]);
                const linhas = doc.splitTextToSize(limpo, largura - recuo);
                const altura = linhas.length * (tamanho * 0.42) + 2;
                quebraSeNecessario(altura);
                doc.text(linhas, MARGEM + recuo, y + tamanho * 0.35);
                y += altura;
            }

            function lista(items, ordenada) {
                items.forEach((item, idx) => {
                    const prefixo = ordenada ? `${idx + 1}. ` : '• ';
                    const limpo = limparEmojiParaPdf(item.textContent);
                    if (!limpo) return;
                    doc.setFontSize(9.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(44, 62, 80);
                    const linhas = doc.splitTextToSize(limpo, largura - 8);
                    const altura = linhas.length * 4 + 2;
                    quebraSeNecessario(altura);
                    doc.setFont('helvetica', 'bold');
                    doc.text(prefixo, MARGEM, y + 3.3);
                    doc.setFont('helvetica', 'normal');
                    doc.text(linhas, MARGEM + 8, y + 3.3);
                    y += altura;
                });
                y += 2;
            }

            function definicoes(dl) {
                Array.from(dl.children).forEach((el) => {
                    if (el.tagName === 'DT') {
                        paragrafo(el.textContent, { tamanho: 9.5, negrito: true });
                    } else if (el.tagName === 'DD') {
                        paragrafo(el.textContent, { tamanho: 9.5, recuo: 4 });
                        y += 1.5;
                    }
                });
            }

            function tabela(table) {
                const head = Array.from(table.querySelectorAll('thead th')).map(th => limparEmojiParaPdf(th.textContent));
                const body = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
                    Array.from(tr.children).map(td => limparEmojiParaPdf(td.textContent))
                );
                quebraSeNecessario(14);
                doc.autoTable({
                    head: head.length ? [head] : undefined,
                    body,
                    startY: y,
                    margin: { left: MARGEM, right: MARGEM },
                    styles: { fontSize: 8, cellPadding: 1.8, textColor: [44, 62, 80] },
                    headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                    alternateRowStyles: { fillColor: [249, 250, 251] },
                    theme: 'striped',
                });
                y = doc.lastAutoTable.finalY + 4;
            }

            function formula(div) {
                const linhas = limparEmojiParaPdf(div.textContent).split('\n').map(l => l.trim()).filter(Boolean);
                if (!linhas.length) return;
                doc.setFontSize(8.5);
                doc.setFont('courier', 'normal');
                const alturaLinha = 4;
                const altura = linhas.length * alturaLinha + 6;
                quebraSeNecessario(altura);
                doc.setFillColor(245, 246, 248);
                doc.setDrawColor(224, 230, 237);
                doc.roundedRect(MARGEM, y, largura, altura - 2, 1.5, 1.5, 'FD');
                doc.setTextColor(74, 85, 104);
                linhas.forEach((l, idx) => doc.text(l, MARGEM + 3, y + 5 + idx * alturaLinha));
                y += altura + 3;
            }

            async function diagrama(wrapperEl) {
                const svg = wrapperEl.querySelector('svg');
                if (!svg) {
                    paragrafo('[Diagrama não renderizado — abra a ferramenta no navegador antes de gerar o PDF]', { tamanho: 8.5, italico: true, cor: [150, 150, 150] });
                    return;
                }
                try {
                    const { dataUrl, w, h } = await svgParaPngDataUrl(svg);
                    let larguraImg = largura;
                    let alturaImg = larguraImg * (h / w);
                    const alturaMaxPagina = pageH - MARGEM * 2 - 10;
                    if (alturaImg > alturaMaxPagina) {
                        alturaImg = alturaMaxPagina;
                        larguraImg = alturaImg * (w / h);
                    }
                    quebraSeNecessario(alturaImg + 6);
                    const x = MARGEM + (largura - larguraImg) / 2;
                    doc.addImage(dataUrl, 'PNG', x, y, larguraImg, alturaImg);
                    y += alturaImg + 6;
                } catch (e) {
                    console.error('Falha ao converter diagrama para PDF:', e);
                    paragrafo('[Diagrama não pôde ser incluído no PDF — consulte a versão em tela]', { tamanho: 8.5, italico: true, cor: [150, 150, 150] });
                }
            }

            async function renderizarSecaoFilhos(elementos) {
                for (const el of Array.from(elementos)) {
                    const tag = el.tagName;
                    if (tag === 'H3') {
                        y += 3;
                        paragrafo(el.textContent, { tamanho: 11.5, negrito: true, cor: [44, 62, 80] });
                        y += 1;
                    } else if (tag === 'OL') {
                        lista(Array.from(el.children), true);
                    } else if (tag === 'UL') {
                        lista(Array.from(el.children), false);
                    } else if (tag === 'DL') {
                        definicoes(el);
                    } else if (tag === 'TABLE') {
                        tabela(el);
                    } else if (tag === 'PRE' && el.classList.contains('mermaid')) {
                        await diagrama(el);
                    } else if (tag === 'DIV' && el.classList.contains('manual-formula')) {
                        formula(el);
                    } else if (tag === 'P') {
                        paragrafo(el.textContent, { tamanho: 9.5 });
                        y += 1.5;
                    }
                }
            }

            // ── Cabeçalho ──
            doc.setFillColor(44, 62, 80);
            doc.roundedRect(MARGEM, y, largura, 20, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(15); doc.setFont('helvetica', 'bold');
            doc.text(limparEmojiParaPdf(grupo.nome), MARGEM + 5, y + 9);
            doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            doc.text('Manual do Programador — Portal SCONT', MARGEM + 5, y + 15.5);
            doc.setFontSize(8);
            doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), pageW - MARGEM - 4, y + 9, { align: 'right' });
            y += 28;

            // ── Corpo: introdução + seções ──
            const intro = corpo.querySelector('p.manual-intro');
            if (intro) {
                paragrafo(intro.textContent, { tamanho: 9.5, italico: true, cor: [90, 108, 125] });
                y += 4;
            }

            for (const secao of Array.from(corpo.querySelectorAll('section.manual-item'))) {
                const titulo = secao.querySelector('h2');
                quebraSeNecessario(14);
                if (titulo) {
                    doc.setFillColor(236, 240, 244);
                    doc.rect(MARGEM, y, largura, 8, 'F');
                    doc.setFontSize(11.5); doc.setFont('helvetica', 'bold');
                    doc.setTextColor(44, 62, 80);
                    doc.text(limparEmojiParaPdf(titulo.textContent), MARGEM + 3, y + 5.6);
                    y += 12;
                }
                const filhos = Array.from(secao.children).filter(el => el.tagName !== 'H2');
                await renderizarSecaoFilhos(filhos);
                y += 4;
            }

            const nomeArquivoSeguro = grupo.nome
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            doc.save(`Especificacao_${nomeArquivoSeguro}.pdf`);
        } finally {
            if (btnPdf) { btnPdf.disabled = false; btnPdf.textContent = '📄 Gerar PDF'; }
        }
    }
})();
