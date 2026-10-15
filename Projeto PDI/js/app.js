// Projeto PDI/js/app.js — bootstrap, papéis e roteamento
(function () {
    'use strict';
    const U = window.PdiUI, Api = window.PdiApi;
    const main = () => document.getElementById('main');
    const ctx = { user: null, papeis: null, pode: {}, cicloFicha: null };
    let telaAtual = null;
    let menu = [];

    function aviso(msg) {
        main().innerHTML = `<div class="cartao"><h1>PDI</h1><p class="aviso-bloco">${U.esc(msg)}</p></div>`;
    }

    function montarMenu() {
        const p = ctx.papeis;
        menu = [];
        if (p.colaborador || (!p.admin && !p.socio && !p.gestor)) menu.push(['meu', '🎯 Meu PDI e Resultados']);
        if (p.socio || p.admin) menu.push(['painel', '👥 Painel dos Sócios']);
        if (p.gestor && !p.socio && !p.admin) menu.push(['equipe', '👥 Minha equipe']);
        if (p.gestor && (p.socio || p.admin)) menu.push(['equipe', '👤 Minha equipe (gestor)']);
        if (p.admin) menu.push(['admin', '⚙️ Administração']);
        document.getElementById('menu').innerHTML = menu.map(m =>
            `<button class="menu-item" data-tela="${m[0]}" aria-label="${U.esc(m[1])}">${U.esc(m[1])}</button>`).join('');
        document.querySelectorAll('[data-tela]').forEach(b => b.onclick = () => ir(b.dataset.tela));
    }

    function marcar(tela) {
        document.querySelectorAll('.menu-item[data-tela]').forEach(b => b.classList.toggle('ativo', b.dataset.tela === tela));
    }

    async function ir(tela) {
        telaAtual = tela;
        marcar(tela);
        const h = main();
        try {
            if (tela === 'meu') await window.PdiMeu.render(h, ctx);
            else if (tela === 'painel') await window.PdiPainel.render(h, { ...ctx, somenteGestor: false });
            else if (tela === 'equipe') await window.PdiPainel.render(h, { ...ctx, somenteGestor: true });
            else if (tela === 'admin') await window.PdiAdmin.render(h, ctx);
        } catch (err) {
            semTabela(err);
        }
    }

    function semTabela(err) {
        if (err && err.ausente) {
            aviso('O módulo PDI ainda não foi instalado no banco de dados. Peça ao administrador para executar ' +
                '_sql/schema_pdi.sql, _sql/seed_pdi.sql e _sql/add_ferramenta_pdi.sql no Supabase.');
        } else {
            aviso(`Não foi possível carregar: ${err && err.message ? err.message : err}`);
        }
    }

    async function abrirPdi(id, aba) {
        const h = main();
        h.innerHTML = '<p class="muted">Carregando PDI…</p>';
        try {
            const d = await Api.carregar(id);
            const pdi = d.pdi;
            const p = ctx.papeis;
            ctx.pode = {
                admin: !!p.admin, socio: !!p.socio,
                gestor: pdi.gestor_user_id === ctx.user.id,
                colab: pdi.colaborador_user_id === ctx.user.id,
            };
            ctx.pode.avaliar = ctx.pode.admin || ctx.pode.socio || ctx.pode.gestor;
            ctx.cicloFicha = null;
            ctx.voltar = () => ir(telaAtual || menu[0][0]);
            ctx.recarregar = async (abaAtual) => {
                const novo = await Api.carregar(id);
                window.PdiTela.render(main(), novo, ctx, abaAtual);
            };
            window.PdiTela.render(h, d, ctx, aba || 'resumo');
        } catch (err) {
            semTabela(err);
        }
    }
    ctx.abrirPdi = abrirPdi;

    async function iniciar() {
        const auth = await window.PortalAuthGuard.init(1);
        if (!auth) return;
        const ov = document.getElementById('authOverlay');
        if (ov) ov.remove();
        const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        Api.init(sb);
        const sessao = await Api.sessao();
        if (!sessao) { window.location.replace('../login.html'); return; }
        ctx.user = { ...sessao, nome: null };
        try {
            const { data } = await sb.from('usuarios').select('nome').eq('id', sessao.id).maybeSingle();
            if (data && data.nome) ctx.user.nome = data.nome;
        } catch (_) { /* nome é opcional */ }
        try {
            ctx.papeis = await Api.papeis();
        } catch (err) { semTabela(err); return; }
        if (auth.isAdmin) ctx.papeis.admin = true;
        document.getElementById('usuario').textContent = ctx.user.nome || ctx.user.email;
        montarMenu();
        const alvo = new URLSearchParams(location.search).get('pdi');
        if (alvo) { await abrirPdi(alvo); return; }
        ir(menu[0][0]);
    }

    document.addEventListener('DOMContentLoaded', iniciar);
})();
