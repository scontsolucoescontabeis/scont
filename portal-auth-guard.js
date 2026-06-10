/**
 * SCONT Portal — Guarda de Autenticação para Ferramentas
 *
 * Cada ferramenta deve:
 *   1. Carregar ../supabase-config.js  (define SUPABASE_URL e SUPABASE_KEY)
 *   2. Carregar Supabase CDN
 *   3. Carregar este arquivo
 *   4. Chamar window.PortalAuthGuard.init(depthToRoot) — normalmente depthToRoot=1
 *      (número de níveis de pasta até a raiz do portal)
 *
 * O guard verifica:
 *   a) sessionStorage 'userAuth' presente e válido
 *   b) Sessão Supabase Auth ativa
 *   c) Usuário tem acesso a esta ferramenta específica (via usuario_ferramentas)
 *
 * Em caso de falha, redireciona para login.html na raiz do portal.
 */
window.PortalAuthGuard = (function () {

    function getLoginUrl(depth) {
        return '../'.repeat(depth) + 'login.html';
    }

    function redirecionar(depth, returnTo) {
        let url = getLoginUrl(depth);
        if (returnTo) url += '?returnTo=' + encodeURIComponent(returnTo);
        window.location.replace(url);
    }

    /** Extrai os últimos 2 segmentos do pathname atual: "PastaFerramenta/arquivo.html" */
    function paginaAtual() {
        const path = decodeURIComponent(window.location.pathname).replace(/\\/g, '/');
        const segs = path.split('/').filter(Boolean);
        if (segs.length < 2) return (segs[0] || '').toLowerCase();
        return (segs[segs.length - 2] + '/' + segs[segs.length - 1]).toLowerCase();
    }

    /** Retorna o caminho completo normalizado (todos os segmentos, minúsculo) */
    function pathCompleto() {
        return decodeURIComponent(window.location.pathname)
            .replace(/\\/g, '/')
            .split('/').filter(Boolean).join('/').toLowerCase();
    }

    /**
     * Verifica autenticação e autorização. Redireciona para login se não autorizado.
     * @param {number} depthToRoot  Níveis de pasta até a raiz do portal (padrão: 1)
     * @returns {object|null}       Objeto userAuth do sessionStorage, ou null se não autorizado
     */
    /**
     * @param {number} depthToRoot
     * @param {{ returnAfterLogin?: boolean }} [opts]
     */
    async function init(depthToRoot, opts) {
        depthToRoot = depthToRoot ?? 1;
        const returnTo = opts?.returnAfterLogin ? window.location.href : null;

        // 1. sessionStorage
        const saved = sessionStorage.getItem('userAuth');
        if (!saved) { redirecionar(depthToRoot, returnTo); return null; }

        let auth;
        try { auth = JSON.parse(saved); } catch { redirecionar(depthToRoot, returnTo); return null; }

        // 2. Admin tem acesso irrestrito — verificação antecipada antes do round-trip Supabase
        if (auth.isAdmin) {
            // Valida que a sessão Supabase ainda existe; se não, força novo login
            const sbAdm = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            const { data: admData } = await sbAdm.auth.getSession();
            if (!admData?.session) {
                sessionStorage.removeItem('userAuth');
                redirecionar(depthToRoot, returnTo);
                return null;
            }
            return auth;
        }

        // 3. Sessão Supabase Auth (usuário comum)
        const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
            sessionStorage.removeItem('userAuth');
            redirecionar(depthToRoot, returnTo);
            return null;
        }

        const { data, error } = await sb
            .from('usuario_ferramentas')
            .select('ferramentas ( url_base )');

        if (error) { redirecionar(depthToRoot, returnTo); return null; }

        const urlsAutorizadas = (data || [])
            .map(r => r.ferramentas?.url_base)
            .filter(Boolean)
            .map(u => decodeURIComponent(u)
                .replace(/^\.\//, '')
                .replace(/\\/g, '/')
                .toLowerCase()
            );

        const atual = paginaAtual();
        const fullPath = pathCompleto();
        const pastaAtual = atual.split('/')[0];

        // Acesso permitido se: URL exata (last-2 match), mesma pasta, ou URL completa é sufixo do path atual
        const autorizado = urlsAutorizadas.some(u =>
            u === atual ||
            u.startsWith(pastaAtual + '/') ||
            fullPath.endsWith(u)
        );
        if (!autorizado) { redirecionar(depthToRoot, returnTo); return null; }

        return auth;
    }

    return { init };
})();
