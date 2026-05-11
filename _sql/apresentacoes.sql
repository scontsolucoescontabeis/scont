-- ============================================================
-- TABELA: apresentacoes
-- Projeto Boas Vindas — links personalizados por cliente
-- Execute este script no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apresentacoes (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social      TEXT        NOT NULL,
    cnpj              TEXT        NOT NULL,
    inscricao         TEXT,
    regime            TEXT,
    porte             TEXT,
    ramo              TEXT,
    cnae_principal    TEXT,
    cnaes_secundarios TEXT,
    nome_contato      TEXT        NOT NULL,
    email_cliente     TEXT        NOT NULL,
    telefone          TEXT,
    cargo             TEXT,
    mensagem          TEXT,
    acessos           INTEGER     NOT NULL DEFAULT 0,
    ativo             BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apresentacoes_email    ON public.apresentacoes (email_cliente);
CREATE INDEX IF NOT EXISTS idx_apresentacoes_criado   ON public.apresentacoes (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_apresentacoes_ativo    ON public.apresentacoes (ativo);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.apresentacoes ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa com o link pode visualizar (necessário para a página pública)
DROP POLICY IF EXISTS "apresentacoes: leitura pública ativa" ON public.apresentacoes;
CREATE POLICY "apresentacoes: leitura pública ativa"
    ON public.apresentacoes FOR SELECT
    USING (ativo = TRUE);

-- Somente administradores podem criar, editar e excluir
DROP POLICY IF EXISTS "apresentacoes: admin gerencia" ON public.apresentacoes;
CREATE POLICY "apresentacoes: admin gerencia"
    ON public.apresentacoes FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ============================================================
-- FUNÇÃO: fn_registrar_acesso_apresentacao
-- Incrementa o contador de acessos de forma segura
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_registrar_acesso_apresentacao(p_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
    UPDATE public.apresentacoes
    SET acessos = acessos + 1
    WHERE id = p_id AND ativo = TRUE;
$$;

-- Permite que qualquer usuário (inclusive anônimo) chame a função
GRANT EXECUTE ON FUNCTION public.fn_registrar_acesso_apresentacao(UUID) TO anon, authenticated;
