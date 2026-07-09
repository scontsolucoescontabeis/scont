-- Migração: adiciona período aquisitivo (início/fim) à tabela de férias calculadas
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_ferias_calculadas
    ADD COLUMN IF NOT EXISTS aquisitivo_inicio DATE,
    ADD COLUMN IF NOT EXISTS aquisitivo_fim DATE;
