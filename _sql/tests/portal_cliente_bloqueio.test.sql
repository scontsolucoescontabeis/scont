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
        AND tablename NOT IN ('cliente_usuarios', 'cliente_acessos', 'usuarios', 'solicitacoes_acesso');
    ASSERT esperadas >= 2, 'bloqueio_idempotente: poucas tabelas elegiveis ('||esperadas||')';
    SELECT count(*) INTO n FROM pg_policies
      WHERE schemaname = 'public' AND policyname = 'portal_cliente: somente equipe';
    ASSERT n = esperadas + 2, 'bloqueio_idempotente: politicas='||n||' esperadas='||(esperadas+2);
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
    -- InitPlan: eh_equipe() avaliada uma vez por consulta, nao por linha
    SELECT count(*) INTO n FROM pg_policies
      WHERE schemaname IN ('public', 'storage') AND policyname = 'portal_cliente: somente equipe'
        AND (qual NOT LIKE '%( SELECT eh_equipe() AS eh_equipe)%'
             OR with_check NOT LIKE '%( SELECT eh_equipe() AS eh_equipe)%');
    ASSERT n = 0, 'bloqueio_initplan: '||n||' politicas sem (SELECT public.eh_equipe())';
    -- usuarios: so equipe grava (fecha auto-edicao de is_admin)
    SELECT count(*) INTO n FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'usuarios'
        AND policyname = 'portal_cliente: somente equipe'
        AND with_check = '( SELECT eh_equipe() AS eh_equipe)';
    ASSERT n = 1, 'bloqueio_usuarios_check: WITH CHECK de usuarios nao e so equipe';
    -- anon so cria solicitacao pendente
    SELECT count(*) INTO n FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'solicitacoes_acesso'
        AND policyname = 'portal_cliente: anon so pendente'
        AND permissive = 'RESTRICTIVE' AND cmd = 'INSERT' AND roles = '{anon}';
    ASSERT n = 1, 'bloqueio_anon_pendente: politica ausente ou com formato errado';
    -- storage.objects
    SELECT count(*) INTO n FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = 'portal_cliente: somente equipe';
    ASSERT n = 1, 'bloqueio_storage: politica em storage.objects='||n;
END $$;
-- @@REVERTER@@ (run.sh injeta schema_portal_cliente_bloqueio_reverter.sql aqui)
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM pg_policies WHERE policyname LIKE 'portal\_cliente:%';
    ASSERT n = 0, 'reverter: restaram '||n||' politicas portal_cliente:* (public/storage)';
    SELECT count(*) INTO n FROM pg_policies
      WHERE schemaname = 'storage' AND policyname LIKE 'storage documentos:%';
    ASSERT n = 4, 'reverter: politicas antigas de storage afetadas ('||n||')';
    -- reverter preserva politicas antigas (5 das fixtures 01 + 3 das tabelas rh_* da fixture 02)
    SELECT count(*) INTO n FROM pg_policies WHERE policyname = 'fixture: authenticated tudo';
    ASSERT n = 8, 'reverter: politicas antigas afetadas ('||n||')';
    SELECT count(*) INTO n FROM pg_policies WHERE tablename IN ('usuarios','solicitacoes_acesso') AND policyname = 'portal_cliente: somente equipe';
    ASSERT n = 0, 'reverter: restaram politicas owner-scoped';
END $$;
ROLLBACK;
