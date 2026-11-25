-- =====================================================================
-- FIXTURES LOCAIS (NAO e o schema real): tabelas rh_* usadas pelo Montador
-- de Escala. Carregado ANTES do bloqueio, para a politica restritiva
-- "portal_cliente: somente equipe" tambem valer aqui, como em producao.
-- =====================================================================
ALTER TABLE public.rh_empresas ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE public.rh_empresas ADD COLUMN IF NOT EXISTS municipio text;

CREATE TABLE public.rh_empregados (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  text NOT NULL,
    codigo_empregado text NOT NULL,
    nome_empregado  text,
    desc_cargo      text,
    desc_funcao     text,
    situacao        text,
    tipo_empregado  text,
    cpf             text,
    salario         numeric,
    endereco        text,
    sexo            text,
    data_nascimento date,
    UNIQUE (codigo_empresa, codigo_empregado)
);
CREATE TABLE public.rh_jornada_trabalho (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  text NOT NULL,
    codigo_empregado text NOT NULL,
    dia_semana      text,
    entrada         text,
    intervalo_inicio text,
    intervalo_fim   text,
    saida           text
);
CREATE TABLE public.rh_ferias_calculadas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  text NOT NULL,
    codigo_empregado text NOT NULL,
    ferias_inicio   date,
    ferias_fim      date
);
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['rh_empregados','rh_jornada_trabalho','rh_ferias_calculadas'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY "fixture: authenticated tudo" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;
