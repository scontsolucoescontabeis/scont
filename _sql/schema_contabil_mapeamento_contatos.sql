-- ============================================================
-- CONTATO DA EMPRESA -> tabela própria, leitura restrita a
-- admin / equipe SCONT Soluções Contábeis (mesmo padrão de
-- schema_contabil_bancos.sql / schema_contabil_bancos_restringir_prestador.sql)
--
-- Pedido explícito do usuário: Prestador de Serviço não pode visualizar
-- o contato da empresa no Mapeamento Estratégico — nem na tela, nem via
-- leitura direta da API (a mera ocultação client-side não bastava).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contabil_mapeamento_contatos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapeamento_id  UUID NOT NULL UNIQUE REFERENCES public.contabil_mapeamento (id) ON DELETE CASCADE,
    nome           TEXT,
    telefone       TEXT,
    email          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contabil_mapeamento_contatos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.contabil_pode_ver_contato()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT public.is_admin() OR EXISTS (
        SELECT 1 FROM public.solicitacoes_acesso
        WHERE email = auth.email()
          AND lower(empresa) = 'scont soluções contábeis'
    );
$$;

GRANT EXECUTE ON FUNCTION public.contabil_pode_ver_contato() TO authenticated;

DROP POLICY IF EXISTS "contabil_contatos: leitura restrita scont/admin" ON public.contabil_mapeamento_contatos;
DROP POLICY IF EXISTS "contabil_contatos: escrita restrita scont/admin" ON public.contabil_mapeamento_contatos;

CREATE POLICY "contabil_contatos: leitura restrita scont/admin"
    ON public.contabil_mapeamento_contatos FOR SELECT
    TO authenticated USING (public.contabil_pode_ver_contato());

CREATE POLICY "contabil_contatos: escrita restrita scont/admin"
    ON public.contabil_mapeamento_contatos FOR ALL
    TO authenticated USING (public.contabil_pode_ver_contato()) WITH CHECK (public.contabil_pode_ver_contato());

-- Migra os dados existentes de contato_nome/telefone/email (colunas em
-- contabil_mapeamento) para a tabela nova, antes de remover as colunas.
INSERT INTO public.contabil_mapeamento_contatos (mapeamento_id, nome, telefone, email)
SELECT m.id, m.contato_nome, m.contato_telefone, m.contato_email
FROM public.contabil_mapeamento m
WHERE m.contato_nome IS NOT NULL OR m.contato_telefone IS NOT NULL OR m.contato_email IS NOT NULL
ON CONFLICT (mapeamento_id) DO NOTHING;

ALTER TABLE public.contabil_mapeamento DROP COLUMN IF EXISTS contato_nome;
ALTER TABLE public.contabil_mapeamento DROP COLUMN IF EXISTS contato_telefone;
ALTER TABLE public.contabil_mapeamento DROP COLUMN IF EXISTS contato_email;
