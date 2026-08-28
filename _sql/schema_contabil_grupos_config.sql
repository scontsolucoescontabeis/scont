-- ============================================================
-- CONFIGURAÇÕES — Departamento Contábil
-- Quais Grupos de Empresas (tabela compartilhada rh_grupos_empresas,
-- usada também no Controle de Frequência do RH) são utilizados como
-- filtro nas ferramentas do Departamento Contábil.
-- ============================================================

-- 1. TABELA: contabil_grupos_config (1 registro por grupo)
--    Ausência de linha para um grupo = usar_contabil FALSE
--    (opt-in: o grupo só entra nos filtros do módulo contábil depois
--    de ser marcado manualmente na tela de Configurações).
CREATE TABLE IF NOT EXISTS public.contabil_grupos_config (
    grupo_id      UUID PRIMARY KEY REFERENCES public.rh_grupos_empresas(id) ON DELETE CASCADE,
    usar_contabil BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2. RLS
ALTER TABLE public.contabil_grupos_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_grupos_config: leitura autenticado" ON public.contabil_grupos_config;
DROP POLICY IF EXISTS "contabil_grupos_config: escrita autenticado"  ON public.contabil_grupos_config;

CREATE POLICY "contabil_grupos_config: leitura autenticado"
    ON public.contabil_grupos_config FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_grupos_config: escrita autenticado"
    ON public.contabil_grupos_config FOR ALL
    TO authenticated USING (true) WITH CHECK (true);


-- 3. updated_at automático
CREATE OR REPLACE FUNCTION public.contabil_grupos_config_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contabil_grupos_config_updated_at ON public.contabil_grupos_config;
CREATE TRIGGER trg_contabil_grupos_config_updated_at
    BEFORE UPDATE ON public.contabil_grupos_config
    FOR EACH ROW
    EXECUTE FUNCTION public.contabil_grupos_config_set_updated_at();
