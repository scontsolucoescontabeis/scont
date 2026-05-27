-- Rubricas marcadas para ignorar no processamento (por empresa)
-- Mesmo que a rubrica esteja em rh_rubricas, linhas com essas colunas são excluídas do TXT
CREATE TABLE IF NOT EXISTS public.fechamento_rubricas_ignoradas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    coluna_planilha TEXT NOT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fechamento_rubricas_ign_unique UNIQUE (codigo_empresa, coluna_planilha)
);

CREATE INDEX IF NOT EXISTS idx_fech_rubricas_ign_empresa
    ON public.fechamento_rubricas_ignoradas (codigo_empresa);

ALTER TABLE public.fechamento_rubricas_ignoradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_rubricas_ign: leitura" ON public.fechamento_rubricas_ignoradas;
DROP POLICY IF EXISTS "fechamento_rubricas_ign: escrita"  ON public.fechamento_rubricas_ignoradas;

CREATE POLICY "fechamento_rubricas_ign: leitura"
    ON public.fechamento_rubricas_ignoradas FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_rubricas_ign: escrita"
    ON public.fechamento_rubricas_ignoradas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
