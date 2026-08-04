-- ============================================================
-- MAPEAMENTO ESTRATÉGICO — campos "Outros" (texto livre)
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.contabil_mapeamento
    ADD COLUMN IF NOT EXISTS forma_envio_documentos_outros_detalhe TEXT,
    ADD COLUMN IF NOT EXISTS entregaveis_esperados_outros_detalhe  TEXT,
    ADD COLUMN IF NOT EXISTS sistemas_utilizados_outros_detalhe    TEXT;
