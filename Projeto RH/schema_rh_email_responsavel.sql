-- Migração: e-mail do(s) responsável(is) pelo envio de documentos (Benefícios / Folha de Ponto)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_empresas ADD COLUMN IF NOT EXISTS email_responsavel TEXT;
ALTER TABLE public.rh_grupos_empresas ADD COLUMN IF NOT EXISTS email_responsavel TEXT;
