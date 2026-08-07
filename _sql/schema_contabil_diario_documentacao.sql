-- ============================================================
-- DOCUMENTAÇÃO DISPONÍVEL — Diário Contábil
-- Sinaliza (célula "Não Iniciado" da grade mensal) que a
-- documentação do cliente já chegou e o Prestador pode começar a
-- lançar aquele mês. Independente de contabil_diario_status_mensal
-- (que só tem linha quando o mês sai de "Não Iniciado").
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contabil_diario_documentacao (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    ano               INT NOT NULL,
    mes               INT NOT NULL,
    disponivel        BOOLEAN NOT NULL DEFAULT false,
    marcado_por_nome  TEXT,
    marcado_por_email TEXT,
    marcado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (codigo_empresa, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_contabil_diario_documentacao_empresa ON public.contabil_diario_documentacao (codigo_empresa);

ALTER TABLE public.contabil_diario_documentacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_diario_documentacao: leitura autenticado" ON public.contabil_diario_documentacao;
DROP POLICY IF EXISTS "contabil_diario_documentacao: escrita autenticado" ON public.contabil_diario_documentacao;

CREATE POLICY "contabil_diario_documentacao: leitura autenticado"
    ON public.contabil_diario_documentacao FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_diario_documentacao: escrita autenticado"
    ON public.contabil_diario_documentacao FOR ALL
    TO authenticated USING (true) WITH CHECK (true);
