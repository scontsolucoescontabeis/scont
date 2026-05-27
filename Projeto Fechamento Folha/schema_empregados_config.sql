-- Tabela exclusiva da ferramenta Fechamento de Folha
-- Associa nome da planilha a código do empregado, por empresa
-- Funciona como override em relação a rh_empregados: consultada primeiro no buscarCodigoEmpregado
CREATE TABLE IF NOT EXISTS public.fechamento_empregados_config (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa   TEXT NOT NULL,
    nome_planilha    TEXT NOT NULL,
    codigo_empregado TEXT NOT NULL,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fechamento_emp_config_unique UNIQUE (codigo_empresa, nome_planilha)
);

CREATE INDEX IF NOT EXISTS idx_fech_emp_config_empresa
    ON public.fechamento_empregados_config (codigo_empresa);

ALTER TABLE public.fechamento_empregados_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_emp_config: leitura" ON public.fechamento_empregados_config;
DROP POLICY IF EXISTS "fechamento_emp_config: escrita"  ON public.fechamento_empregados_config;

CREATE POLICY "fechamento_emp_config: leitura"
    ON public.fechamento_empregados_config FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_emp_config: escrita"
    ON public.fechamento_empregados_config FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
