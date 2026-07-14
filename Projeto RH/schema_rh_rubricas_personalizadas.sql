-- Migração: coluna descricao_rubrica em rh_config_rubricas_txt
-- Permite cadastrar rubricas personalizadas (fora dos 8 eventos fixos)
-- pela ferramenta de Lançamentos, mantendo o Controle de Frequência
-- inalterado (ele só usa os 8 eventos fixos + observacoes, sem descricao).
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_config_rubricas_txt
  ADD COLUMN IF NOT EXISTS descricao_rubrica TEXT;
