-- Testa o proprio script de bloqueio: idempotencia, exclusoes e reversao.
-- Pressupoe schema_portal_cliente_bloqueio.sql ja aplicado uma vez (run.sh).
-- Reaplica e reverte dentro da transacao e faz ROLLBACK.
BEGIN;
-- @@APLICAR@@ (run.sh injeta schema_portal_cliente_bloqueio.sql aqui)
DO $$
DECLARE
    n int;
    esperadas int;
BEGIN
    -- tabelas elegiveis: public, RLS ligada, fora da lista de exclusao
    SELECT count(*) INTO esperadas FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity
        AND tablename NOT IN ('cliente_usuarios', 'cliente_acessos');
    ASSERT esperadas >= 4, 'bloqueio_idempotente: poucas tabelas elegiveis ('||esperadas||')';
    SELECT count(*) INTO n FROM pg_policies
      WHERE schemaname = 'public' AND policyname = 'portal_cliente: somente equipe';
    ASSERT n = esperadas, 'bloqueio_idempotente: politicas='||n||' esperadas='||esperadas;
    -- exatamente uma por tabela, restritiva, so authenticated
    SELECT count(*) INTO n FROM (
        SELECT tablename FROM pg_policies
        WHERE schemaname = 'public' AND policyname = 'portal_cliente: somente equipe'
        GROUP BY tablename HAVING count(*) > 1) d;
    ASSERT n = 0, 'bloqueio_idempotente: tabela com politica duplicada';
    SELECT count(*) INTO n FROM pg_policies
      WHERE policyname = 'portal_cliente: somente equipe'
        AND (permissive <> 'RESTRICTIVE' OR cmd <> 'ALL' OR roles <> '{authenticated}');
    ASSERT n = 0, 'bloqueio_formato: politica nao e RESTRICTIVE/ALL/authenticated';
    -- exclusoes
    SELECT count(*) INTO n FROM pg_policies
      WHERE policyname = 'portal_cliente: somente equipe'
        AND tablename IN ('cliente_usuarios', 'cliente_acessos');
    ASSERT n = 0, 'bloqueio_exclusoes: politica criada em tabela excluida';
    SELECT count(*) INTO n FROM pg_policies
      WHERE policyname = 'portal_cliente: somente equipe' AND tablename = 'fixture_sem_rls';
    ASSERT n = 0, 'bloqueio_sem_rls: politica criada em tabela sem RLS';
END $$;
-- @@REVERTER@@ (run.sh injeta schema_portal_cliente_bloqueio_reverter.sql aqui)
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM pg_policies WHERE policyname = 'portal_cliente: somente equipe';
    ASSERT n = 0, 'reverter: restaram '||n||' politicas';
    -- reverter preserva politicas antigas
    SELECT count(*) INTO n FROM pg_policies WHERE policyname = 'fixture: authenticated tudo';
    ASSERT n = 3, 'reverter: politicas antigas afetadas ('||n||')';
END $$;
ROLLBACK;
