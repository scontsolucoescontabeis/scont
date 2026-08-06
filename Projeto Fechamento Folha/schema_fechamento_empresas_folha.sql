-- ============================================================
-- SCONT – CONTROLE DE FECHAMENTO DA FOLHA
-- Empresas com Folha de Pagamento (tela de Configurações)
-- Execute no SQL Editor do Supabase (projeto Portal)
-- ============================================================

-- ============================================================
-- Indica, por empresa, se ela tem folha de pagamento fechada
-- pela Scont. Padrão (linha ausente) = NÃO — a tela "Fluxo por
-- Empresa" só lista empresas marcadas explicitamente com SIM.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fechamento_empresas_config (
    codigo_empresa  TEXT PRIMARY KEY,
    possui_folha    BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fechamento_empresas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_empresas_config: leitura autenticado" ON public.fechamento_empresas_config;
DROP POLICY IF EXISTS "fechamento_empresas_config: escrita autenticado"  ON public.fechamento_empresas_config;

CREATE POLICY "fechamento_empresas_config: leitura autenticado"
    ON public.fechamento_empresas_config FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_empresas_config: escrita autenticado"
    ON public.fechamento_empresas_config FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- Responsável(is) pelo fechamento por empresa (N:N — uma
-- empresa pode ter 0, 1 ou vários responsáveis atribuídos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fechamento_empresas_responsaveis (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    usuario_id      UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fechamento_empresas_responsaveis_unique UNIQUE (codigo_empresa, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_fechamento_empresas_resp_empresa ON public.fechamento_empresas_responsaveis (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_fechamento_empresas_resp_usuario ON public.fechamento_empresas_responsaveis (usuario_id);

ALTER TABLE public.fechamento_empresas_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_empresas_responsaveis: leitura autenticado" ON public.fechamento_empresas_responsaveis;
DROP POLICY IF EXISTS "fechamento_empresas_responsaveis: escrita autenticado"  ON public.fechamento_empresas_responsaveis;

CREATE POLICY "fechamento_empresas_responsaveis: leitura autenticado"
    ON public.fechamento_empresas_responsaveis FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_empresas_responsaveis: escrita autenticado"
    ON public.fechamento_empresas_responsaveis FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
