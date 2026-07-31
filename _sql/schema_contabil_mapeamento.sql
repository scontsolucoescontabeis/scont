-- ============================================================
-- MAPEAMENTO ESTRATÉGICO — Departamento Contábil
-- ============================================================

-- 1. TABELA: contabil_mapeamento (1 registro por empresa)
CREATE TABLE IF NOT EXISTS public.contabil_mapeamento (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa            TEXT NOT NULL UNIQUE,
    periodicidade             TEXT,
    regime_tributario         TEXT,
    responsavel_execucao      TEXT,
    ultimo_mes_fechado        DATE,
    situacao_2025_status      TEXT,
    situacao_2025_obs         TEXT,
    situacao_2026_status      TEXT,
    situacao_2026_obs         TEXT,
    financeiro_interno_bpo    TEXT,
    forma_envio_documentos    TEXT[] NOT NULL DEFAULT '{}',
    acesso_bancario_leitura   BOOLEAN NOT NULL DEFAULT false,
    bancos_utilizados         TEXT[] NOT NULL DEFAULT '{}',
    sistemas_utilizados       TEXT[] NOT NULL DEFAULT '{}',
    contato_nome              TEXT,
    contato_telefone          TEXT,
    contato_email             TEXT,
    entregaveis_esperados     TEXT[] NOT NULL DEFAULT '{}',
    entregaveis_obs           TEXT,
    particularidades_contabeis    TEXT,
    particularidades_fiscais      TEXT,
    particularidades_societarias  TEXT,
    obrigacoes_acessorias     TEXT[] NOT NULL DEFAULT '{}',
    nivel_atencao             TEXT NOT NULL DEFAULT 'baixo',
    nivel_atencao_travado     BOOLEAN NOT NULL DEFAULT false,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_mapeamento_empresa ON public.contabil_mapeamento (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_contabil_mapeamento_nivel   ON public.contabil_mapeamento (nivel_atencao);


-- 2. TABELA: contabil_mapeamento_pendencias (N por empresa)
CREATE TABLE IF NOT EXISTS public.contabil_mapeamento_pendencias (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapeamento_id  UUID NOT NULL REFERENCES public.contabil_mapeamento (id) ON DELETE CASCADE,
    descricao      TEXT NOT NULL,
    responsavel    TEXT,
    prazo          DATE,
    status         TEXT NOT NULL DEFAULT 'aberta',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolvido_em   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contabil_pendencias_mapeamento ON public.contabil_mapeamento_pendencias (mapeamento_id);
CREATE INDEX IF NOT EXISTS idx_contabil_pendencias_status     ON public.contabil_mapeamento_pendencias (status);


-- 3. TABELA: contabil_mapeamento_relacionadas (N:N simétrico)
CREATE TABLE IF NOT EXISTS public.contabil_mapeamento_relacionadas (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa              TEXT NOT NULL,
    codigo_empresa_relacionada  TEXT NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (codigo_empresa, codigo_empresa_relacionada)
);

CREATE INDEX IF NOT EXISTS idx_contabil_relacionadas_empresa ON public.contabil_mapeamento_relacionadas (codigo_empresa);


-- 4. RLS
ALTER TABLE public.contabil_mapeamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_mapeamento: leitura autenticado" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento: escrita autenticado"  ON public.contabil_mapeamento;

CREATE POLICY "contabil_mapeamento: leitura autenticado"
    ON public.contabil_mapeamento FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_mapeamento: escrita autenticado"
    ON public.contabil_mapeamento FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.contabil_mapeamento_pendencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_pendencias: leitura autenticado" ON public.contabil_mapeamento_pendencias;
DROP POLICY IF EXISTS "contabil_pendencias: escrita autenticado"  ON public.contabil_mapeamento_pendencias;

CREATE POLICY "contabil_pendencias: leitura autenticado"
    ON public.contabil_mapeamento_pendencias FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_pendencias: escrita autenticado"
    ON public.contabil_mapeamento_pendencias FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.contabil_mapeamento_relacionadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_relacionadas: leitura autenticado" ON public.contabil_mapeamento_relacionadas;
DROP POLICY IF EXISTS "contabil_relacionadas: escrita autenticado"  ON public.contabil_mapeamento_relacionadas;

CREATE POLICY "contabil_relacionadas: leitura autenticado"
    ON public.contabil_mapeamento_relacionadas FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_relacionadas: escrita autenticado"
    ON public.contabil_mapeamento_relacionadas FOR ALL
    TO authenticated USING (true) WITH CHECK (true);


-- 5. updated_at automático em contabil_mapeamento
CREATE OR REPLACE FUNCTION public.contabil_mapeamento_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contabil_mapeamento_updated_at ON public.contabil_mapeamento;
CREATE TRIGGER trg_contabil_mapeamento_updated_at
    BEFORE UPDATE ON public.contabil_mapeamento
    FOR EACH ROW
    EXECUTE FUNCTION public.contabil_mapeamento_set_updated_at();


-- 6. Renomeia o card no portal (revisar antes de rodar em produção)
UPDATE public.ferramentas
   SET nome = 'Departamento Contábil',
       descricao = 'Onboarding e mapeamento estratégico de clientes contábeis'
 WHERE nome = 'Onboarding Contábil';
