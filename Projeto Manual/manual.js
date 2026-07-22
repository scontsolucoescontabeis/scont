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
        if (html) {
            corpo.innerHTML = html;
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
            document.getElementById('manualCorpo').innerHTML = '<div class="manual-vazio"><div class="icone">📘</div><p>Você ainda não tem ferramentas com manual liberado.</p><p>Assim que ganhar acesso a uma ferramenta, o manual correspondente aparece aqui.</p></div>';
            return;
        }

        const slugInicial = window.location.hash.replace('#', '');
        const grupoInicial = grupos.find(g => g.slug === slugInicial) || grupos[0];
        abrirGrupo(grupoInicial);
    });
})();
