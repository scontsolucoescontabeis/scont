-- Migração: expandir rh_rubricas com novos campos
-- Execute no SQL Editor do Supabase

-- Tornar evento nullable
ALTER TABLE public.rh_rubricas
  ALTER COLUMN evento DROP NOT NULL;

-- Adicionar colunas (ignorado se já existirem)
ALTER TABLE public.rh_rubricas
  ADD COLUMN IF NOT EXISTS empresa           TEXT,
  ADD COLUMN IF NOT EXISTS descricao_rubrica TEXT,
  ADD COLUMN IF NOT EXISTS tipo              TEXT;

-- Migrar dados: copiar evento → descricao_rubrica onde ainda não preenchido
UPDATE public.rh_rubricas
  SET descricao_rubrica = evento
  WHERE descricao_rubrica IS NULL AND evento IS NOT NULL;

-- Remover constraint antiga (se ainda existir)
ALTER TABLE public.rh_rubricas
  DROP CONSTRAINT IF EXISTS rh_rubricas_empresa_evento_unique;

-- Atualizar índice
DROP INDEX IF EXISTS idx_rh_rubricas_empresa;
CREATE INDEX IF NOT EXISTS idx_rh_rubricas_empresa ON public.rh_rubricas (codigo_empresa);
