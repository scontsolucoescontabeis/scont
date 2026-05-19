-- ================================================================
-- SCONT · Fix RLS · quadrante_folha_envios + rascunho
-- Execute no SQL Editor do Supabase
-- ================================================================

-- Habilitar RLS (se ainda não estiver)
ALTER TABLE quadrante_folha_envios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadrante_folha_rascunho ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas (se existirem) para recriar limpo
DROP POLICY IF EXISTS "anon_all_envios"    ON quadrante_folha_envios;
DROP POLICY IF EXISTS "anon_all_rascunho"  ON quadrante_folha_rascunho;

-- Política: anon pode fazer tudo (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "anon_all_envios" ON quadrante_folha_envios
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_all_rascunho" ON quadrante_folha_rascunho
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
