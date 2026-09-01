/**
 * SCONT Portal — Logout automático por inatividade
 * ------------------------------------------------------------------
 * Uso:
 *   window.PortalInatividade.iniciar({ sb, depthToRoot, sessionKeys, loginPage })
 *
 *   sb           cliente Supabase já criado (opcional — cria um se faltar)
 *   depthToRoot  níveis de pasta até a raiz do portal (padrão 1; portal.html = 0)
 *   sessionKeys  chaves do sessionStorage a limpar no logout
 *                (padrão ['userAuth','adminAuth'])
 *   loginPage    arquivo de login na raiz (padrão 'login.html')
 *
 * O tempo-limite vem de configuracoes_scont.timeout_inatividade_min
 * (0 / vazio / inválido = recurso desativado). Padrão de fallback: 15 min.
 *
 * Atividade (mouse, teclado, toque, scroll) em QUALQUER aba/ferramenta do
 * mesmo domínio conta para todas — sincronizada via localStorage. Cerca de
 * 1 minuto antes do limite aparece um aviso com contagem regressiva e o
 * botão "Continuar conectado"; qualquer interação também renova a sessão.
 * Quando uma aba desloga, todas as outras acompanham.
 * ------------------------------------------------------------------
 */
window.PortalInatividade = (function () {

    var LS_ATIVIDADE = 'portal:ultimaAtividade';
    var LS_LOGOUT    = 'portal:logoutInatividade';
    var SS_CACHE     = 'portal:timeoutInatividadeCache';
    var CACHE_TTL_MS = 10 * 60 * 1000;   // reconsulta a config a cada 10 min

    var iniciado = false;

    function agora() { return Date.now(); }

    /** Lê o tempo-limite (em minutos) da tabela de configurações, com cache curto. */
    async function obterTimeoutMin(sb) {
        try {
            var cru = sessionStorage.getItem(SS_CACHE);
            if (cru) {
                var c = JSON.parse(cru);
                if (c && (agora() - c.t) < CACHE_TTL_MS) return c.v;
            }
        } catch (e) { /* ignora cache corrompido */ }

        var min = 15;   // fallback padrão
        try {
            var r = await sb
                .from('configuracoes_scont')
                .select('valor')
                .eq('chave', 'timeout_inatividade_min')
                .maybeSingle();
            if (r && r.data && r.data.valor !== null && r.data.valor !== '') {
                var n = parseInt(String(r.data.valor).trim(), 10);
                if (!isNaN(n) && n >= 0) min = n;
            }
        } catch (e) { /* mantém fallback */ }

        try { sessionStorage.setItem(SS_CACHE, JSON.stringify({ v: min, t: agora() })); } catch (e) {}
        return min;
    }

    async function iniciar(opts) {
        try {
            if (iniciado) return;
            opts = opts || {};

            var sb = opts.sb;
            if (!sb && window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY) {
                sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            }
            if (!sb) return;

            // Só ativa se houver sessão Supabase de fato.
            var s = await sb.auth.getSession();
            if (!s || !s.data || !s.data.session) return;

            var timeoutMin = await obterTimeoutMin(sb);
            if (!timeoutMin || timeoutMin <= 0) return;   // recurso desativado

            iniciado = true;

            var depth       = opts.depthToRoot != null ? opts.depthToRoot : 1;
            var loginPage   = opts.loginPage || 'login.html';
            var sessionKeys = opts.sessionKeys || ['userAuth', 'adminAuth'];

            var TIMEOUT_MS = timeoutMin * 60000;
            var AVISO_MS   = Math.min(60000, Math.floor(TIMEOUT_MS / 2));

            var avisando   = false;
            var deslogando = false;
            var ultimoRegistro = 0;
            var timerContagem  = null;
            var overlay = null, contadorEl = null;

            function loginUrl() {
                return '../'.repeat(depth) + loginPage + '?motivo=inatividade';
            }

            function lerUltimaAtividade() {
                try {
                    var v = parseInt(localStorage.getItem(LS_ATIVIDADE) || '0', 10);
                    if (!isNaN(v) && v > 0) return v;
                } catch (e) {}
                return agora();
            }

            function gravarAtividade(forcar) {
                if (deslogando) return;
                if (avisando) { forcar = true; esconderAviso(); }
                var t = agora();
                if (!forcar && (t - ultimoRegistro) < 5000) return;   // throttle
                ultimoRegistro = t;
                try { localStorage.setItem(LS_ATIVIDADE, String(t)); } catch (e) {}
            }

            async function deslogar() {
                if (deslogando) return;
                deslogando = true;
                if (timerContagem) clearInterval(timerContagem);
                try { localStorage.setItem(LS_LOGOUT, String(agora())); } catch (e) {}
                sessionKeys.forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
                try { sessionStorage.removeItem(SS_CACHE); } catch (e) {}
                try { await sb.auth.signOut(); } catch (e) {}
                window.location.replace(loginUrl());
            }

            // ─── Aviso com contagem regressiva ───────────────────────
            function construirModal() {
                overlay = document.createElement('div');
                overlay.style.cssText = [
                    'position:fixed', 'inset:0', 'z-index:2147483647',
                    'background:rgba(20,24,31,.55)', 'backdrop-filter:blur(2px)',
                    'display:flex', 'align-items:center', 'justify-content:center',
                    'padding:20px', 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
                ].join(';');

                var card = document.createElement('div');
                card.style.cssText = [
                    'background:#fff', 'border-radius:12px', 'max-width:380px', 'width:100%',
                    'padding:28px 26px', 'text-align:center', 'box-shadow:0 12px 40px rgba(0,0,0,.28)'
                ].join(';');

                card.innerHTML =
                    '<div style="font-size:38px;line-height:1;margin-bottom:12px">⏳</div>' +
                    '<h2 style="margin:0 0 8px;font-size:18px;color:#2C3E50;font-weight:700">Sessão prestes a expirar</h2>' +
                    '<p style="margin:0 0 4px;font-size:13px;color:#7F8C8D">Você será desconectado por inatividade em</p>' +
                    '<p style="margin:0 0 18px;font-size:30px;font-weight:800;color:#8B3A3A">' +
                        '<span data-contador>60</span><span style="font-size:15px;font-weight:600"> s</span></p>' +
                    '<button type="button" data-continuar ' +
                        'style="width:100%;padding:12px;border:none;border-radius:6px;cursor:pointer;' +
                        'font-weight:700;font-size:14px;color:#fff;' +
                        'background:linear-gradient(135deg,#8B3A3A,#6B2A2A)">Continuar conectado</button>';

                overlay.appendChild(card);
                contadorEl = card.querySelector('[data-contador]');
                card.querySelector('[data-continuar]').addEventListener('click', function () {
                    gravarAtividade(true);
                });
                overlay.addEventListener('click', function (e) {
                    if (e.target === overlay) gravarAtividade(true);
                });
                (document.body || document.documentElement).appendChild(overlay);
            }

            function mostrarAviso() {
                if (avisando || deslogando) return;
                avisando = true;
                if (!overlay) construirModal();
                overlay.style.display = 'flex';
                atualizarContador();
                timerContagem = setInterval(atualizarContador, 1000);
            }

            function esconderAviso() {
                avisando = false;
                if (timerContagem) { clearInterval(timerContagem); timerContagem = null; }
                if (overlay) overlay.style.display = 'none';
            }

            function atualizarContador() {
                var restante = Math.ceil((TIMEOUT_MS - (agora() - lerUltimaAtividade())) / 1000);
                if (restante <= 0) { deslogar(); return; }
                if (contadorEl) contadorEl.textContent = restante;
            }

            // ─── Verificação periódica ───────────────────────────────
            function verificar() {
                if (deslogando) return;
                var ocioso = agora() - lerUltimaAtividade();
                if (ocioso >= TIMEOUT_MS)            { deslogar(); return; }
                if (ocioso >= TIMEOUT_MS - AVISO_MS) { mostrarAviso(); }
                else if (avisando)                  { esconderAviso(); }
            }

            // ─── Listeners ───────────────────────────────────────────
            ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel']
                .forEach(function (ev) {
                    window.addEventListener(ev, function () { gravarAtividade(false); }, { passive: true });
                });

            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) verificar();
            });

            window.addEventListener('storage', function (e) {
                if (e.key === LS_LOGOUT && e.newValue) {
                    if (deslogando) return;
                    deslogando = true;
                    if (timerContagem) clearInterval(timerContagem);
                    sessionKeys.forEach(function (k) { try { sessionStorage.removeItem(k); } catch (er) {} });
                    window.location.replace(loginUrl());
                    return;
                }
                if (e.key === LS_ATIVIDADE && avisando) esconderAviso();
            });

            gravarAtividade(true);
            setInterval(verificar, 10000);

        } catch (e) {
            // Nunca deixa um erro deste módulo quebrar a página hospedeira.
            if (window.console) console.warn('[PortalInatividade] desativado:', e);
        }
    }

    return { iniciar: iniciar };
})();
