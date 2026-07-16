-- ============================================================
-- Migração: rh_escala_trabalho
-- Escala de trabalho (dias a trabalhar x dias de folga) por
-- empregado, configurada na tela "Gerar Escala" (Projeto RH/index.html
-- + script.js). Independente da jornada (rh_jornada_trabalho, que
-- define horário de entrada/saída) — a escala define só quais dias
-- são trabalho e quais são folga.
--
-- tipo_escala = 'fixa':
--   dias_semana guarda um array JSON com as chaves dos dias da
--   semana em que o empregado trabalha, ex.: ["segunda","terca",
--   "quarta","quinta","sexta"]. Chaves possíveis: segunda, terca,
--   quarta, quinta, sexta, sabado, domingo.
--
-- tipo_escala = 'variavel_datas':
--   o empregado trabalha todo dia da competência, EXCETO nas datas
--   específicas listadas em datas_folga (array JSON de strings
--   'AAAA-MM-DD'). Lista aberta — o usuário adiciona novas datas de
--   folga conforme necessário em competências futuras.
--
-- tipo_escala = 'variavel_padrao':
--   ciclo de blocos trabalho/folga que se repete indefinidamente a
--   partir de padrao_ancora (data 'AAAA-MM-DD' = primeiro dia do
--   primeiro bloco). padrao_blocos guarda um array JSON de blocos,
--   na ordem em que se repetem, ex.:
--   [{"tipo":"trabalho","dias":5},{"tipo":"folga","dias":1},
--    {"tipo":"trabalho","dias":2},{"tipo":"folga","dias":2},
--    {"tipo":"trabalho","dias":3},{"tipo":"folga","dias":1}]
--
-- Empregado sem linha nesta tabela: a tela assume um padrão 5x2
-- (segunda a sexta trabalho, sábado/domingo folga) até ser configurado.
--
-- Execute no SQL Editor do Supabase (mesmo projeto do Portal SCONT)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_escala_trabalho (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    nome_empresa      TEXT,
    codigo_empregado  TEXT NOT NULL,
    nome_empregado    TEXT NOT NULL,
    tipo_escala       TEXT NOT NULL, -- 'fixa' | 'variavel_datas' | 'variavel_padrao'
    dias_semana       JSONB,         -- tipo_escala = 'fixa'
    datas_folga       JSONB,         -- tipo_escala = 'variavel_datas'
    padrao_ancora     TEXT,          -- tipo_escala = 'variavel_padrao' ('AAAA-MM-DD')
    padrao_blocos     JSONB,         -- tipo_escala = 'variavel_padrao'
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rh_escala_trabalho_uniq UNIQUE (codigo_empresa, codigo_empregado)
);

CREATE INDEX IF NOT EXISTS idx_rh_escala_trabalho_empresa_empregado
    ON public.rh_escala_trabalho (codigo_empresa, codigo_empregado);

ALTER TABLE public.rh_escala_trabalho ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_escala_trabalho: leitura autenticado" ON public.rh_escala_trabalho;
DROP POLICY IF EXISTS "rh_escala_trabalho: escrita autenticado" ON public.rh_escala_trabalho;

CREATE POLICY "rh_escala_trabalho: leitura autenticado"
    ON public.rh_escala_trabalho FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_escala_trabalho: escrita autenticado"
    ON public.rh_escala_trabalho FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
