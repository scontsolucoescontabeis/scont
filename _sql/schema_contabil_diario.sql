-- ============================================================
-- DIÁRIO CONTÁBIL
-- ============================================================

-- 1. Lançamentos (só-inclusão)
CREATE TABLE IF NOT EXISTS public.contabil_diario_lancamentos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    data              DATE NOT NULL,
    texto             TEXT NOT NULL,
    criado_por_nome   TEXT,
    criado_por_email  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_diario_lanc_empresa ON public.contabil_diario_lancamentos (codigo_empresa);

ALTER TABLE public.contabil_diario_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_diario_lanc: leitura autenticado" ON public.contabil_diario_lancamentos;
DROP POLICY IF EXISTS "contabil_diario_lanc: escrita autenticado" ON public.contabil_diario_lancamentos;

CREATE POLICY "contabil_diario_lanc: leitura autenticado"
    ON public.contabil_diario_lancamentos FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_diario_lanc: escrita autenticado"
    ON public.contabil_diario_lancamentos FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- 2. Status mensal (grade de fechamento)
CREATE TABLE IF NOT EXISTS public.contabil_diario_status_mensal (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    ano               INT NOT NULL,
    mes               INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    status            TEXT NOT NULL CHECK (status IN ('sem_documentacao', 'pendencias', 'concluido')),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (codigo_empresa, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_contabil_diario_status_empresa     ON public.contabil_diario_status_mensal (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_contabil_diario_status_empresa_ano ON public.contabil_diario_status_mensal (codigo_empresa, ano);

ALTER TABLE public.contabil_diario_status_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_diario_status: leitura autenticado" ON public.contabil_diario_status_mensal;
DROP POLICY IF EXISTS "contabil_diario_status: escrita autenticado" ON public.contabil_diario_status_mensal;

CREATE POLICY "contabil_diario_status: leitura autenticado"
    ON public.contabil_diario_status_mensal FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_diario_status: escrita autenticado"
    ON public.contabil_diario_status_mensal FOR ALL
    TO authenticated USING (true) WITH CHECK (true);
