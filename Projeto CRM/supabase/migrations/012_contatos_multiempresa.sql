-- ============================================================
-- Migration 012 — Suporte a múltiplas empresas por contato
-- ============================================================

-- 1. Nova tabela de vínculo contato ↔ empresa
CREATE TABLE IF NOT EXISTS contatos_empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id  UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  empresa     TEXT NOT NULL,
  cargo       TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contato_id, empresa)
);

-- 2. Migrar dados existentes de contatos.empresa + contatos.cargo
INSERT INTO contatos_empresas (contato_id, empresa, cargo)
SELECT id, empresa, cargo
FROM contatos
WHERE empresa IS NOT NULL AND empresa <> ''
ON CONFLICT (contato_id, empresa) DO NOTHING;

-- 3. Remover colunas obsoletas de contatos
ALTER TABLE contatos DROP COLUMN IF EXISTS empresa;
ALTER TABLE contatos DROP COLUMN IF EXISTS cargo;

-- 4. Índice
CREATE INDEX IF NOT EXISTS idx_contatos_empresas_contato ON contatos_empresas(contato_id);

-- 5. RLS
ALTER TABLE contatos_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contatos_empresas_select" ON contatos_empresas;
DROP POLICY IF EXISTS "contatos_empresas_insert" ON contatos_empresas;
DROP POLICY IF EXISTS "contatos_empresas_update" ON contatos_empresas;
DROP POLICY IF EXISTS "contatos_empresas_delete" ON contatos_empresas;

CREATE POLICY "contatos_empresas_select" ON contatos_empresas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contatos_empresas_insert" ON contatos_empresas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contatos_empresas_update" ON contatos_empresas
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "contatos_empresas_delete" ON contatos_empresas
  FOR DELETE TO authenticated USING (true);

-- 6. Realtime (opcional, não crítico)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE contatos_empresas;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
