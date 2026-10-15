// Projeto PDI/js/app.js — bootstrap, papéis e roteamento
(function () {
    'use strict';
    const U = window.PdiUI, Api = window.PdiApi;
    const main = () => document.getElementById('main');
    const ctx = { user: null, papeis: null, pode: {}, cicloFicha: null };
    let telaAtual = null;
    let menu = [];

    function aviso(msg) {
        main().innerHTML = `<h1>PDI</h1><div class="cartao"><p class="aviso-bloco">${U.esc(msg)}</p></div>`;
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

    // Rotas por hash: #tela=painel | #pdi=<id>&aba=ficha  (F5 e botão Voltar do navegador funcionam)
    function lerHash() {
        const p = new URLSearchParams(location.hash.slice(1));
        return { tela: p.get('tela'), pdi: p.get('pdi'), aba: p.get('aba') };
    }
    function gravarHash(obj, push) {
        const h = '#' + new URLSearchParams(obj).toString();
        if (location.hash === h) return;
        (push ? history.pushState : history.replaceState).call(history, null, '', h);
    }
    ctx.gravarHash = gravarHash;

    function marcar(tela) {
        document.querySelectorAll('.menu-item[data-tela]').forEach(b => {
            const on = b.dataset.tela === tela;
            b.classList.toggle('ativo', on);
            if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        });
    }

    async function ir(tela, opts) {
        opts = opts || {};
        telaAtual = tela;
        if (!opts.semHash) gravarHash({ tela }, true);
        const rotulo = (menu.find(m => m[0] === tela) || [])[1];
        if (rotulo) document.title = `${rotulo.replace(/^\S+\s/, '')} — PDI — SCONT`;
        const sbm = document.getElementById('sidebar'), ovm = document.getElementById('overlay');
        if (sbm) sbm.classList.remove('open');
        if (ovm) ovm.classList.remove('show');
        marcar(tela);
        const h = main();
        h.innerHTML = '<p class="carregando" role="status">Carregando…</p>';
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
            aviso(`Não foi possível carregar: ${U.erroAmigavel(err)} Recarregue a página para tentar de novo.`);
        }
    }

    async function abrirPdi(id, aba, opts) {
        opts = opts || {};
        if (!opts.semHash) gravarHash({ pdi: id, aba: aba || 'resumo' }, true);
        const h = main();
        h.innerHTML = '<p class="carregando" role="status">Carregando PDI…</p>';
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
        document.getElementById('sidebarNome').textContent = ctx.user.nome || ctx.user.email;
        document.getElementById('sidebarEmail').textContent = ctx.user.email || '';
        const sb2 = document.getElementById('sidebar'), ov2 = document.getElementById('overlay');
        document.getElementById('hamburger').addEventListener('click', () => { sb2.classList.toggle('open'); ov2.classList.toggle('show'); });
        ov2.addEventListener('click', () => { sb2.classList.remove('open'); ov2.classList.remove('show'); });
        montarMenu();
        window.addEventListener('popstate', rotear);
        await rotear();
    }

    async function rotear() {
        const h = lerHash();
        const alvo = h.pdi || new URLSearchParams(location.search).get('pdi');
        if (alvo) { await abrirPdi(alvo, h.aba, { semHash: true }); return; }
        const tela = menu.some(m => m[0] === h.tela) ? h.tela : menu[0][0];
        await ir(tela, { semHash: true });
        if (!h.tela) gravarHash({ tela }, false);
    }

    document.addEventListener('DOMContentLoaded', iniciar);
})();
