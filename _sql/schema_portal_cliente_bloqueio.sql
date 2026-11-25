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
-- Limites: pg_tables inclui pai de tabela particionada (particao consultada direto
-- mantem as proprias politicas); views sem security_invoker ignoram politicas das
-- tabelas; outros schemas estao fora do escopo.
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
            'CREATE POLICY "portal_cliente: somente equipe" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.eh_equipe()) WITH CHECK (public.eh_equipe())',
            t.tablename);
    END LOOP;
END $$;

-- usuarios: equipe ve tudo; qualquer um ve/edita apenas a propria linha.
DROP POLICY IF EXISTS "portal_cliente: somente equipe" ON public.usuarios;
CREATE POLICY "portal_cliente: somente equipe" ON public.usuarios
    AS RESTRICTIVE FOR ALL TO authenticated
    USING (public.eh_equipe() OR id = auth.uid())
    WITH CHECK (public.eh_equipe() OR id = auth.uid());

-- solicitacoes_acesso: quem ainda nao e equipe cria/le so a propria solicitacao
-- (por e-mail do JWT) e nunca com status diferente de 'pendente'.
DROP POLICY IF EXISTS "portal_cliente: somente equipe" ON public.solicitacoes_acesso;
CREATE POLICY "portal_cliente: somente equipe" ON public.solicitacoes_acesso
    AS RESTRICTIVE FOR ALL TO authenticated
    USING (public.eh_equipe() OR lower(email) = lower(auth.jwt() ->> 'email'))
    WITH CHECK (public.eh_equipe()
                OR (lower(email) = lower(auth.jwt() ->> 'email') AND status = 'pendente'));
