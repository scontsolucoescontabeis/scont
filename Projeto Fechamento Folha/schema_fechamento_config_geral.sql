-- ============================================================
-- SCONT – CONTROLE DE FECHAMENTO DA FOLHA
-- Configuração geral (competência que a equipe está trabalhando)
-- Execute no SQL Editor do Supabase (projeto Portal)
-- ============================================================

-- Linha única (id = 1) com indicações gerais do processo, sem vínculo
-- a uma empresa específica. Hoje só guarda a competência "em execução"
-- (sobrepõe o mês corrente calculado automaticamente no Dashboard).
CREATE TABLE IF NOT EXISTS public.fechamento_config_geral (
    id                  INT PRIMARY KEY DEFAULT 1,
    competencia_atual   TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fechamento_config_geral_singleton CHECK (id = 1)
);

ALTER TABLE public.fechamento_config_geral ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_config_geral: leitura autenticado" ON public.fechamento_config_geral;
DROP POLICY IF EXISTS "fechamento_config_geral: escrita autenticado"  ON public.fechamento_config_geral;

CREATE POLICY "fechamento_config_geral: leitura autenticado"
    ON public.fechamento_config_geral FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_config_geral: escrita autenticado"
    ON public.fechamento_config_geral FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
