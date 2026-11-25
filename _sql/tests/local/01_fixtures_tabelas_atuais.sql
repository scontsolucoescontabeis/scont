-- =====================================================================
-- FIXTURES LOCAIS (NAO e o schema real): imitam tabelas atuais do portal
-- para exercitar o bloqueio. Aplicado depois do stub. Nunca em producao.
-- =====================================================================
-- Politicas permissivas como no portal real (qualquer authenticated).
CREATE POLICY "fixture: authenticated tudo" ON public.rh_empresas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_socios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa text,
    nome text
);
ALTER TABLE public.rh_socios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixture: authenticated tudo" ON public.rh_socios
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela com politica para anon (ex.: formularios publicos)
CREATE TABLE public.fixture_formulario_anon (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conteudo text
);
ALTER TABLE public.fixture_formulario_anon ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixture: anon le" ON public.fixture_formulario_anon
    FOR SELECT TO anon USING (true);
CREATE POLICY "fixture: authenticated tudo" ON public.fixture_formulario_anon
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela SEM RLS: o bloqueio nao pode ligar RLS sozinho, so avisar.
CREATE TABLE public.fixture_sem_rls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    valor text
);
