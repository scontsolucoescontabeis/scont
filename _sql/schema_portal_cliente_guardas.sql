-- =====================================================================
-- Portal do Cliente: guarda de equipe em funcoes SECURITY DEFINER.
-- Funcoes SECURITY DEFINER rodam como o dono e IGNORAM a politica
-- restritiva "portal_cliente: somente equipe". As que expoem dados das
-- empresas a qualquer authenticated precisam checar public.eh_equipe().
-- Idempotente. Requer: schema_portal_cliente.sql (public.eh_equipe()).
-- Aplicar junto (mesma transacao) com schema_portal_cliente_bloqueio.sql.
--
-- Inventario em producao (rodar antes; cada linha e uma candidata a guarda):
--   SELECT p.oid::regprocedure, pg_get_function_result(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef
--     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
--   ORDER BY 1;
--
-- REVERTER (manual):
--   -- fn_alertas_sistema: volta a original
--   DROP FUNCTION IF EXISTS public.fn_alertas_sistema();
--   ALTER FUNCTION public.fn_alertas_sistema_sem_guarda() RENAME TO fn_alertas_sistema;
--   GRANT EXECUTE ON FUNCTION public.fn_alertas_sistema() TO authenticated;
--   -- contabil_listar_usuarios_aprovados: reexecutar a secao 3 de
--   -- _sql/schema_contabil_empresas_responsaveis.sql
-- =====================================================================

-- 1. fn_alertas_sistema() ---------------------------------------------
-- A definicao diverge entre _sql/lgpd_compliance_migration.sql (filtro
-- c.ativo em certificados) e Projeto Central Alertas/fn_alertas_sistema.sql
-- (mais recente no git, 2026-11-09: filtro l.inativa/a.inativa, sem c.ativo).
-- Nao da para saber qual esta em producao, entao o corpo NAO e reescrito:
-- a funcao atual e renomeada para fn_alertas_sistema_sem_guarda() (sem
-- EXECUTE para anon/authenticated) e fn_alertas_sistema() vira um envoltorio
-- com guarda. Logica, assinatura e retorno ficam exatamente os do banco.
-- Atencao: reexecutar o .sql da Central de Alertas (DROP + CREATE) recria a
-- funcao SEM guarda; nesse caso, reaplicar este arquivo.
DO $$
DECLARE
    v_atual   regprocedure := to_regprocedure('public.fn_alertas_sistema()');
    v_antiga  regprocedure := to_regprocedure('public.fn_alertas_sistema_sem_guarda()');
    v_marca   text := 'portal_cliente: guarda de equipe';
BEGIN
    IF v_atual IS NOT NULL
       AND COALESCE(obj_description(v_atual::oid, 'pg_proc'), '') <> v_marca THEN
        -- funcao original (ou recriada sem guarda): passa a ser a interna
        IF v_antiga IS NOT NULL THEN
            EXECUTE 'DROP FUNCTION public.fn_alertas_sistema_sem_guarda()';
        END IF;
        EXECUTE 'ALTER FUNCTION public.fn_alertas_sistema() RENAME TO fn_alertas_sistema_sem_guarda';
    END IF;

    IF to_regprocedure('public.fn_alertas_sistema_sem_guarda()') IS NULL THEN
        RAISE NOTICE 'fn_alertas_sistema() nao existe: guarda nao aplicada.';
        RETURN;
    END IF;

    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.fn_alertas_sistema_sem_guarda() FROM PUBLIC, anon, authenticated';

    EXECUTE $f$
        CREATE OR REPLACE FUNCTION public.fn_alertas_sistema()
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
        LANGUAGE sql SECURITY DEFINER
        SET search_path = public, pg_temp AS $b$
            SELECT * FROM public.fn_alertas_sistema_sem_guarda()
            WHERE (SELECT public.eh_equipe());
        $b$
    $f$;
    EXECUTE format('COMMENT ON FUNCTION public.fn_alertas_sistema() IS %L', v_marca);
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.fn_alertas_sistema() FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fn_alertas_sistema() TO authenticated';
END $$;

-- 2. contabil_listar_usuarios_aprovados() -----------------------------
-- Unica definicao: _sql/schema_contabil_empresas_responsaveis.sql:54-63.
-- Mesmo corpo, + guarda de equipe e search_path fixo.
CREATE OR REPLACE FUNCTION public.contabil_listar_usuarios_aprovados()
RETURNS TABLE (id UUID, nome TEXT, email TEXT, empresa TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT id, nome, email, empresa
    FROM public.solicitacoes_acesso
    WHERE status = 'aprovado'
      AND (SELECT public.eh_equipe())
    ORDER BY nome;
$$;

REVOKE EXECUTE ON FUNCTION public.contabil_listar_usuarios_aprovados() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.contabil_listar_usuarios_aprovados() TO authenticated;
