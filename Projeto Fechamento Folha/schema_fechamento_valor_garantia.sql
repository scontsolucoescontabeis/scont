-- Migração: valor configurável da Garantia Domingo/Feriado (Track & Field)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.fechamento_rubricas_config
    ADD COLUMN IF NOT EXISTS valor_garantia NUMERIC(10,2);
