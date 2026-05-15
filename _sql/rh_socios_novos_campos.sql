-- ============================================================
-- Adiciona novos campos à tabela rh_socios
-- Execute no SQL Editor do Supabase (projeto principal)
-- Idempotente: ADD COLUMN IF NOT EXISTS
-- ============================================================

ALTER TABLE public.rh_socios
    ADD COLUMN IF NOT EXISTS capital_social           NUMERIC(18,2)   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS email_empresa            TEXT            DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS data_atualizacao_quadro  DATE            DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS data_saida               DATE            DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS email_socio              TEXT            DEFAULT NULL;
