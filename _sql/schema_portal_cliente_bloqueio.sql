-- =====================================================================
-- Portal do Cliente - Parte 1, Task 2: bloqueio nas tabelas atuais.
-- Cria, em cada tabela de public COM RLS, a politica RESTRICTIVE
-- "portal_cliente: somente equipe" (so public.eh_equipe() passa).
-- Politicas antigas nao sao tocadas. Idempotente. Reverter com
-- schema_portal_cliente_bloqueio_reverter.sql.
-- Tabelas sem RLS: apenas RAISE NOTICE (nao liga RLS sozinho).
-- Requer: schema_portal_cliente.sql (public.eh_equipe()).
-- =====================================================================
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('cliente_usuarios', 'cliente_acessos')
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
