-- Migração: coluna email em rh_empresas (novo campo do layout do relatório do ERP)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_empresas ADD COLUMN IF NOT EXISTS email TEXT;
