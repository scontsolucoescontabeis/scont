-- Migração: feriados nacionais e locais (rh_feriados v2)
-- Execute no SQL Editor do Supabase. Idempotente.
--
-- Acrescenta recorte por localidade (nacional/estadual/municipal), tipo
-- (feriado/facultativo), feriados móveis (calculados pela Páscoa no front) e
-- flag ativo. Não altera as linhas fixas já existentes além de classificá-las
-- como nacionais.

-- 1. Colunas novas ---------------------------------------------------------
ALTER TABLE public.rh_feriados ADD COLUMN IF NOT EXISTS regra_movel  TEXT;
ALTER TABLE public.rh_feriados ADD COLUMN IF NOT EXISTS abrangencia  TEXT NOT NULL DEFAULT 'nacional';
ALTER TABLE public.rh_feriados ADD COLUMN IF NOT EXISTS uf           TEXT;
ALTER TABLE public.rh_feriados ADD COLUMN IF NOT EXISTS municipio    TEXT;
ALTER TABLE public.rh_feriados ADD COLUMN IF NOT EXISTS tipo         TEXT NOT NULL DEFAULT 'feriado';
ALTER TABLE public.rh_feriados ADD COLUMN IF NOT EXISTS ativo        BOOLEAN NOT NULL DEFAULT TRUE;

-- data passa a aceitar NULL (quando o feriado é móvel)
ALTER TABLE public.rh_feriados ALTER COLUMN data DROP NOT NULL;

-- 2. Classifica as linhas existentes como nacionais/feriado ----------------
UPDATE public.rh_feriados SET abrangencia = 'nacional' WHERE abrangencia IS NULL;
UPDATE public.rh_feriados SET tipo        = 'feriado'  WHERE tipo IS NULL;

-- 3. Regras de integridade (recria para poder rodar de novo sem erro) ------
ALTER TABLE public.rh_feriados DROP CONSTRAINT IF EXISTS rh_feriados_abrangencia_chk;
ALTER TABLE public.rh_feriados DROP CONSTRAINT IF EXISTS rh_feriados_tipo_chk;
ALTER TABLE public.rh_feriados DROP CONSTRAINT IF EXISTS rh_feriados_regra_movel_chk;
ALTER TABLE public.rh_feriados DROP CONSTRAINT IF EXISTS rh_feriados_data_ou_movel_chk;
ALTER TABLE public.rh_feriados DROP CONSTRAINT IF EXISTS rh_feriados_uf_chk;
ALTER TABLE public.rh_feriados DROP CONSTRAINT IF EXISTS rh_feriados_municipio_chk;

ALTER TABLE public.rh_feriados
    ADD CONSTRAINT rh_feriados_abrangencia_chk
    CHECK (abrangencia IN ('nacional', 'estadual', 'municipal'));

ALTER TABLE public.rh_feriados
    ADD CONSTRAINT rh_feriados_tipo_chk
    CHECK (tipo IN ('feriado', 'facultativo'));

ALTER TABLE public.rh_feriados
    ADD CONSTRAINT rh_feriados_regra_movel_chk
    CHECK (regra_movel IS NULL OR regra_movel IN
        ('sexta_santa', 'carnaval_segunda', 'carnaval_terca', 'quarta_cinzas', 'corpus_christi'));

ALTER TABLE public.rh_feriados
    ADD CONSTRAINT rh_feriados_data_ou_movel_chk
    CHECK ((data IS NOT NULL) <> (regra_movel IS NOT NULL));

ALTER TABLE public.rh_feriados
    ADD CONSTRAINT rh_feriados_uf_chk
    CHECK (abrangencia = 'nacional' OR uf IS NOT NULL);

ALTER TABLE public.rh_feriados
    ADD CONSTRAINT rh_feriados_municipio_chk
    CHECK (abrangencia <> 'municipal' OR municipio IS NOT NULL);

-- 4. Seed dos feriados móveis nacionais (só insere o que ainda não existe) -
INSERT INTO public.rh_feriados (regra_movel, descricao, abrangencia, tipo, ativo)
SELECT v.regra_movel, v.descricao, 'nacional', v.tipo, TRUE FROM (VALUES
    ('sexta_santa',      'Sexta-feira Santa',           'feriado'),
    ('carnaval_segunda', 'Carnaval (segunda-feira)',    'facultativo'),
    ('carnaval_terca',   'Carnaval (terça-feira)',      'facultativo'),
    ('quarta_cinzas',    'Quarta-feira de Cinzas',      'facultativo'),
    ('corpus_christi',   'Corpus Christi',              'facultativo')
) AS v(regra_movel, descricao, tipo)
WHERE NOT EXISTS (
    SELECT 1 FROM public.rh_feriados existente WHERE existente.regra_movel = v.regra_movel
);

-- RLS: inalterada (leitura/escrita para usuários autenticados — ver
-- schema_rh_feriados_globais.sql).
