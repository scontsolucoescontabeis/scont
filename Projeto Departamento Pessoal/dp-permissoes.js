/**
 * SCONT Portal — Sub-permissões do hub Departamento Pessoal
 *
 * Permite ao admin conceder acesso ao hub e, dentro dele, restringir quais
 * ferramentas específicas (inclusive Configurações) cada usuário pode abrir.
 * Usa o mesmo mecanismo genérico de sub-permissão do resto do portal
 * (ferramentas.sub_permissoes / usuario_ferramentas.permissoes).
 *
 * Chamar sempre DEPOIS de window.PortalAuthGuard.init() já ter validado a
 * sessão. Requer SUPABASE_URL/SUPABASE_KEY globais (supabase-config.js) e o
 * SDK do Supabase já carregados na página.
 */
window.DPPermissoes = (function () {

    const HUB_NOME = 'Departamento Pessoal';

    /**
     * Carrega o nível de acesso do usuário ao hub.
     * @returns {Promise<true|false|string[]>}
     *   true  = acesso total (admin, ou concessão sem sub-permissões marcadas)
     *   false = nenhuma concessão ao hub Departamento Pessoal
     *   string[] = lista das chaves liberadas
     */
    async function carregar(auth) {
        if (!auth) return false;
        if (auth.isAdmin) return true;

        const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await sb
            .from('usuario_ferramentas')
            .select('permissoes, ferramentas ( nome )')
            .eq('usuario_id', auth.userId);

        if (error) return false;

        const entry = (data || []).find(r => r.ferramentas?.nome === HUB_NOME);
        if (!entry) return false;

        const permissoes = entry.permissoes || [];
        return permissoes.length === 0 ? true : permissoes;
    }

    /**
     * Exige a sub-permissão `chave`. Redireciona para o hub e retorna false
     * se o usuário não tiver acesso ao hub ou não tiver essa chave liberada.
     */
    async function exigir(auth, chave, depthToRoot) {
        depthToRoot = depthToRoot ?? 1;
        const acesso = await carregar(auth);
        const autorizado = acesso === true || (Array.isArray(acesso) && acesso.includes(chave));
        if (!autorizado) {
            window.location.replace('../'.repeat(depthToRoot) + 'Projeto Departamento Pessoal/index.html');
            return false;
        }
        return true;
    }

    return { carregar, exigir };
})();
