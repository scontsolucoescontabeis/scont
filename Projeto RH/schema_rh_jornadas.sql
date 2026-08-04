-- ============================================================
-- Migração: rh_jornadas
-- Permite cadastrar mais de uma jornada de trabalho (horas diárias +
-- exceções sexta/sábado) por empresa, além da "Jornada Padrão" que já
-- existe em rh_config_rubricas_txt (evento = 'jornada_diaria' etc.).
-- Cada empregado pode ser associado a uma dessas jornadas extras;
-- sem associação (jornada_id NULL), continua usando a Jornada Padrão
-- da empresa — comportamento idêntico ao atual.
--
-- Não confundir com rh_jornada_trabalho (horário de entrada/saída por
-- dia da semana, usada em Administração e Gerar Folhas de Ponto) —
-- conceito separado, não afetado por esta migração.
--
-- Execute no SQL Editor do Supabase (mesmo projeto do Portal SCONT)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_jornadas (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa        TEXT NOT NULL,
    nome                  TEXT NOT NULL,
    jornada_diaria        TEXT NOT NULL,           -- 'HH:MM'
    jornada_sexta_ativa   BOOLEAN NOT NULL DEFAULT FALSE,
    jornada_sexta         TEXT,                    -- 'HH:MM' ou NULL
    jornada_sabado_ativa  BOOLEAN NOT NULL DEFAULT FALSE,
    jornada_sabado        TEXT,
    sabado_sempre_extra   BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rh_jornadas_empresa_nome_unique UNIQUE (codigo_empresa, nome)
);

CREATE INDEX IF NOT EXISTS idx_rh_jornadas_empresa
    ON public.rh_jornadas (codigo_empresa);

ALTER TABLE public.rh_jornadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_jornadas: leitura autenticado"
    ON public.rh_jornadas FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_jornadas: escrita autenticado"
    ON public.rh_jornadas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- rh_empregados.jornada_id
-- NULL = empregado usa a Jornada Padrão da empresa.
-- Excluir uma jornada cadastrada volta automaticamente os empregados
-- associados a ela para o padrão (ON DELETE SET NULL).
-- ============================================================

ALTER TABLE public.rh_empregados
    ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES public.rh_jornadas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rh_empregados_jornada
    ON public.rh_empregados (jornada_id);
