-- ============================================================
-- Boas Vindas — receita bruta acumulada dos últimos 12 meses (RBT12)
--
-- Usada para enquadrar a empresa na faixa do anexo do Simples Nacional
-- e calcular a alíquota efetiva exibida na apresentação.
-- NULL = não informada (a página mostra as tabelas sem destacar faixa).
--
-- fn_buscar_apresentacao_publica usa SELECT *, então já devolve a coluna nova.
-- ============================================================
ALTER TABLE public.apresentacoes
    ADD COLUMN IF NOT EXISTS renda_bruta_12m NUMERIC(14,2)
        CHECK (renda_bruta_12m IS NULL OR renda_bruta_12m >= 0);
