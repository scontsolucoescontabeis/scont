-- Migração: calendário de feriados global (rh_feriados)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.rh_feriados (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data        TEXT NOT NULL,       -- "DD/MM" (recorrente todo ano) ou "DD/MM/AAAA" (específico)
    descricao   TEXT NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rh_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_feriados: leitura autenticado" ON public.rh_feriados;
DROP POLICY IF EXISTS "rh_feriados: escrita autenticado" ON public.rh_feriados;

CREATE POLICY "rh_feriados: leitura autenticado"
    ON public.rh_feriados FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "rh_feriados: escrita autenticado"
    ON public.rh_feriados FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Seed: feriados fixos já usados hoje pela ferramenta (evita perda ao migrar)
INSERT INTO public.rh_feriados (data, descricao)
SELECT v.data, v.descricao FROM (VALUES
    ('01/01', 'Confraternização Universal'),
    ('21/04', 'Tiradentes'),
    ('01/05', 'Dia do Trabalho'),
    ('07/09', 'Independência do Brasil'),
    ('12/10', 'Nossa Senhora Aparecida'),
    ('02/11', 'Finados'),
    ('20/11', 'Consciência Negra'),
    ('25/12', 'Natal')
) AS v(data, descricao)
WHERE NOT EXISTS (
    SELECT 1 FROM public.rh_feriados existente WHERE existente.data = v.data
);
