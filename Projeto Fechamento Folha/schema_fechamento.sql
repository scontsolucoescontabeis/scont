-- ============================================================
-- SCONT – FECHAMENTO FOLHA DE PAGAMENTO
-- Novas tabelas para o módulo de fechamento
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Configuração de rubricas por empresa / coluna da planilha
CREATE TABLE IF NOT EXISTS public.fechamento_rubricas_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    coluna_planilha TEXT NOT NULL,   -- nome exato do cabeçalho no Excel
    codigo_rubrica  TEXT NOT NULL,
    tipo_processo   TEXT NOT NULL DEFAULT '01',
    tipo_valor      TEXT NOT NULL DEFAULT 'monetario', -- 'monetario' | 'minutos' | 'dias'
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fechamento_rubricas_config_unique UNIQUE (codigo_empresa, coluna_planilha)
);

CREATE INDEX IF NOT EXISTS idx_fechamento_rubricas_empresa
    ON public.fechamento_rubricas_config (codigo_empresa);

-- RLS
ALTER TABLE public.fechamento_rubricas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_rubricas: leitura autenticado" ON public.fechamento_rubricas_config;
DROP POLICY IF EXISTS "fechamento_rubricas: escrita autenticado"  ON public.fechamento_rubricas_config;

CREATE POLICY "fechamento_rubricas: leitura autenticado"
    ON public.fechamento_rubricas_config FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "fechamento_rubricas: escrita autenticado"
    ON public.fechamento_rubricas_config FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- DADOS INICIAIS – Quadrante (código 453)
-- Ajuste os codigo_rubrica e tipo_processo conforme o sistema
-- ============================================================
INSERT INTO public.fechamento_rubricas_config
    (codigo_empresa, coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao)
VALUES
    ('453', 'SALÁRIO',                 '000001', '01', 'monetario', 'Salário Base'),
    ('453', 'HE 65%',                  '000002', '01', 'minutos',   'Horas Extras 65%'),
    ('453', 'HE 100%',                 '000003', '01', 'minutos',   'Horas Extras 100%'),
    ('453', 'Adic Not ',               '000004', '01', 'minutos',   'Adicional Noturno'),
    ('453', ' Comissão ',              '000005', '01', 'monetario', 'Comissão'),
    ('453', ' Prêmio ',                '000006', '01', 'monetario', 'Prêmio'),
    ('453', ' Vale Transporte ',       '000007', '01', 'monetario', 'Vale Transporte'),
    ('453', 'Faltas (Dias)',            '000008', '01', 'dias',      'Faltas em Dias'),
    ('453', 'Faltas DSR (Dias)',        '000009', '01', 'dias',      'Faltas DSR'),
    ('453', 'Atrasos (Horas)',          '000010', '01', 'minutos',   'Atrasos'),
    ('453', ' Desconto Autorizado ',   '000011', '01', 'monetario', 'Desconto Autorizado'),
    ('453', ' Plano Saúde  ',          '000012', '01', 'monetario', 'Plano de Saúde'),
    ('453', 'Cota Custeio  Sindicato', '000013', '01', 'booleano',  'Cota Sindicato (Sim/Não)')
ON CONFLICT (codigo_empresa, coluna_planilha) DO NOTHING;
