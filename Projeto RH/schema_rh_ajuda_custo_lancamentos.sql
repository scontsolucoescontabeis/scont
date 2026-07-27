-- Migração: controle de lançamentos de Ajuda de Custo (rubrica 201) já gerados
-- Empresa 350 - ITC BRASIL TECNOLOGIAS LTDA — 1 registro por (empresa, competência)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.rh_ajuda_custo_lancamentos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa      TEXT NOT NULL,
    competencia         TEXT NOT NULL,
    gerado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rh_ajuda_custo_lancamentos_empresa_competencia_unique UNIQUE (codigo_empresa, competencia)
);

ALTER TABLE public.rh_ajuda_custo_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_ajuda_custo_lancamentos: leitura autenticado" ON public.rh_ajuda_custo_lancamentos;
DROP POLICY IF EXISTS "rh_ajuda_custo_lancamentos: escrita autenticado" ON public.rh_ajuda_custo_lancamentos;

CREATE POLICY "rh_ajuda_custo_lancamentos: leitura autenticado"
    ON public.rh_ajuda_custo_lancamentos FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "rh_ajuda_custo_lancamentos: escrita autenticado"
    ON public.rh_ajuda_custo_lancamentos FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);
