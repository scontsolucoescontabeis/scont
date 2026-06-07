-- supabase/migrations/010_sla_config.sql
CREATE TABLE IF NOT EXISTS sla_config (
  departamento          TEXT PRIMARY KEY,
  tempo_maximo_min      INT NOT NULL DEFAULT 30,
  threshold_aviso_min   INT NOT NULL DEFAULT 10,
  threshold_critico_min INT NOT NULL DEFAULT 5,
  ativo                 BOOLEAN NOT NULL DEFAULT true,
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sla_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_config_read"  ON sla_config;
DROP POLICY IF EXISTS "sla_config_write" ON sla_config;

CREATE POLICY "sla_config_read" ON sla_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "sla_config_write" ON sla_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

INSERT INTO sla_config (departamento, tempo_maximo_min, threshold_aviso_min, threshold_critico_min, ativo, atualizado_em)
VALUES
  ('PESSOAL',        30, 10, 5, true, NOW()),
  ('CONTABIL',       30, 10, 5, true, NOW()),
  ('ADMINISTRATIVO', 30, 10, 5, true, NOW()),
  ('TRIBUTARIO',     30, 10, 5, true, NOW())
ON CONFLICT (departamento) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE sla_config;
