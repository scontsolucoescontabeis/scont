-- ============================================================
-- SCONT – FICHA 360 DO CLIENTE
-- Execute no SQL Editor do Supabase (projeto do Portal)
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

-- 1. Dados Scont da empresa (o que o Domínio não tem)
CREATE TABLE IF NOT EXISTS public.ficha360_empresa (
    codigo_empresa       TEXT PRIMARY KEY REFERENCES public.rh_empresas (codigo_empresa) ON DELETE CASCADE,
    status_carteira      TEXT NOT NULL DEFAULT 'ativo'
                         CHECK (status_carteira IN ('ativo', 'em_implantacao', 'em_saida', 'inativo')),
    data_inicio_cliente  DATE,
    data_saida_cliente   DATE,
    atende_fiscal        BOOLEAN NOT NULL DEFAULT FALSE,
    atende_societario    BOOLEAN NOT NULL DEFAULT FALSE,
    atende_bpo           BOOLEAN NOT NULL DEFAULT FALSE,
    porte                TEXT,
    atividade_principal  TEXT,
    observacao_geral     TEXT,
    atualizado_por       TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.ficha360_empresa_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ficha360_empresa_updated_at ON public.ficha360_empresa;
CREATE TRIGGER trg_ficha360_empresa_updated_at
    BEFORE UPDATE ON public.ficha360_empresa
    FOR EACH ROW EXECUTE FUNCTION public.ficha360_empresa_set_updated_at();

-- 2. Contatos do cliente
CREATE TABLE IF NOT EXISTS public.ficha360_contatos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL REFERENCES public.rh_empresas (codigo_empresa) ON DELETE CASCADE,
    nome            TEXT NOT NULL,
    funcao          TEXT,
    area            TEXT NOT NULL DEFAULT 'geral'
                    CHECK (area IN ('geral', 'dp', 'contabil', 'fiscal', 'financeiro')),
    telefone        TEXT,
    email           TEXT,
    whatsapp        TEXT,
    principal       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ficha360_contatos_empresa ON public.ficha360_contatos (codigo_empresa);

-- 3. Anotações internas
CREATE TABLE IF NOT EXISTS public.ficha360_anotacoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL REFERENCES public.rh_empresas (codigo_empresa) ON DELETE CASCADE,
    texto           TEXT NOT NULL,
    categoria       TEXT NOT NULL DEFAULT 'geral'
                    CHECK (categoria IN ('geral', 'dp', 'contabil', 'financeiro', 'combinado')),
    fixada          BOOLEAN NOT NULL DEFAULT FALSE,
    autor_id        UUID NOT NULL DEFAULT auth.uid(),
    autor_nome      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    editado_em      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ficha360_anotacoes_empresa ON public.ficha360_anotacoes (codigo_empresa, created_at DESC);

-- 4. RLS
ALTER TABLE public.ficha360_empresa   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha360_contatos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha360_anotacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ficha360_empresa_all ON public.ficha360_empresa;
CREATE POLICY ficha360_empresa_all ON public.ficha360_empresa
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS ficha360_contatos_all ON public.ficha360_contatos;
CREATE POLICY ficha360_contatos_all ON public.ficha360_contatos
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS ficha360_anotacoes_select ON public.ficha360_anotacoes;
CREATE POLICY ficha360_anotacoes_select ON public.ficha360_anotacoes
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS ficha360_anotacoes_insert ON public.ficha360_anotacoes;
CREATE POLICY ficha360_anotacoes_insert ON public.ficha360_anotacoes
    FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid());

DROP POLICY IF EXISTS ficha360_anotacoes_update ON public.ficha360_anotacoes;
CREATE POLICY ficha360_anotacoes_update ON public.ficha360_anotacoes
    FOR UPDATE TO authenticated
    USING (autor_id = auth.uid() OR public.is_admin())
    WITH CHECK (autor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS ficha360_anotacoes_delete ON public.ficha360_anotacoes;
CREATE POLICY ficha360_anotacoes_delete ON public.ficha360_anotacoes
    FOR DELETE TO authenticated USING (autor_id = auth.uid() OR public.is_admin());

-- 5. Registro no portal (conceder acesso pela tela de admin, como nas demais)
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
SELECT 'Ficha 360 do Cliente',
       'Visão única de cada empresa: cadastro, vencimentos, DP, contábil, anotações e semáforo da carteira',
       '🧾', './Projeto Ficha 360/index.html', TRUE, 5
WHERE NOT EXISTS (
    SELECT 1 FROM public.ferramentas WHERE url_base = './Projeto Ficha 360/index.html'
);
