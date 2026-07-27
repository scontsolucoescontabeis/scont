-- ============================================================
-- SCONT – FECHAMENTO FOLHA DE PAGAMENTO
-- Histórico/agendamento de valores da Cota (rubricas tipo Booleano,
-- ex.: Cota Custeio Sindicato) por competência de vigência.
-- Execute no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fechamento_rubricas_cota_historico (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubrica_config_id     UUID NOT NULL REFERENCES public.fechamento_rubricas_config(id) ON DELETE CASCADE,
    valor_cota            NUMERIC(10,2) NOT NULL,
    competencia_vigencia  TEXT NOT NULL, -- 'MM/AAAA': a partir de quando esse valor passa a valer
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fechamento_rubricas_cota_historico_unique UNIQUE (rubrica_config_id, competencia_vigencia)
);

CREATE INDEX IF NOT EXISTS idx_rubricas_cota_historico_config
    ON public.fechamento_rubricas_cota_historico (rubrica_config_id);

-- RLS
ALTER TABLE public.fechamento_rubricas_cota_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rubricas_cota_historico: leitura autenticado" ON public.fechamento_rubricas_cota_historico;
DROP POLICY IF EXISTS "rubricas_cota_historico: escrita autenticado"  ON public.fechamento_rubricas_cota_historico;

CREATE POLICY "rubricas_cota_historico: leitura autenticado"
    ON public.fechamento_rubricas_cota_historico FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "rubricas_cota_historico: escrita autenticado"
    ON public.fechamento_rubricas_cota_historico FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- Resolução do valor vigente numa competência (referência, já
-- implementada em JS no quadrante.js): entre os registros desta
-- tabela com competencia_vigencia <= competência da folha, usa o
-- de vigência mais recente; se nenhum existir ainda, usa o
-- fechamento_rubricas_config.valor_cota (valor-base, anterior a
-- qualquer agendamento).
-- ============================================================
