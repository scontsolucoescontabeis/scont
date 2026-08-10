(function () {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let _urlsAutorizadas = [];
    let _grupoAtivo = null;

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
            nav.innerHTML = '<div class="manual-nav-vazio">Nenhum manual disponível para as ferramentas liberadas para você ainda.</div>';
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
        if (html) {
            corpo.innerHTML = html;
            if (btnPdf) {
                btnPdf.style.display = '';
                btnPdf.onclick = () => gerarPdfManual(grupo);
            }
        } else {
            console.error('Conteúdo não encontrado para o grupo:', grupo.slug);
            corpo.innerHTML = '<div class="manual-erro"><div class="icone">⚠️</div><p>Não foi possível carregar este conteúdo.</p></div>';
            if (btnPdf) btnPdf.style.display = 'none';
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
            document.getElementById('manualCorpo').innerHTML = '<div class="manual-vazio"><div class="icone">📘</div><p>Você ainda não tem ferramentas com manual liberado.</p><p>Assim que ganhar acesso a uma ferramenta, o manual correspondente aparece aqui.</p></div>';
            const btnPdf = document.getElementById('manualBtnPdf');
            if (btnPdf) btnPdf.style.display = 'none';
            return;
        }

        const slugInicial = window.location.hash.replace('#', '');
        const grupoInicial = grupos.find(g => g.slug === slugInicial) || grupos[0];
        abrirGrupo(grupoInicial);
    });

    // ============================================
    // GERAR PDF DO MANUAL DE UMA FERRAMENTA
    // ============================================

    // As fontes padrão do jsPDF (helvetica/times/courier) não têm glyphs de
    // emoji — sem isso, cada emoji do conteúdo (usado bastante nos textos)
    // vira uma caixinha em branco no PDF. Removemos só os blocos de
    // emoji/pictogramas, mantendo acentuação e pontuação normal (setas,
    // travessões etc.) intactas.
    function limparEmojiParaPdf(str) {
        return String(str || '')
            .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
    }

    function gerarPdfManual(grupo) {
        if (!window.jspdf) { alert('Biblioteca de PDF não carregada. Recarregue a página e tente de novo.'); return; }
        const corpo = document.getElementById('manualCorpo');
        if (!corpo) return;

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

        function paragrafo(texto, { tamanho = 10, cor = [44, 62, 80], negrito = false, italico = false, recuo = 0 } = {}) {
            const limpo = limparEmojiParaPdf(texto);
            if (!limpo) return;
            doc.setFontSize(tamanho);
            doc.setFont('helvetica', negrito ? 'bold' : (italico ? 'italic' : 'normal'));
            doc.setTextColor(...cor);
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
                headStyles: { fillColor: [139, 58, 58], textColor: 255, fontStyle: 'bold', fontSize: 8 },
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

        function renderizarSecaoFilhos(elementos) {
            Array.from(elementos).forEach((el) => {
                const tag = el.tagName;
                if (tag === 'H3') {
                    y += 3;
                    paragrafo(el.textContent, { tamanho: 11.5, negrito: true, cor: [139, 58, 58] });
                    y += 1;
                } else if (tag === 'OL') {
                    lista(Array.from(el.children), true);
                } else if (tag === 'UL') {
                    lista(Array.from(el.children), false);
                } else if (tag === 'DL') {
                    definicoes(el);
                } else if (tag === 'TABLE') {
                    tabela(el);
                } else if (tag === 'DIV' && el.classList.contains('manual-formula')) {
                    formula(el);
                } else if (tag === 'P') {
                    paragrafo(el.textContent, { tamanho: 9.5 });
                    y += 1.5;
                }
            });
        }

        // ── Cabeçalho ──
        doc.setFillColor(139, 58, 58);
        doc.roundedRect(MARGEM, y, largura, 20, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15); doc.setFont('helvetica', 'bold');
        doc.text(limparEmojiParaPdf(grupo.nome), MARGEM + 5, y + 9);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('Manual do Usuário — Portal SCONT', MARGEM + 5, y + 15.5);
        doc.setFontSize(8);
        doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), pageW - MARGEM - 4, y + 9, { align: 'right' });
        y += 28;

        // ── Corpo: introdução + seções ──
        const intro = corpo.querySelector('p.manual-intro');
        if (intro) {
            paragrafo(intro.textContent, { tamanho: 9.5, italico: true, cor: [90, 108, 125] });
            y += 4;
        }

        corpo.querySelectorAll('section.manual-item').forEach((secao) => {
            const titulo = secao.querySelector('h2');
            quebraSeNecessario(14);
            if (titulo) {
                doc.setFillColor(245, 234, 233);
                doc.rect(MARGEM, y, largura, 8, 'F');
                doc.setFontSize(11.5); doc.setFont('helvetica', 'bold');
                doc.setTextColor(139, 58, 58);
                doc.text(limparEmojiParaPdf(titulo.textContent), MARGEM + 3, y + 5.6);
                y += 12;
            }
            const filhos = Array.from(secao.children).filter(el => el.tagName !== 'H2');
            renderizarSecaoFilhos(filhos);
            y += 4;
        });

        const nomeArquivoSeguro = grupo.nome
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        doc.save(`Manual_${nomeArquivoSeguro}.pdf`);
    }
})();
