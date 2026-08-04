-- ============================================================
-- MAPEAMENTO ESTRATÉGICO — campos "Outros" e Sistema Financeiro
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.contabil_mapeamento
    ADD COLUMN IF NOT EXISTS sistema_financeiro_utilizado          TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sistema_financeiro_outros_detalhe     TEXT,
    ADD COLUMN IF NOT EXISTS forma_envio_documentos_outros_detalhe TEXT,
    ADD COLUMN IF NOT EXISTS entregaveis_esperados_outros_detalhe  TEXT;
