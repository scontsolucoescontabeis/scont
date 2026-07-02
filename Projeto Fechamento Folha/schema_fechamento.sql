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


-- ============================================================
-- RASCUNHO DO FORMULÁRIO QUADRANTE
-- Salva o preenchimento parcial para continuidade
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quadrante_folha_rascunho (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_codigo TEXT NOT NULL,
    competencia    TEXT NOT NULL,
    tipo_folha     TEXT NOT NULL,
    dados          JSONB NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT quadrante_rascunho_unique UNIQUE (empresa_codigo, competencia, tipo_folha)
);

CREATE INDEX IF NOT EXISTS idx_quadrante_rascunho_empresa
    ON public.quadrante_folha_rascunho (empresa_codigo, updated_at DESC);

ALTER TABLE public.quadrante_folha_rascunho ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rascunho: leitura autenticado" ON public.quadrante_folha_rascunho;
DROP POLICY IF EXISTS "rascunho: escrita autenticado"  ON public.quadrante_folha_rascunho;

CREATE POLICY "rascunho: leitura autenticado"
    ON public.quadrante_folha_rascunho FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "rascunho: escrita autenticado"
    ON public.quadrante_folha_rascunho FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- DADOS BANCÁRIOS — Relatório Líquido / Etiquetas Bancárias
-- Persiste a aba "Informações bancárias" entre competências.
-- tipo_conta é gerenciado manualmente na tela de revisão e
-- NUNCA é sobrescrito por uma nova importação.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fechamento_dados_bancarios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa   TEXT NOT NULL,
    codigo_empregado TEXT NOT NULL,
    cpf              TEXT,
    nome_empregado   TEXT,
    cargo            TEXT,
    centro_custo     TEXT,
    banco_codigo     TEXT,
    agencia          TEXT,
    conta            TEXT,
    tipo_conta       TEXT NOT NULL DEFAULT 'C.Corrente',
    atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fechamento_dados_bancarios_unique UNIQUE (codigo_empresa, codigo_empregado)
);

CREATE INDEX IF NOT EXISTS idx_fech_dados_bancarios_empresa
    ON public.fechamento_dados_bancarios (codigo_empresa);

ALTER TABLE public.fechamento_dados_bancarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_dados_bancarios: leitura autenticado" ON public.fechamento_dados_bancarios;
DROP POLICY IF EXISTS "fechamento_dados_bancarios: escrita autenticado"  ON public.fechamento_dados_bancarios;

CREATE POLICY "fechamento_dados_bancarios: leitura autenticado"
    ON public.fechamento_dados_bancarios FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_dados_bancarios: escrita autenticado"
    ON public.fechamento_dados_bancarios FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
