-- Migração: adiciona nome_empresa à tabela de férias calculadas
-- (a coluna nunca existiu; a tela "Informações de Férias" precisa dela)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_ferias_calculadas
    ADD COLUMN IF NOT EXISTS nome_empresa TEXT;
