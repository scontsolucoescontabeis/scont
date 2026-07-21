-- ============================================================
-- SCONT — ONBOARDING CONTÁBIL (Balanço Inicial)
-- Execute no SQL Editor do Supabase (projeto principal)
-- ============================================================


-- ============================================================
-- 1. TABELA: contabil_onboardings
--    Um registro por empresa em processo de onboarding contábil
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contabil_onboardings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa              TEXT NOT NULL REFERENCES public.rh_empresas (codigo_empresa),
    razao_social                TEXT NOT NULL,
    cnpj                        TEXT,
    data_corte                  DATE,
    regime_tributario           TEXT NOT NULL CHECK (regime_tributario IN ('simples_nacional', 'lucro_presumido', 'lucro_real')),
    responsavel_scont           TEXT,
    data_inicio                 DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Respostas-gatilho (Anexo I do formulário de onboarding)
    tem_contabilidade_anterior  BOOLEAN NOT NULL DEFAULT FALSE,
    tem_empregados              BOOLEAN NOT NULL DEFAULT FALSE,
    tem_estoque                 BOOLEAN NOT NULL DEFAULT FALSE,
    contribuinte_icms           BOOLEAN NOT NULL DEFAULT FALSE,
    prestador_servicos          BOOLEAN NOT NULL DEFAULT FALSE,
    tem_emprestimos             BOOLEAN NOT NULL DEFAULT FALSE,

    status                      TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido')),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_onboardings_empresa ON public.contabil_onboardings (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_contabil_onboardings_status  ON public.contabil_onboardings (status);


-- ============================================================
-- 2. TABELA: contabil_onboarding_itens
--    Itens do checklist gerados por onboarding (documentos + validações)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contabil_onboarding_itens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onboarding_id       UUID NOT NULL REFERENCES public.contabil_onboardings (id) ON DELETE CASCADE,

    secao               TEXT NOT NULL,          -- 'A','B','C1','C2','D','E1','E2','E3','F','G','H'
    item_codigo         TEXT NOT NULL,          -- chave do catálogo (data/catalogo.js), ex: 'C1-8'
    item_texto          TEXT NOT NULL,
    exigencia           TEXT NOT NULL CHECK (exigencia IN ('obrigatorio', 'condicional')),
    observacao_catalogo TEXT,                   -- texto de ajuda do catálogo (somente leitura)

    status              TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'aprovado', 'rejeitado', 'nao_aplicavel')),
    arquivo_url         TEXT,
    arquivo_nome        TEXT,
    observacao          TEXT,                  -- nota da equipe SCONT
    atualizado_por      TEXT,
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT contabil_itens_onboarding_codigo_unique UNIQUE (onboarding_id, item_codigo)
);

CREATE INDEX IF NOT EXISTS idx_contabil_itens_onboarding ON public.contabil_onboarding_itens (onboarding_id);
CREATE INDEX IF NOT EXISTS idx_contabil_itens_secao      ON public.contabil_onboarding_itens (secao);
CREATE INDEX IF NOT EXISTS idx_contabil_itens_status     ON public.contabil_onboarding_itens (status);


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.contabil_onboardings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_onboardings: leitura autenticado" ON public.contabil_onboardings;
DROP POLICY IF EXISTS "contabil_onboardings: escrita autenticado"  ON public.contabil_onboardings;

CREATE POLICY "contabil_onboardings: leitura autenticado"
    ON public.contabil_onboardings FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "contabil_onboardings: escrita autenticado"
    ON public.contabil_onboardings FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


ALTER TABLE public.contabil_onboarding_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_itens: leitura autenticado" ON public.contabil_onboarding_itens;
DROP POLICY IF EXISTS "contabil_itens: escrita autenticado"  ON public.contabil_onboarding_itens;

CREATE POLICY "contabil_itens: leitura autenticado"
    ON public.contabil_onboarding_itens FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "contabil_itens: escrita autenticado"
    ON public.contabil_onboarding_itens FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- ============================================================
-- 4. updated_at automático em contabil_onboardings
-- ============================================================
CREATE OR REPLACE FUNCTION public.contabil_onboardings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contabil_onboardings_updated_at ON public.contabil_onboardings;
CREATE TRIGGER trg_contabil_onboardings_updated_at
    BEFORE UPDATE ON public.contabil_onboardings
    FOR EACH ROW
    EXECUTE FUNCTION public.contabil_onboardings_set_updated_at();
