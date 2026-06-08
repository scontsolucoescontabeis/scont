-- 1. Classificação por empresa vinculada
ALTER TABLE contatos_empresas
  ADD COLUMN IF NOT EXISTS classificacao TEXT
  CHECK (classificacao IN ('BRONZE', 'PRATA', 'OURO'));

-- 2. Mensagens de boas-vindas por tier no chatbot_config
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_bronze TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_prata  TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS msg_boas_vindas_ouro   TEXT;

-- 3. Classificação na sessão e na conversa
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS classificacao_empresa TEXT;
ALTER TABLE conversas       ADD COLUMN IF NOT EXISTS classificacao_empresa TEXT;

-- 4. Tabela global de multiplicadores SLA por tier
CREATE TABLE IF NOT EXISTS classificacao_sla_config (
  classificacao TEXT PRIMARY KEY
    CHECK (classificacao IN ('BRONZE', 'PRATA', 'OURO', 'SEM_CLASSIFICACAO')),
  multiplicador NUMERIC NOT NULL DEFAULT 1.0
    CHECK (multiplicador > 0)
);
INSERT INTO classificacao_sla_config (classificacao, multiplicador) VALUES
  ('OURO',              0.5),
  ('PRATA',             0.75),
  ('BRONZE',            1.0),
  ('SEM_CLASSIFICACAO', 1.0)
ON CONFLICT DO NOTHING;

-- 5. RLS para classificacao_sla_config
ALTER TABLE classificacao_sla_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "classificacao_sla_select" ON classificacao_sla_config;
DROP POLICY IF EXISTS "classificacao_sla_update" ON classificacao_sla_config;
CREATE POLICY "classificacao_sla_select" ON classificacao_sla_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "classificacao_sla_update" ON classificacao_sla_config
  FOR UPDATE TO authenticated USING (true);
