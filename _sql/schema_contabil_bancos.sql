-- ============================================================
-- BANCOS UTILIZADOS -> tabela de acessos bancários por empresa
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contabil_mapeamento_bancos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapeamento_id     UUID NOT NULL REFERENCES public.contabil_mapeamento (id) ON DELETE CASCADE,
    banco             TEXT NOT NULL,
    agencia           TEXT,
    conta_corrente    TEXT,
    operador_login    TEXT,
    senha             TEXT,
    observacoes       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_bancos_mapeamento ON public.contabil_mapeamento_bancos (mapeamento_id);

ALTER TABLE public.contabil_mapeamento_bancos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_bancos: leitura autenticado" ON public.contabil_mapeamento_bancos;
DROP POLICY IF EXISTS "contabil_bancos: escrita autenticado"  ON public.contabil_mapeamento_bancos;

CREATE POLICY "contabil_bancos: leitura autenticado"
    ON public.contabil_mapeamento_bancos FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_bancos: escrita autenticado"
    ON public.contabil_mapeamento_bancos FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- Migra os dados existentes de bancos_utilizados (text[]) para a tabela nova,
-- um registro por banco, antes de remover a coluna antiga.
INSERT INTO public.contabil_mapeamento_bancos (mapeamento_id, banco)
SELECT m.id, banco
FROM public.contabil_mapeamento m,
     UNNEST(m.bancos_utilizados) AS banco
WHERE m.bancos_utilizados IS NOT NULL AND array_length(m.bancos_utilizados, 1) > 0;

ALTER TABLE public.contabil_mapeamento DROP COLUMN IF EXISTS bancos_utilizados;
