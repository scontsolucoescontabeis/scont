// Portal do Cliente - verificação de acesso compartilhada entre login (index.html) e portal (portal.html).
// O banco (RLS) é quem autoriza; sessionStorage é só conveniência, como no Portal SCONT.
(function (root) {
    const CHAVE_AUTH = 'clienteAuth';                 // sessão do portal do cliente (equivalente ao userAuth)
    const CHAVE_EMPRESA = 'cliente_empresa';          // código da empresa escolhida
    const CHAVE_NOMES = 'cliente_empresas_nomes';     // { codigo: nome } lembrado da busca/cadastro

    function lerSession(chave) { try { return sessionStorage.getItem(chave); } catch { return null; } }
    function gravarSession(chave, valor) {
        try { if (valor === null) sessionStorage.removeItem(chave); else sessionStorage.setItem(chave, valor); } catch { /* ignorar */ }
    }
    function lerNomes() {
        try { return JSON.parse(lerSession(CHAVE_NOMES) || '{}') || {}; } catch { return {}; }
    }
    function lembrarNome(codigo, nome) {
        if (!nome) return;
        const nomes = lerNomes();
        nomes[codigo] = nome;
        gravarSession(CHAVE_NOMES, JSON.stringify(nomes));
    }
    // Cliente não lê rh_empresas: o nome só existe se foi lembrado; senão mostra o código.
    function nomeEmpresa(codigo) { return lerNomes()[codigo] || ''; }
    function rotuloEmpresa(codigo) {
        const nome = nomeEmpresa(codigo);
        return nome ? `${nome} (${codigo})` : `Empresa ${codigo}`;
    }

    function lerAuth() {
        try { return JSON.parse(lerSession(CHAVE_AUTH) || 'null'); } catch { return null; }
    }
    function limparAuth() {
        gravarSession(CHAVE_AUTH, null);
        gravarSession(CHAVE_EMPRESA, null);
    }

    /**
     * Confere no banco se o usuário logado pode entrar no portal do cliente.
     * Retorna { ok: true, auth } ou { ok: false, tipo, mensagem, motivo }.
     * tipo: 'sem_sessao' | 'nao_cliente' | 'aguardando' | 'negado' | 'sem_pedido' | 'erro'
     */
    async function verificarAcesso(sb) {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return { ok: false, tipo: 'sem_sessao', mensagem: 'Sessão expirada. Faça login novamente.' };

        const base = { authUserId: user.id, email: user.email, loginTime: new Date().toISOString() };

        // Administrador do portal: visualiza qualquer empresa como o cliente.
        const { data: adm } = await sb.from('usuarios').select('nome, is_admin').eq('id', user.id).maybeSingle();
        if (adm && adm.is_admin === true) {
            const { data: empresas, error } = await sb
                .from('rh_empresas').select('codigo_empresa, nome_empresa').order('nome_empresa');
            if (error) return { ok: false, tipo: 'erro', mensagem: 'Não foi possível carregar as empresas. Tente novamente.' };
            (empresas || []).forEach(e => lembrarNome(e.codigo_empresa, e.nome_empresa));
            return {
                ok: true,
                auth: { ...base, isAdmin: true, nome: adm.nome || user.email, empresas: (empresas || []).map(e => e.codigo_empresa) }
            };
        }

        const { data: perfil, error: perfilErr } = await sb
            .from('cliente_usuarios').select('id, nome').eq('id', user.id).maybeSingle();
        if (perfilErr) return { ok: false, tipo: 'erro', mensagem: 'Não foi possível verificar seu acesso. Tente novamente.' };
        if (!perfil) {
            return { ok: false, tipo: 'nao_cliente', mensagem: 'Esta área é para clientes. A equipe SCONT entra pelo Portal SCONT.' };
        }

        const { data: vinculos, error: vincErr } = await sb
            .from('cliente_acessos').select('codigo_empresa, status, motivo').eq('usuario_id', user.id);
        if (vincErr) return { ok: false, tipo: 'erro', mensagem: 'Não foi possível consultar seus acessos. Tente novamente.' };

        const r = root.EstadoCliente.decidirEstado(vinculos);
        if (r.estado === 'aguardando') {
            return { ok: false, tipo: 'aguardando', mensagem: 'Sua solicitação ainda está pendente de aprovação pela equipe SCONT.' };
        }
        if (r.estado === 'sem_pedido') {
            return { ok: false, tipo: 'sem_pedido', mensagem: 'Não encontramos nenhum pedido de acesso para a sua conta. Entre em contato com a SCONT.' };
        }
        if (r.estado === 'negado') {
            return {
                ok: false, tipo: 'negado', motivo: r.motivo,
                mensagem: 'Seu pedido de acesso não foi liberado' + (r.motivo ? ` — motivo: ${r.motivo}` : '') +
                    '. Em caso de dúvida, entre em contato com a SCONT.'
            };
        }
        return { ok: true, auth: { ...base, isAdmin: false, nome: perfil.nome || user.email, empresas: r.empresas } };
    }

    function salvarAuth(auth) { gravarSession(CHAVE_AUTH, JSON.stringify(auth)); }

    root.AcessoCliente = {
        CHAVE_AUTH, CHAVE_EMPRESA,
        lerSession, gravarSession, lembrarNome, nomeEmpresa, rotuloEmpresa,
        lerAuth, salvarAuth, limparAuth, verificarAcesso
    };
})(window);
