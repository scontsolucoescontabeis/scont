-- Tabela exclusiva da ferramenta Fechamento de Folha
-- Associa descrição de rubrica a código, por empresa
CREATE TABLE IF NOT EXISTS public.fechamento_rubrica_associacoes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa   TEXT NOT NULL,
    descricao_rubrica TEXT NOT NULL,
    codigo_rubrica   TEXT NOT NULL,
    data_criacao     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fechamento_rubrica_assoc_unique UNIQUE (codigo_empresa, descricao_rubrica)
);

CREATE INDEX IF NOT EXISTS idx_fech_assoc_empresa
    ON public.fechamento_rubrica_associacoes (codigo_empresa);

ALTER TABLE public.fechamento_rubrica_associacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_assoc: leitura" ON public.fechamento_rubrica_associacoes;
DROP POLICY IF EXISTS "fechamento_assoc: escrita"  ON public.fechamento_rubrica_associacoes;

CREATE POLICY "fechamento_assoc: leitura"
    ON public.fechamento_rubrica_associacoes FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_assoc: escrita"
    ON public.fechamento_rubrica_associacoes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
