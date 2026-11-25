-- Reverte schema_portal_cliente_bloqueio.sql: remove TODAS as politicas
-- "portal_cliente: ..." (somente equipe, anon so pendente) de public e storage.
-- Politicas antigas nao sao tocadas.
DO $$
DECLARE
    p record;
BEGIN
    FOR p IN
        SELECT schemaname, tablename, policyname FROM pg_policies
        WHERE schemaname IN ('public', 'storage')
          AND policyname LIKE 'portal\_cliente:%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    END LOOP;
END $$;
