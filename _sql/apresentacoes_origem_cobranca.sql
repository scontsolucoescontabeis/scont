-- ============================================================
-- Boas Vindas — origem contábil e início da cobrança de honorários
--
-- origem_contabilidade: 'nova' (empresa recém-aberta → balanço de abertura
--   será elaborado pela Scont) ou 'outra_contabilidade' (migração → aguarda
--   saldos finais da contabilidade anterior). NULL = linhas antigas, tratadas
--   como 'outra_contabilidade' (texto que já era exibido).
-- inicio_cobranca_honorarios: data editável usada na frase
--   "Cobranças iniciam em ..." do Honorário Contábil. NULL = frase omitida.
--
-- fn_buscar_apresentacao_publica usa SELECT *, então já devolve as colunas novas.
-- ============================================================
ALTER TABLE public.apresentacoes
    ADD COLUMN IF NOT EXISTS origem_contabilidade TEXT
        CHECK (origem_contabilidade IN ('nova', 'outra_contabilidade')),
    ADD COLUMN IF NOT EXISTS inicio_cobranca_honorarios DATE;
