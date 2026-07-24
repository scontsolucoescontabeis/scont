-- ============================================================
-- SCONT – CONTROLE DE FECHAMENTO DA FOLHA
-- Tabelas do módulo de controle de processo (dashboard + configuração)
-- Execute no SQL Editor do Supabase (projeto Portal)
-- ============================================================

-- Catálogo global de fases sugeridas (apoio de UI na tela de Configuração)
CREATE TABLE IF NOT EXISTS public.fechamento_fases_catalogo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL UNIQUE,
    ordem_padrao    INT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fechamento_fases_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_fases_catalogo: leitura autenticado" ON public.fechamento_fases_catalogo;
DROP POLICY IF EXISTS "fechamento_fases_catalogo: escrita autenticado"  ON public.fechamento_fases_catalogo;

CREATE POLICY "fechamento_fases_catalogo: leitura autenticado"
    ON public.fechamento_fases_catalogo FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_fases_catalogo: escrita autenticado"
    ON public.fechamento_fases_catalogo FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

INSERT INTO public.fechamento_fases_catalogo (nome, ordem_padrao) VALUES
    ('Apuração da Frequência',              1),
    ('Lançamento na Domínio',               2),
    ('Geração da Prévia',                   3),
    ('Validação Cliente',                   4),
    ('Fechamento eSocial e Relatórios',     5),
    ('Guia FGTS',                           6),
    ('Guia Previdenciária',                 7),
    ('Onvio - Gestta',                      8),
    ('Servidor',                            9),
    ('Geração dos Benefícios - VA e VT',   10)
ON CONFLICT (nome) DO NOTHING;


-- ============================================================
-- Fluxo de fases configurado por empresa (tela de Configuração)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fechamento_config_empresa_fase (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    nome_fase       TEXT NOT NULL,
    ordem           INT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fechamento_config_empresa
    ON public.fechamento_config_empresa_fase (codigo_empresa);

ALTER TABLE public.fechamento_config_empresa_fase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_config_empresa_fase: leitura autenticado" ON public.fechamento_config_empresa_fase;
DROP POLICY IF EXISTS "fechamento_config_empresa_fase: escrita autenticado"  ON public.fechamento_config_empresa_fase;

CREATE POLICY "fechamento_config_empresa_fase: leitura autenticado"
    ON public.fechamento_config_empresa_fase FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_config_empresa_fase: escrita autenticado"
    ON public.fechamento_config_empresa_fase FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- Ciclo de fechamento: 1 linha por empresa x competência
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fechamento_ciclo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    competencia     TEXT NOT NULL, -- formato 'MM/AAAA'
    responsavel_id  UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    iniciado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    concluido_em    TIMESTAMPTZ,

    CONSTRAINT fechamento_ciclo_unique UNIQUE (codigo_empresa, competencia)
);

CREATE INDEX IF NOT EXISTS idx_fechamento_ciclo_empresa
    ON public.fechamento_ciclo (codigo_empresa);

ALTER TABLE public.fechamento_ciclo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_ciclo: leitura autenticado" ON public.fechamento_ciclo;
DROP POLICY IF EXISTS "fechamento_ciclo: escrita autenticado"  ON public.fechamento_ciclo;

CREATE POLICY "fechamento_ciclo: leitura autenticado"
    ON public.fechamento_ciclo FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_ciclo: escrita autenticado"
    ON public.fechamento_ciclo FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- Fases do ciclo (instância mensal, geradas a partir da config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fechamento_ciclo_fase (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ciclo_id        UUID NOT NULL REFERENCES public.fechamento_ciclo(id) ON DELETE CASCADE,
    nome_fase       TEXT NOT NULL,
    ordem           INT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'andamento', 'concluida')),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fechamento_ciclo_fase_ciclo
    ON public.fechamento_ciclo_fase (ciclo_id);

ALTER TABLE public.fechamento_ciclo_fase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_ciclo_fase: leitura autenticado" ON public.fechamento_ciclo_fase;
DROP POLICY IF EXISTS "fechamento_ciclo_fase: escrita autenticado"  ON public.fechamento_ciclo_fase;

CREATE POLICY "fechamento_ciclo_fase: leitura autenticado"
    ON public.fechamento_ciclo_fase FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_ciclo_fase: escrita autenticado"
    ON public.fechamento_ciclo_fase FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
