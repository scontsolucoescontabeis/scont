-- ============================================================
-- CONFIGURAÇÕES — Departamento Contábil
-- Responsáveis (usuários do portal) por empresa
--
-- Usado para restringir, no Painel do Administrador (Portal RH,
-- Projeto RH/admin.html), quais empresas um usuário vinculado à
-- empresa "Prestador de Serviço" pode visualizar. Usuários
-- vinculados a "SCONT Soluções Contábeis" (e super-admins do
-- portal) continuam vendo todas as empresas, sem precisar de
-- atribuição aqui.
-- ============================================================

-- 1. TABELA: contabil_empresas_responsaveis (N:N — uma empresa
--    pode ter 0, 1 ou vários responsáveis atribuídos)
CREATE TABLE IF NOT EXISTS public.contabil_empresas_responsaveis (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    usuario_id      UUID NOT NULL REFERENCES public.solicitacoes_acesso(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT contabil_empresas_responsaveis_unique UNIQUE (codigo_empresa, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_contabil_empresas_resp_empresa ON public.contabil_empresas_responsaveis (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_contabil_empresas_resp_usuario ON public.contabil_empresas_responsaveis (usuario_id);


-- 2. RLS (mesma convenção "authenticated" já usada em
--    contabil_empresas_config e demais tabelas contabil_*)
ALTER TABLE public.contabil_empresas_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_empresas_responsaveis: leitura autenticado" ON public.contabil_empresas_responsaveis;
DROP POLICY IF EXISTS "contabil_empresas_responsaveis: escrita autenticado"  ON public.contabil_empresas_responsaveis;

CREATE POLICY "contabil_empresas_responsaveis: leitura autenticado"
    ON public.contabil_empresas_responsaveis FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_empresas_responsaveis: escrita autenticado"
    ON public.contabil_empresas_responsaveis FOR ALL
    TO authenticated USING (true) WITH CHECK (true);


-- 3. FUNÇÃO: contabil_listar_usuarios_aprovados()
--    A tela de Configurações precisa listar todos os usuários
--    aprovados do portal (para escolher o(s) responsável(is) de
--    cada empresa), mas a RLS de solicitacoes_acesso só permite
--    que um usuário comum leia a própria linha (ou que um
--    is_admin leia tudo). Em vez de afrouxar a RLS da tabela
--    inteira (exporia telefone/cargo/status/motivo_rejeicao de
--    todo mundo a qualquer autenticado), expõe só os campos
--    necessários via função SECURITY DEFINER — mesmo padrão já
--    usado por public.is_admin() em schema.sql.
CREATE OR REPLACE FUNCTION public.contabil_listar_usuarios_aprovados()
RETURNS TABLE (id UUID, nome TEXT, email TEXT, empresa TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT id, nome, email, empresa
    FROM public.solicitacoes_acesso
    WHERE status = 'aprovado'
    ORDER BY nome;
$$;

GRANT EXECUTE ON FUNCTION public.contabil_listar_usuarios_aprovados() TO authenticated;
