-- ============================================================
-- Boas Vindas — pendências da empresa que vem de outra contabilidade
--
-- Texto livre preenchido pela equipe Scont (uma pendência por linha).
-- Só é exibido quando origem_contabilidade <> 'nova'. NULL = bloco omitido.
--
-- fn_buscar_apresentacao_publica usa SELECT *, então já devolve a coluna nova.
-- ============================================================
ALTER TABLE public.apresentacoes
    ADD COLUMN IF NOT EXISTS pendencias TEXT;
