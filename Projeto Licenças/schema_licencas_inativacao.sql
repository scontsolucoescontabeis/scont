-- ============================================================================
-- Controle de Licenças — inativação de licenças/alvarás com justificativa
--
-- Inativar ≠ excluir: o registro permanece na lista com status "Inativa", sai
-- dos KPIs/alertas e a justificativa fica registrada no histórico da ferramenta
-- (tabela licencas_historico, append-only).
-- Idempotente.
-- ============================================================================

-- 1. Colunas de inativação
ALTER TABLE public.licencas
    ADD COLUMN IF NOT EXISTS inativa            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS inativada_em       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS inativada_por      TEXT,
    ADD COLUMN IF NOT EXISTS motivo_inativacao  TEXT;

ALTER TABLE public.alvaras
    ADD COLUMN IF NOT EXISTS inativa            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS inativada_em       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS inativada_por      TEXT,
    ADD COLUMN IF NOT EXISTS motivo_inativacao  TEXT;

-- 2. Histórico (append-only: só SELECT; escrita apenas pela função abaixo)
CREATE TABLE IF NOT EXISTS public.licencas_historico (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela_origem   TEXT        NOT NULL CHECK (tabela_origem IN ('licencas','alvaras')),
    registro_id     UUID        NOT NULL,
    empresa_id      UUID,
    estabelecimento TEXT,
    tipo            TEXT,
    numero          TEXT,
    acao            TEXT        NOT NULL DEFAULT 'inativacao',
    justificativa   TEXT        NOT NULL,
    usuario         TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licencas_historico_registro ON public.licencas_historico (registro_id);
CREATE INDEX IF NOT EXISTS idx_licencas_historico_criado   ON public.licencas_historico (criado_em DESC);

ALTER TABLE public.licencas_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licencas_historico_select" ON public.licencas_historico;
CREATE POLICY "licencas_historico_select" ON public.licencas_historico
    FOR SELECT TO authenticated USING (TRUE);

-- 3. Função de inativação (atômica: marca o registro + grava o histórico)
CREATE OR REPLACE FUNCTION public.fn_inativar_licenca(
    p_tabela        TEXT,
    p_id            UUID,
    p_justificativa TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_usuario TEXT := COALESCE(auth.email(), 'sistema');
    v_reg     RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: autenticação necessária';
    END IF;
    IF p_tabela NOT IN ('licencas','alvaras') THEN
        RAISE EXCEPTION 'Tabela inválida';
    END IF;
    IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 10 THEN
        RAISE EXCEPTION 'Justificativa obrigatória (mínimo de 10 caracteres)';
    END IF;

    EXECUTE format(
        'UPDATE public.%I
            SET inativa = TRUE, inativada_em = NOW(), inativada_por = %L, motivo_inativacao = %L
          WHERE id = %L AND ativo = TRUE AND deletado_em IS NULL AND inativa = FALSE
      RETURNING empresa_id, estabelecimento, tipo, numero',
        p_tabela, v_usuario, trim(p_justificativa), p_id
    ) INTO v_reg;

    IF v_reg IS NULL THEN
        RAISE EXCEPTION 'Registro não encontrado ou já inativo';
    END IF;

    INSERT INTO public.licencas_historico
        (tabela_origem, registro_id, empresa_id, estabelecimento, tipo, numero, acao, justificativa, usuario)
    VALUES
        (p_tabela, p_id, v_reg.empresa_id, v_reg.estabelecimento, v_reg.tipo, v_reg.numero,
         'inativacao', trim(p_justificativa), v_usuario);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_inativar_licenca(TEXT, UUID, TEXT) TO authenticated;

-- 4. Realtime para o histórico
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'licencas_historico'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.licencas_historico;
  END IF;
END $$;
