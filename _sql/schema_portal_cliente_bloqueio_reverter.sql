-- Reverte schema_portal_cliente_bloqueio.sql: remove a politica restritiva
-- "portal_cliente: somente equipe" de todas as tabelas de public.
DO $$
DECLARE
    p record;
BEGIN
    FOR p IN
        SELECT schemaname, tablename FROM pg_policies
        WHERE schemaname = 'public' AND policyname = 'portal_cliente: somente equipe'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "portal_cliente: somente equipe" ON %I.%I', p.schemaname, p.tablename);
    END LOOP;
END $$;
