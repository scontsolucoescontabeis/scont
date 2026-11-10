// Projeto Demandas/js/app.js — núcleo: autenticação, dados, navegação e utilitários.
window.DEM = {
    sb: null, userId: null, userNome: null,
    demandas: [],          // todas as demandas (RLS já restringe)
    empresas: [],          // rh_empresas (para ligar cliente_id)
    carregadas: false,
    telaAtual: null,
    filtroInicial: null,   // filtro vindo de um clique no painel -> lista

    // ---------- utilitários ----------
    esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    $(id) { return document.getElementById(id); },

    /** YYYY-MM-DD de hoje no fuso de Brasília. */
    hojeISO() {
        const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        return p;
    },
    /** Instante (ISO/Date) -> YYYY-MM-DD em Brasília. */
    diaBR(v) {
        if (!v) return null;
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v));
    },
    /** 'YYYY-MM-DD' -> 'dd/mm/aaaa' (sem passar por Date: evita virar o dia por fuso). */
    fData(iso) {
        if (!iso) return '—';
        const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
    },
    /** instante -> 'dd/mm/aaaa hh:mm' em Brasília. */
    fDataHora(v) {
        if (!v) return '—';
        const d = new Date(v);
        if (isNaN(d)) return '—';
        return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
            .format(d).replace(',', '');
    },
    /** dias entre duas datas 'YYYY-MM-DD' (b - a). */
    difDias(a, b) {
        return Math.round((Date.UTC(...b.split('-').map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split('-').map((x, i) => i === 1 ? x - 1 : +x))) / 86400000);
    },
    ehAberta(d) { return d.status !== 'Concluída' && d.status !== 'Informativo'; },
    vencida(d, hoje = DEM.hojeISO()) { return DEM.ehAberta(d) && !!d.prazo && d.prazo < hoje; },
    diasParaPrazo(d, hoje = DEM.hojeISO()) { return d.prazo ? DEM.difDias(hoje, d.prazo) : null; },

    slug(s) { return DEM.parser.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); },
    badgeStatus(s) {
        const cls = { 'Aguardando SCONT': 's-aguardando-scont', 'Em análise (SCONT)': 's-em-analise', 'Aguardando cliente': 's-aguardando-cliente', 'Concluída': 's-concluida', 'Informativo': 's-informativo' }[s] || '';
        return `<span class="badge ${cls}">${DEM.esc(s || '—')}</span>`;
    },
    badgePrio(p) {
        if (!p) return '<span class="badge">—</span>';
        const cls = { 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa' }[p] || '';
        return `<span class="badge ${cls}">${DEM.esc(p)}</span>`;
    },
    toast(msg, tipo = '') {
        const el = document.createElement('div');
        el.className = `toast ${tipo}`;
        el.textContent = msg;
        DEM.$('toasts').appendChild(el);
        setTimeout(() => el.remove(), tipo === 'erro' ? 8000 : 4000);
    },
    erro(msg) {
        const e = DEM.$('erroGlobal');
        e.textContent = msg;
        e.hidden = !msg;
    },

    /** O Supabase devolve no máximo 1000 linhas por requisição: pagina até acabar. */
    async buscarTudo(fabrica) {
        const tam = 1000, todos = [];
        for (let de = 0; ; de += tam) {
            const { data, error } = await fabrica().range(de, de + tam - 1);
            if (error) throw error;
            todos.push(...data);
            if (data.length < tam) break;
        }
        return todos;
    },

    // ---------- dados ----------
    async carregar() {
        DEM.$('carregando').hidden = false;
        try {
            DEM.demandas = await DEM.buscarTudo(() => DEM.sb.from('demandas').select('*').order('id'));
            DEM.carregadas = true;
            DEM.erro('');
        } catch (e) {
            DEM.erro('Não foi possível carregar as demandas: ' + (e.message || e) +
                ' — verifique se a migration _sql/schema_demandas.sql foi aplicada e se você tem acesso à ferramenta.');
        } finally {
            DEM.$('carregando').hidden = true;
        }
        // empresas só servem para vincular cliente; falha não impede o resto
        try {
            DEM.empresas = await DEM.buscarTudo(() => DEM.sb.from('rh_empresas').select('codigo_empresa, nome_empresa').order('codigo_empresa'));
        } catch (_) { DEM.empresas = []; }
    },

    // ---------- navegação ----------
    TELAS: ['painel', 'lista', 'detalhe', 'clientes', 'importar', 'historico'],
    ir(tela, arg) {
        if (!DEM.carregadas && tela !== 'importar' && tela !== 'historico') { /* mostra erro global já exibido */ }
        if (tela === 'detalhe' && DEM.telaAtual !== 'detalhe') DEM.detalhe.voltarPara = DEM.telaAtual || 'lista';
        DEM.telaAtual = tela;
        for (const t of DEM.TELAS) DEM.$('tela-' + t).hidden = t !== tela;
        const menu = tela === 'detalhe' ? 'lista' : tela;
        document.querySelectorAll('.menu-item').forEach(b => b.classList.toggle('ativo', b.dataset.tela === menu));
        const render = { painel: DEM.painel, lista: DEM.lista, detalhe: DEM.detalhe, clientes: DEM.clientes, importar: DEM.importar, historico: DEM.historico }[tela];
        if (render) render.render(arg);
        window.scrollTo(0, 0);
    },

    async iniciar() {
        const auth = await window.PortalAuthGuard.init(1);
        if (!auth) return;
        DEM.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data } = await DEM.sb.auth.getUser();
        DEM.userId = data?.user?.id || null;
        DEM.userNome = auth.nome || auth.name || data?.user?.email || '';
        DEM.$('authOverlay')?.remove();
        DEM.parser = window.DemandasParser;
        DEM.diff = window.DemandasDiff;
        document.querySelectorAll('.menu-item').forEach(b => b.addEventListener('click', () => DEM.ir(b.dataset.tela)));
        await DEM.carregar();
        DEM.ir('painel');
    },
};
