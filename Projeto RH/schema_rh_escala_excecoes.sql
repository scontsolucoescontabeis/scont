-- ============================================================
-- Migração: rh_escala_excecoes
-- Folga pontual (exceção do dia) por empregado, marcada na tela
-- "Gerar Escala" (Projeto RH/index.html + script.js) clicando num dia
-- do mini-calendário. Independente de rh_escala_trabalho — a escala
-- do empregado NÃO é alterada; a exceção só sobrepõe o resultado do
-- cálculo (calcularResumoMes) para aquele dia específico, marcando-o
-- como folga mesmo que a escala configurada diga "trabalho".
--
-- Uma linha por dia marcado. Consumida por Gerar Escala e por Gerar
-- Benefícios (cálculo de "Dias a Trabalhar"), mesmo critério já usado
-- para férias (rh_ferias_calculadas): férias tem prioridade sobre a
-- exceção, que tem prioridade sobre a escala.
--
-- Execute no SQL Editor do Supabase (mesmo projeto do Portal SCONT)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_escala_excecoes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    codigo_empregado  TEXT NOT NULL,
    data              DATE NOT NULL,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rh_escala_excecoes_uniq UNIQUE (codigo_empresa, codigo_empregado, data)
);

CREATE INDEX IF NOT EXISTS idx_rh_escala_excecoes_empresa_empregado
    ON public.rh_escala_excecoes (codigo_empresa, codigo_empregado);

ALTER TABLE public.rh_escala_excecoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_escala_excecoes: leitura autenticado" ON public.rh_escala_excecoes;
DROP POLICY IF EXISTS "rh_escala_excecoes: escrita autenticado" ON public.rh_escala_excecoes;

CREATE POLICY "rh_escala_excecoes: leitura autenticado"
    ON public.rh_escala_excecoes FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_escala_excecoes: escrita autenticado"
    ON public.rh_escala_excecoes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
