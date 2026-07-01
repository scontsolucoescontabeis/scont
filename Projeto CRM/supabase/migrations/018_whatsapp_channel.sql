-- supabase/migrations/018_whatsapp_channel.sql
DO $$ BEGIN CREATE TYPE canal_whatsapp_enum AS ENUM ('QR_CODE', 'API_OFICIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE status_conexao_whatsapp_enum AS ENUM ('DESCONECTADO', 'CONECTANDO', 'CONECTADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id             INT PRIMARY KEY DEFAULT 1,
  canal_ativo    canal_whatsapp_enum NOT NULL DEFAULT 'QR_CODE',
  status_conexao status_conexao_whatsapp_enum NOT NULL DEFAULT 'DESCONECTADO',
  qrcode_base64  TEXT,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_config_singleton CHECK (id = 1)
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_config_read"  ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_write" ON whatsapp_config;

CREATE POLICY "whatsapp_config_read" ON whatsapp_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "whatsapp_config_write" ON whatsapp_config
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'ADMIN')
  );

INSERT INTO whatsapp_config (id, canal_ativo, status_conexao)
VALUES (1, 'QR_CODE', 'DESCONECTADO')
ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_config;
