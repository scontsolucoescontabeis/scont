-- ============================================================
-- MIGRAÇÃO: novos campos em rh_empresas + tabela rh_socios
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar colunas a rh_empresas
ALTER TABLE public.rh_empresas
    ADD COLUMN IF NOT EXISTS cnpj                 TEXT,
    ADD COLUMN IF NOT EXISTS regime_enquadramento TEXT,
    ADD COLUMN IF NOT EXISTS inscricao_estadual   TEXT,
    ADD COLUMN IF NOT EXISTS inscricao_municipal  TEXT,
    ADD COLUMN IF NOT EXISTS municipio            TEXT,
    ADD COLUMN IF NOT EXISTS status_situacao      TEXT DEFAULT 'Ativo',
    ADD COLUMN IF NOT EXISTS data_cadastro        DATE,
    ADD COLUMN IF NOT EXISTS endereco             TEXT,
    ADD COLUMN IF NOT EXISTS cep                  TEXT,
    ADD COLUMN IF NOT EXISTS cidade               TEXT;


-- 2. Criar tabela rh_socios
CREATE TABLE IF NOT EXISTS public.rh_socios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    nome_socio      TEXT NOT NULL,
    cpf             TEXT,
    participacao    NUMERIC(5,2),
    cargo           TEXT,
    data_entrada    DATE,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rh_socios_empresa_socio_unique UNIQUE (codigo_empresa, nome_socio)
);

CREATE INDEX IF NOT EXISTS idx_rh_socios_empresa ON public.rh_socios (codigo_empresa);


-- 3. RLS para rh_socios
ALTER TABLE public.rh_socios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_socios: leitura autenticado" ON public.rh_socios;
DROP POLICY IF EXISTS "rh_socios: escrita autenticado" ON public.rh_socios;

CREATE POLICY "rh_socios: leitura autenticado"
    ON public.rh_socios FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_socios: escrita autenticado"
    ON public.rh_socios FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);
