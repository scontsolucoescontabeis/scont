-- ============================================================
-- Migração: rh_jornada_trabalho
-- Jornada de trabalho (dia da semana / entrada / intervalo / saída)
-- por empregado, importada do PDF "Horário de Trabalho" (todas as
-- empresas) em Administração > Importar Dados (admin.html).
--
-- Cada importação substitui todo o conteúdo anterior (a tabela
-- reflete o snapshot atual da jornada de todos os empregados — não
-- é histórico). Uma linha por empregado x dia da semana em que
-- trabalha; dias em que o empregado tem folga/compensação, ou que
-- simplesmente não aparecem no PDF para aquele empregado, não geram
-- linha nesta tabela.
--
-- Execute no SQL Editor do Supabase (mesmo projeto do Portal SCONT)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_jornada_trabalho (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    nome_empresa      TEXT,
    codigo_empregado  TEXT NOT NULL,
    nome_empregado    TEXT NOT NULL,
    dia_semana        TEXT NOT NULL, -- 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo'
    entrada           TEXT NOT NULL, -- 'HH:MM'
    intervalo_inicio  TEXT,          -- 'HH:MM' ou NULL (sem intervalo registrado)
    intervalo_fim     TEXT,
    saida             TEXT NOT NULL, -- 'HH:MM'
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rh_jornada_trabalho_uniq UNIQUE (codigo_empresa, codigo_empregado, dia_semana)
);

CREATE INDEX IF NOT EXISTS idx_rh_jornada_trabalho_empresa_empregado
    ON public.rh_jornada_trabalho (codigo_empresa, codigo_empregado);

ALTER TABLE public.rh_jornada_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_jornada_trabalho: leitura autenticado"
    ON public.rh_jornada_trabalho FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_jornada_trabalho: escrita autenticado"
    ON public.rh_jornada_trabalho FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
