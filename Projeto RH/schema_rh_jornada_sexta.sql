-- Migração: jornada diferenciada para Sexta-feira em rh_saves
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_saves
  ADD COLUMN IF NOT EXISTS jornada_sexta TEXT,
  ADD COLUMN IF NOT EXISTS jornada_sexta_ativa BOOLEAN DEFAULT FALSE;
