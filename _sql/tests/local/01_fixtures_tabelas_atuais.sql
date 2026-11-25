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

-- Politicas permissivas para usuarios/solicitacoes_acesso (como no portal real,
-- onde o login le/escreve nelas); o bloqueio deve restringi-las ao dono.
CREATE POLICY "fixture: authenticated tudo" ON public.usuarios
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fixture: authenticated tudo" ON public.solicitacoes_acesso
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Revisao final: politicas/funcoes REAIS que furavam o bloqueio.
-- ---------------------------------------------------------------------
-- schema.sql:149-152 (sem TO => vale para anon tambem)
CREATE POLICY "solicitacoes: inserir cadastro" ON public.solicitacoes_acesso
    FOR INSERT WITH CHECK (TRUE);
-- Projeto CRM/supabase/migrations/001_crm_schema.sql:206 (sem WITH CHECK)
CREATE POLICY "usuarios_update_own" ON public.usuarios
    FOR UPDATE TO authenticated USING (id = auth.uid());

-- Projeto Gerenciador Formularios/schema_formularios.sql:956-968
CREATE POLICY "storage documentos: upload anon"
    ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "storage documentos: upload authenticated"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "storage documentos: leitura authenticated"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'documentos');
CREATE POLICY "storage documentos: delete authenticated"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'documentos');

-- _sql/schema_contabil_empresas_responsaveis.sql:54-63 (copia fiel)
CREATE OR REPLACE FUNCTION public.contabil_listar_usuarios_aprovados()
RETURNS TABLE (id UUID, nome TEXT, email TEXT, empresa TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT id, nome, email, empresa
    FROM public.solicitacoes_acesso
    WHERE status = 'aprovado'
    ORDER BY nome;
$$;
GRANT EXECUTE ON FUNCTION public.contabil_listar_usuarios_aprovados() TO authenticated;

-- fn_alertas_sistema(): versao MINIMA (mesma assinatura/retorno e mesmo
-- ramo "PORTAL - solicitacoes pendentes" do original; os demais ramos
-- dependem de tabelas que o stub nao tem). SECURITY DEFINER sem guarda.
CREATE FUNCTION public.fn_alertas_sistema()
RETURNS TABLE (
    categoria  TEXT,
    ferramenta TEXT,
    severidade TEXT,
    titulo     TEXT,
    descricao  TEXT,
    data_ref   TIMESTAMPTZ,
    link       TEXT,
    detalhes   JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
    'portal'::text, 'Administração do Portal'::text, 'urgente'::text,
    'Solicitação de acesso: ' || COALESCE(s.nome, 'Usuário'),
    COALESCE(s.empresa, ''),
    s.data_solicitacao,
    '../admin-dashboard.html'::text,
    jsonb_build_object('nome', s.nome, 'email', s.email, 'telefone', s.telefone)
FROM public.solicitacoes_acesso s
WHERE s.status = 'pendente';
$$;
GRANT EXECUTE ON FUNCTION public.fn_alertas_sistema() TO authenticated;
