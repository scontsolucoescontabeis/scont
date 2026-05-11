-- ============================================================
-- MIGRAÇÃO: campo ativo na tabela certificados
-- Marca clientes/certificados inativos para excluí-los dos
-- relatórios de vencidos e a vencer.
-- Execute este script no Supabase SQL Editor
-- ============================================================

ALTER TABLE public.certificados
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_certificados_ativo
    ON public.certificados (ativo);
