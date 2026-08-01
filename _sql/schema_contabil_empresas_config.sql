-- ============================================================
-- CONFIGURAÇÕES — Departamento Contábil
-- Empresas que possuem contábil (consideradas nos filtros e
-- buscas do Onboarding e do Diário Contábil)
-- ============================================================

-- 1. TABELA: contabil_empresas_config (1 registro por empresa)
--    Ausência de linha para uma empresa = possui_contabil true
--    (comportamento padrão: todas as empresas ativas entram nos filtros
--    até serem desmarcadas manualmente na tela de Configurações)
CREATE TABLE IF NOT EXISTS public.contabil_empresas_config (
    codigo_empresa   TEXT PRIMARY KEY,
    possui_contabil  BOOLEAN NOT NULL DEFAULT true,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2. RLS
ALTER TABLE public.contabil_empresas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_empresas_config: leitura autenticado" ON public.contabil_empresas_config;
DROP POLICY IF EXISTS "contabil_empresas_config: escrita autenticado"  ON public.contabil_empresas_config;

CREATE POLICY "contabil_empresas_config: leitura autenticado"
    ON public.contabil_empresas_config FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_empresas_config: escrita autenticado"
    ON public.contabil_empresas_config FOR ALL
    TO authenticated USING (true) WITH CHECK (true);


-- 3. updated_at automático
CREATE OR REPLACE FUNCTION public.contabil_empresas_config_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contabil_empresas_config_updated_at ON public.contabil_empresas_config;
CREATE TRIGGER trg_contabil_empresas_config_updated_at
    BEFORE UPDATE ON public.contabil_empresas_config
    FOR EACH ROW
    EXECUTE FUNCTION public.contabil_empresas_config_set_updated_at();
