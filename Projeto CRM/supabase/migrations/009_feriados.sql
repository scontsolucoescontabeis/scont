-- Migration 009: Calendário de feriados e datas fiscais do chatbot
-- Idempotente: IF NOT EXISTS em todas as operações.

-- Tabela de eventos
CREATE TABLE IF NOT EXISTS chatbot_feriados (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data           DATE        NOT NULL,
  nome           TEXT        NOT NULL,
  tipo           TEXT        NOT NULL CHECK (tipo IN ('FERIADO', 'DATA_PICO')),
  msg_especifica TEXT,
  ativo          BOOLEAN     NOT NULL DEFAULT true,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para lookup diário (a query mais frequente é WHERE data = TODAY AND ativo = true)
CREATE INDEX IF NOT EXISTS chatbot_feriados_data_ativo_idx
  ON chatbot_feriados (data)
  WHERE ativo = true;

-- RLS
ALTER TABLE chatbot_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feriados_select" ON chatbot_feriados;
DROP POLICY IF EXISTS "feriados_write"  ON chatbot_feriados;

CREATE POLICY "feriados_select" ON chatbot_feriados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "feriados_write" ON chatbot_feriados
  FOR ALL TO authenticated
  USING (get_user_role() = 'ADMIN')
  WITH CHECK (get_user_role() = 'ADMIN');

-- Realtime (admin pode ver atualizações em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE chatbot_feriados;

-- Seed: feriados nacionais 2026 + datas fiscais relevantes para escritório contábil
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM chatbot_feriados LIMIT 1) THEN
    INSERT INTO chatbot_feriados (data, nome, tipo, msg_especifica) VALUES

      -- Feriados nacionais 2026
      ('2026-01-01', 'Confraternização Universal',   'FERIADO', NULL),
      ('2026-03-03', 'Carnaval — 2ª feira',           'FERIADO', NULL),
      ('2026-03-04', 'Carnaval — 3ª feira',           'FERIADO', NULL),
      ('2026-04-03', 'Paixão de Cristo',              'FERIADO', NULL),
      ('2026-04-21', 'Tiradentes',                    'FERIADO', NULL),
      ('2026-05-01', 'Dia do Trabalho',               'FERIADO', NULL),
      ('2026-06-04', 'Corpus Christi',                'FERIADO', NULL),
      ('2026-09-07', 'Independência do Brasil',       'FERIADO', NULL),
      ('2026-10-12', 'Nossa Srª Aparecida',           'FERIADO', NULL),
      ('2026-11-02', 'Finados',                       'FERIADO', NULL),
      ('2026-11-15', 'Proclamação da República',      'FERIADO', NULL),
      ('2026-11-20', 'Consciência Negra',             'FERIADO', NULL),
      ('2026-12-25', 'Natal',                         'FERIADO', NULL),

      -- Datas-pico fiscais 2026
      ('2026-01-31', 'Prazo DIRF',            'DATA_PICO', '⚠️ Estamos em período de entrega da DIRF. O prazo de resposta pode ser superior ao habitual.'),
      ('2026-03-31', 'Prazo DEFIS — Simples Nacional', 'DATA_PICO', '⚠️ Estamos em período de entrega do DEFIS. O prazo de resposta pode ser superior ao habitual.'),
      ('2026-04-30', 'Prazo entrega IRPF',     'DATA_PICO', '⚠️ Estamos em período de entrega do Imposto de Renda. Nossa equipe está em alta demanda — o prazo de resposta pode ser superior ao habitual.'),
      ('2026-05-31', 'Prazo DASN — MEI',       'DATA_PICO', '⚠️ Estamos em período de entrega da DASN (MEI). O prazo de resposta pode ser superior ao habitual.'),
      ('2026-07-31', 'Prazo ECF / IRPJ — Lucro Presumido', 'DATA_PICO', '⚠️ Estamos em período de entrega da ECF/IRPJ. O prazo de resposta pode ser superior ao habitual.'),
      ('2026-12-20', 'Fechamento folha — 13º salário', 'DATA_PICO', '⚠️ Estamos em período de fechamento do 13º salário. O prazo de resposta pode ser superior ao habitual.');
  END IF;
END $$;
