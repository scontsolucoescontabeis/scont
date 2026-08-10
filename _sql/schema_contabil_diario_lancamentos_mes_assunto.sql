-- ============================================================
-- DIÁRIO CONTÁBIL — Lançamentos: mês de referência (competência) e assunto
-- ============================================================
-- Ambos os campos são opcionais (sem NOT NULL, sem default) — o
-- lançamento continua podendo ser feito só com data + texto, como hoje.

ALTER TABLE public.contabil_diario_lancamentos
    ADD COLUMN IF NOT EXISTS mes_referencia INT CHECK (mes_referencia BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS ano_referencia INT,
    ADD COLUMN IF NOT EXISTS assunto TEXT;
