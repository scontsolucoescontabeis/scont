-- ============================================================
-- Benefícios VA/VT — Schema Supabase
-- Execute no SQL Editor do Supabase (projeto Portal SCONT)
-- Idempotente: pode ser re-executado sem erros
-- ============================================================

-- Tabela 1: Configuração de rubricas e valor padrão por empresa
CREATE TABLE IF NOT EXISTS public.rh_beneficios_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    tipo            TEXT NOT NULL CHECK (tipo IN ('vt', 'va')),
    codigo_rubrica  TEXT NOT NULL DEFAULT '',
    tipo_processo   TEXT NOT NULL DEFAULT '11',
    valor_dia       NUMERIC(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT rh_ben_config_empresa_tipo_unique UNIQUE (codigo_empresa, tipo)
);
CREATE INDEX IF NOT EXISTS idx_rh_ben_config_empresa ON public.rh_beneficios_config (codigo_empresa);

-- Tabela 2: Valores individuais por empregado (override do padrão)
CREATE TABLE IF NOT EXISTS public.rh_beneficios_individuais (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    codigo_empregado  TEXT NOT NULL,
    vt_valor_dia      NUMERIC(10,2),   -- NULL = usa padrão da empresa
    va_valor_dia      NUMERIC(10,2),   -- NULL = usa padrão da empresa
    CONSTRAINT rh_ben_ind_empresa_emp_unique UNIQUE (codigo_empresa, codigo_empregado)
);
CREATE INDEX IF NOT EXISTS idx_rh_ben_ind_empresa ON public.rh_beneficios_individuais (codigo_empresa);

-- Tabela 3: Lançamentos salvos por empresa/competência
CREATE TABLE IF NOT EXISTS public.rh_beneficios_lancamentos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa        TEXT NOT NULL,
    competencia_pagamento TEXT NOT NULL,   -- MM/AAAA (entra no TXT)
    mes_referencia        TEXT,            -- MM/AAAA (mês futuro de trabalho)
    tipo_processo         TEXT NOT NULL DEFAULT '11',
    linhas_json           JSONB NOT NULL DEFAULT '[]',
    usuario_id            UUID,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rh_ben_lanc_empresa_comp_unique UNIQUE (codigo_empresa, competencia_pagamento)
);
CREATE INDEX IF NOT EXISTS idx_rh_ben_lanc_empresa ON public.rh_beneficios_lancamentos (codigo_empresa);

-- ============================================================
-- RLS — mesmo padrão das outras tabelas rh_*
-- ============================================================

ALTER TABLE public.rh_beneficios_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_beneficios_individuais  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_beneficios_lancamentos  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_ben_config: autenticado"      ON public.rh_beneficios_config;
DROP POLICY IF EXISTS "rh_ben_ind: autenticado"         ON public.rh_beneficios_individuais;
DROP POLICY IF EXISTS "rh_ben_lanc: autenticado"        ON public.rh_beneficios_lancamentos;

CREATE POLICY "rh_ben_config: autenticado"
    ON public.rh_beneficios_config FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "rh_ben_ind: autenticado"
    ON public.rh_beneficios_individuais FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "rh_ben_lanc: autenticado"
    ON public.rh_beneficios_lancamentos FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);
