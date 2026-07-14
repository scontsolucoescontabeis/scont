-- Migração: coluna UF em rh_empresas (derivada do CEP na importação)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_empresas ADD COLUMN IF NOT EXISTS uf TEXT;
