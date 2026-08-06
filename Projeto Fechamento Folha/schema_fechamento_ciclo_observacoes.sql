-- ============================================================
-- SCONT – CONTROLE DE FECHAMENTO DA FOLHA
-- Observações gerais por ciclo de fechamento (Dashboard)
-- Execute no SQL Editor do Supabase (projeto Portal)
-- ============================================================

ALTER TABLE public.fechamento_ciclo
    ADD COLUMN IF NOT EXISTS observacoes TEXT;
