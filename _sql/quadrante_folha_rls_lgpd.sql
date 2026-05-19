-- ================================================================
-- SCONT · RLS LGPD · quadrante_folha_envios + rascunho
-- Apenas usuários autenticados (sessão Supabase Auth) acessam.
-- Execute no SQL Editor do Supabase.
-- ================================================================

-- 1. Reabilitar RLS
ALTER TABLE quadrante_folha_envios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadrante_folha_rascunho ENABLE ROW LEVEL SECURITY;

-- 2. Remover policies antigas
DROP POLICY IF EXISTS "anon_all_envios"          ON quadrante_folha_envios;
DROP POLICY IF EXISTS "anon_all_rascunho"        ON quadrante_folha_rascunho;
DROP POLICY IF EXISTS "auth_all_envios"          ON quadrante_folha_envios;
DROP POLICY IF EXISTS "auth_all_rascunho"        ON quadrante_folha_rascunho;

-- 3. Criar policies: apenas usuários com sessão autenticada têm acesso
CREATE POLICY "auth_all_envios" ON quadrante_folha_envios
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_all_rascunho" ON quadrante_folha_rascunho
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- anon não tem acesso a nada (sem policy = bloqueado por padrão)
