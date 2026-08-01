-- ============================================================
-- HISTÓRICO DE ALTERAÇÕES — Diário Contábil
-- Registra alterações da grade mensal (status sem_documentacao/
-- pendencias/concluido). Lançamentos já têm usuário/data em
-- contabil_diario_lancamentos e são exibidos junto na tela de
-- Histórico sem precisar duplicar aqui.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contabil_diario_auditoria (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    campo             TEXT NOT NULL,
    valor_anterior    TEXT,
    valor_novo        TEXT,
    usuario_nome      TEXT,
    usuario_email     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_diario_auditoria_empresa    ON public.contabil_diario_auditoria (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_contabil_diario_auditoria_created_at ON public.contabil_diario_auditoria (created_at DESC);

ALTER TABLE public.contabil_diario_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_diario_auditoria: leitura autenticado" ON public.contabil_diario_auditoria;
DROP POLICY IF EXISTS "contabil_diario_auditoria: escrita autenticado" ON public.contabil_diario_auditoria;

CREATE POLICY "contabil_diario_auditoria: leitura autenticado"
    ON public.contabil_diario_auditoria FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_diario_auditoria: escrita autenticado"
    ON public.contabil_diario_auditoria FOR ALL
    TO authenticated USING (true) WITH CHECK (true);
