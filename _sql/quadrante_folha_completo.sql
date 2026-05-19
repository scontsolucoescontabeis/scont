-- ================================================================
-- SCONT · Quadrante · Folha de Pagamento — SETUP COMPLETO
-- Cole tudo no SQL Editor do Supabase e clique em Run
-- ================================================================

-- 1. Criar tabelas (sem erro se já existirem)
CREATE TABLE IF NOT EXISTS quadrante_folha_rascunho (
  id              BIGSERIAL PRIMARY KEY,
  empresa_codigo  TEXT        NOT NULL DEFAULT '453',
  competencia     TEXT        NOT NULL,
  tipo_folha      TEXT        NOT NULL,
  dados           JSONB       NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rascunho_empresa_comp_tipo
  ON quadrante_folha_rascunho (empresa_codigo, competencia, tipo_folha);

CREATE TABLE IF NOT EXISTS quadrante_folha_envios (
  id              BIGSERIAL PRIMARY KEY,
  empresa_codigo  TEXT        NOT NULL DEFAULT '453',
  competencia     TEXT        NOT NULL,
  tipo_folha      TEXT        NOT NULL,
  dados           JSONB       NOT NULL,
  enviado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado      BOOLEAN     NOT NULL DEFAULT FALSE
);

-- 2. Desabilitar RLS (resolve o erro 42501)
ALTER TABLE quadrante_folha_rascunho DISABLE ROW LEVEL SECURITY;
ALTER TABLE quadrante_folha_envios   DISABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas (limpeza)
DROP POLICY IF EXISTS "anon_all_rascunho" ON quadrante_folha_rascunho;
DROP POLICY IF EXISTS "anon_all_envios"   ON quadrante_folha_envios;
