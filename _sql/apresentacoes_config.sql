-- ============================================================
-- Boas Vindas — configurações editáveis da apresentação
-- Linha única (id = 1) com um JSON chave -> valor: textos por regime
-- (simples.*, presumido.*), por situação (nova.balanco, outra.balanco)
-- e inicio_cobranca_padrao (YYYY-MM-DD). Chave ausente = texto padrão
-- do index.html. Leitura pública via função (mesmo padrão de
-- fn_buscar_apresentacao_publica); escrita só admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.apresentacoes_config (
    id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    config        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.apresentacoes_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.apresentacoes_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "apresentacoes_config: admin gerencia" ON public.apresentacoes_config;
CREATE POLICY "apresentacoes_config: admin gerencia"
    ON public.apresentacoes_config FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.fn_buscar_config_apresentacoes()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE((SELECT config FROM public.apresentacoes_config WHERE id = 1), '{}'::jsonb);
$$;
GRANT EXECUTE ON FUNCTION public.fn_buscar_config_apresentacoes() TO anon, authenticated;
