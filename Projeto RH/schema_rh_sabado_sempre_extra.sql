-- Migração: flag "Sábado Sempre Extra" em rh_saves
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_saves
  ADD COLUMN IF NOT EXISTS sabado_sempre_extra BOOLEAN DEFAULT FALSE;
