-- ============================================================
-- GERADOR DE MODELOS — Eventos (geração em lote de documentos)
-- Execute no SQL Editor do Supabase (projeto principal)
-- ============================================================

-- ── TABELA: gm_eventos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_eventos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    descricao   TEXT,
    criado_por  UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gm_eventos_criado_por ON public.gm_eventos (criado_por);

CREATE TRIGGER gm_eventos_set_updated_at
    BEFORE UPDATE ON public.gm_eventos
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── TABELA: gm_eventos_modelos (quais modelos entram no evento, em que ordem) ──
CREATE TABLE IF NOT EXISTS public.gm_eventos_modelos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id  UUID NOT NULL REFERENCES public.gm_eventos(id) ON DELETE CASCADE,
    modelo_id  UUID NOT NULL REFERENCES public.gm_modelos(id) ON DELETE CASCADE,
    ordem      INT NOT NULL DEFAULT 0,

    CONSTRAINT gm_eventos_modelos_unique UNIQUE (evento_id, modelo_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_eventos_modelos_evento ON public.gm_eventos_modelos (evento_id);

-- ── gm_geracoes: rastrear também gerações feitas via evento ─────
ALTER TABLE public.gm_geracoes
    ADD COLUMN IF NOT EXISTS evento_id UUID REFERENCES public.gm_eventos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gm_geracoes_evento ON public.gm_geracoes (evento_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.gm_eventos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_eventos_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_eventos_select"
    ON public.gm_eventos FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "gm_eventos_insert"
    ON public.gm_eventos FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "gm_eventos_update"
    ON public.gm_eventos FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = criado_por);

CREATE POLICY "gm_eventos_delete"
    ON public.gm_eventos FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = criado_por);

CREATE POLICY "gm_eventos_modelos_auth_all"
    ON public.gm_eventos_modelos FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);
