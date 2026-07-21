-- ============================================================
-- Onboarding Contábil — novo gatilho "empresa recém-aberta"
-- Execute no SQL Editor do Supabase (projeto principal)
-- Idempotente: ADD COLUMN IF NOT EXISTS
-- ============================================================

ALTER TABLE public.contabil_onboardings
    ADD COLUMN IF NOT EXISTS empresa_recem_aberta BOOLEAN NOT NULL DEFAULT FALSE;

-- Resultado esperado: coluna criada (ou já existente, sem erro).
-- Habilita a Seção C.0 (capital social, integralização, imobilizado
-- inicial) para onboardings de empresas em constituição.
