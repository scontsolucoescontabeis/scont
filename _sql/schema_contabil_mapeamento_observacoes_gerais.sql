-- ============================================================
-- MAPEAMENTO ESTRATÉGICO — campo "Observações Gerais"
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.contabil_mapeamento
    ADD COLUMN IF NOT EXISTS observacoes_gerais TEXT;
