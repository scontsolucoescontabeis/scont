-- supabase/migrations/010_sla_config.sql
CREATE TABLE sla_config (
  departamento          TEXT PRIMARY KEY,
  tempo_maximo_min      INT NOT NULL DEFAULT 30,
  threshold_aviso_min   INT NOT NULL DEFAULT 10,
  threshold_critico_min INT NOT NULL DEFAULT 5,
  ativo                 BOOLEAN NOT NULL DEFAULT true,
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_config_read" ON sla_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "sla_config_write" ON sla_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

INSERT INTO sla_config (departamento, tempo_maximo_min, threshold_aviso_min, threshold_critico_min)
VALUES
  ('PESSOAL',        30, 10, 5),
  ('CONTABIL',       30, 10, 5),
  ('ADMINISTRATIVO', 30, 10, 5),
  ('TRIBUTARIO',     30, 10, 5);
