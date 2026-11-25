-- =====================================================================
-- Portal do Cliente - Parte 1, Task 2: bloqueio nas tabelas atuais.
-- Cria, em cada tabela de public COM RLS, a politica RESTRICTIVE
-- "portal_cliente: somente equipe" (so public.eh_equipe() passa).
-- Politicas antigas nao sao tocadas. Idempotente. Reverter com
-- schema_portal_cliente_bloqueio_reverter.sql.
-- Tabelas sem RLS: apenas RAISE NOTICE (nao liga RLS sozinho).
-- Requer: schema_portal_cliente.sql (public.eh_equipe()).
-- Excecoes: usuarios e solicitacoes_acesso recebem politica restritiva do proprio
-- dono (login/cadastro de quem ainda nao e equipe), no fim deste arquivo.
-- Tambem cria "portal_cliente: anon so pendente" (solicitacoes_acesso, anon) e
-- "portal_cliente: somente equipe" em storage.objects (se existir).
-- Limites: pg_tables inclui pai de tabela particionada (particao consultada direto
-- mantem as proprias politicas); views sem security_invoker ignoram politicas das
-- tabelas; funcoes SECURITY DEFINER ignoram RLS (ver schema_portal_cliente_guardas.sql);
-- outros schemas alem de public/storage estao fora do escopo.
-- =====================================================================
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('cliente_usuarios', 'cliente_acessos', 'usuarios', 'solicitacoes_acesso')
        ORDER BY tablename
    LOOP
        IF NOT t.rowsecurity THEN
            RAISE NOTICE 'Tabela public.% esta SEM RLS: bloqueio nao aplicado (revisar manualmente).', t.tablename;
            CONTINUE;
        END IF;
        EXECUTE format('DROP POLICY IF EXISTS "portal_cliente: somente equipe" ON public.%I', t.tablename);
        EXECUTE format(
            'CREATE POLICY "portal_cliente: somente equipe" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.eh_equipe())) WITH CHECK ((SELECT public.eh_equipe()))',
            t.tablename);
    END LOOP;
END $$;

-- (SELECT public.eh_equipe()) = InitPlan: avaliada uma vez por consulta.
-- usuarios: equipe ve tudo; nao-equipe ve apenas a propria linha e NAO grava
-- (a politica antiga usuarios_update_own do CRM nao tem WITH CHECK e deixaria
-- o cliente marcar is_admin = true na propria linha).
DROP POLICY IF EXISTS "portal_cliente: somente equipe" ON public.usuarios;
CREATE POLICY "portal_cliente: somente equipe" ON public.usuarios
    AS RESTRICTIVE FOR ALL TO authenticated
    USING ((SELECT public.eh_equipe()) OR id = auth.uid())
    WITH CHECK ((SELECT public.eh_equipe()));

-- solicitacoes_acesso: quem ainda nao e equipe cria/le so a propria solicitacao
-- (por e-mail do JWT) e nunca com status diferente de 'pendente'.
DROP POLICY IF EXISTS "portal_cliente: somente equipe" ON public.solicitacoes_acesso;
CREATE POLICY "portal_cliente: somente equipe" ON public.solicitacoes_acesso
    AS RESTRICTIVE FOR ALL TO authenticated
    USING ((SELECT public.eh_equipe()) OR lower(email) = lower(auth.jwt() ->> 'email'))
    WITH CHECK ((SELECT public.eh_equipe())
                OR (lower(email) = lower(auth.jwt() ->> 'email') AND status = 'pendente'));

-- solicitacoes_acesso, anon: o cadastro de equipe (login.html) insere como anon.
-- A politica antiga "solicitacoes: inserir cadastro" (schema.sql, sem TO) aceita
-- qualquer linha, inclusive status 'aprovado' -- o que tornaria o anon equipe.
DROP POLICY IF EXISTS "portal_cliente: anon so pendente" ON public.solicitacoes_acesso;
CREATE POLICY "portal_cliente: anon so pendente" ON public.solicitacoes_acesso
    AS RESTRICTIVE FOR INSERT TO anon
    WITH CHECK (status = 'pendente' AND avaliado_por IS NULL AND data_avaliacao IS NULL);

-- storage.objects: politicas antigas (ex.: bucket 'documentos' do Gerenciador
-- de Formularios) liberam leitura/exclusao a qualquer authenticated. So aplica
-- se o schema storage existir. anon (upload de formulario publico) inalterado.
DO $$
BEGIN
    IF to_regclass('storage.objects') IS NULL THEN
        RAISE NOTICE 'storage.objects nao existe: bloqueio de storage nao aplicado.';
        RETURN;
    END IF;
    EXECUTE 'DROP POLICY IF EXISTS "portal_cliente: somente equipe" ON storage.objects';
    EXECUTE 'CREATE POLICY "portal_cliente: somente equipe" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.eh_equipe())) WITH CHECK ((SELECT public.eh_equipe()))';
END $$;
