-- ================================================================
-- SCONT · Quadrante Etiquetas · Folha de Pagamento
-- Tabelas para rascunho e envio do formulário de fechamento
-- ================================================================

-- ── Rascunho (auto-salvo pelo formulário) ──────────────────────
CREATE TABLE IF NOT EXISTS quadrante_folha_rascunho (
  id              BIGSERIAL PRIMARY KEY,
  empresa_codigo  TEXT        NOT NULL DEFAULT '453',
  competencia     TEXT        NOT NULL,          -- "MM/AAAA"
  tipo_folha      TEXT        NOT NULL,          -- "11","41","42","51","52","70"
  dados           JSONB       NOT NULL,          -- { employees, extraCols, convenios }
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apenas um rascunho por competência/tipo por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_rascunho_empresa_comp_tipo
  ON quadrante_folha_rascunho (empresa_codigo, competencia, tipo_folha);

-- ── Envios validados (após "Confirmar Envio") ──────────────────
CREATE TABLE IF NOT EXISTS quadrante_folha_envios (
  id              BIGSERIAL PRIMARY KEY,
  empresa_codigo  TEXT        NOT NULL DEFAULT '453',
  competencia     TEXT        NOT NULL,
  tipo_folha      TEXT        NOT NULL,
  dados           JSONB       NOT NULL,          -- snapshot completo do formulário
  enviado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado      BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── RLS: permitir leitura e escrita sem autenticação (anon) ───
ALTER TABLE quadrante_folha_rascunho ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadrante_folha_envios   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_rascunho" ON quadrante_folha_rascunho
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_envios" ON quadrante_folha_envios
  FOR ALL TO anon USING (true) WITH CHECK (true);
