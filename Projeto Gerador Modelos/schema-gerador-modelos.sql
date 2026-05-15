-- ============================================================
-- GERADOR DE MODELOS — Schema e RLS
-- Após executar, registre a ferramenta no portal:
--   INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
--   VALUES ('Gerador de Modelos', 'Gere contratos, recibos e documentos com variáveis', '📄',
--           'Projeto Gerador Modelos/index.html', true, 10);
-- ============================================================
-- Execute no SQL Editor do Supabase (projeto principal)
-- ============================================================

-- ── TABELA: gm_modelos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_modelos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL,
    descricao       TEXT,
    tipo            TEXT NOT NULL DEFAULT 'por_registro'
                        CHECK (tipo IN ('por_registro', 'consolidado')),
    template        TEXT NOT NULL DEFAULT '',
    cabecalho_padrao TEXT NOT NULL DEFAULT 'completo'
                        CHECK (cabecalho_padrao IN ('completo', 'neutro', 'nenhum')),
    fontes          TEXT[] NOT NULL DEFAULT '{}',   -- ['empresas','empregados','socios','rubricas']
    criado_por      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gm_modelos_criado_por ON public.gm_modelos (criado_por);

-- ── TABELA: gm_geracoes ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_geracoes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modelo_id        UUID NOT NULL REFERENCES public.gm_modelos(id) ON DELETE CASCADE,
    modelo_nome      TEXT NOT NULL,                  -- snapshot do nome
    empresas_ids     TEXT[] NOT NULL DEFAULT '{}',   -- array de codigo_empresa
    total_registros  INT NOT NULL DEFAULT 0,
    cabecalho_usado  TEXT NOT NULL DEFAULT 'completo',
    criado_por       UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gm_geracoes_modelo    ON public.gm_geracoes (modelo_id);
CREATE INDEX IF NOT EXISTS idx_gm_geracoes_criado_por ON public.gm_geracoes (criado_por);

-- ── TRIGGER: updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER gm_modelos_set_updated_at
    BEFORE UPDATE ON public.gm_modelos
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.gm_modelos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_geracoes  ENABLE ROW LEVEL SECURITY;

-- Modelos: leitura para todos autenticados; escrita pelo criador ou admin
CREATE POLICY "gm_modelos_select"
    ON public.gm_modelos FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "gm_modelos_insert"
    ON public.gm_modelos FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "gm_modelos_update"
    ON public.gm_modelos FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = criado_por);

CREATE POLICY "gm_modelos_delete"
    ON public.gm_modelos FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = criado_por);

-- Gerações: todos autenticados
CREATE POLICY "gm_geracoes_auth_all"
    ON public.gm_geracoes FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);
