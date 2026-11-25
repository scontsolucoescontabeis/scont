-- Testes dos achados da revisao final (portal do cliente).
-- Cada achado roda em sua propria transacao (BEGIN/ROLLBACK), para que o
-- RED de um nao esconda o dos outros quando rodado com ON_ERROR_STOP=0.
-- Pressupoe: stub + fixtures + schema_portal_cliente + guardas + bloqueio.

-- Dados comuns (ids fixos). Chamado como superusuario dentro de cada bloco.
CREATE FUNCTION pg_temp.preparar() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.rh_empresas (codigo_empresa, nome_empresa, cnpj)
    VALUES ('T-A', 'Zzteste Alfa Comercio Ltda', '11.222.333/0001-81');
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ('00000000-0000-0000-0000-0000000000a1', 'a@cliente.test', '{"portal":"cliente","codigo_empresa":"T-A"}'),
        ('00000000-0000-0000-0000-0000000000e1', 'eq@scont.test',  '{}'),
        ('00000000-0000-0000-0000-0000000000d1', 'adm@scont.test', '{}');
    UPDATE public.usuarios SET is_admin = true WHERE id = '00000000-0000-0000-0000-0000000000d1';
    UPDATE public.cliente_acessos SET status = 'aprovado'
      WHERE usuario_id = '00000000-0000-0000-0000-0000000000a1';
    INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES
        ('Eq', 'eq@scont.test', 'aprovado'),
        ('Pendente', 'pend@scont.test', 'pendente');
    INSERT INTO storage.objects (bucket_id, name) VALUES ('documentos', 'rg.pdf');
END $$;

CREATE FUNCTION pg_temp.como(p_sub uuid, p_email text) RETURNS void LANGUAGE sql AS $$
    SELECT set_config('request.jwt.claims',
        json_build_object('sub', p_sub, 'email', p_email)::text, true);
$$;

-- ---------------------------------------------------------------------
-- 1. anon so cria solicitacao pendente (nunca aprovada)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
BEGIN
    PERFORM pg_temp.preparar();
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    -- cadastro de equipe (login.html) continua funcionando
    INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES ('Novo', 'novo@scont.test', 'pendente');
    BEGIN
        INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES ('Hack', 'hack@x.test', 'aprovado');
        RAISE EXCEPTION 'anon_so_pendente: anon inseriu solicitacao APROVADA';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO public.solicitacoes_acesso (nome, email, status, avaliado_por)
        VALUES ('Hack', 'hack2@x.test', 'pendente', 'alguem');
        RAISE EXCEPTION 'anon_so_pendente: anon inseriu solicitacao com avaliado_por';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO public.solicitacoes_acesso (nome, email, status, data_avaliacao)
        VALUES ('Hack', 'hack3@x.test', 'pendente', now());
        RAISE EXCEPTION 'anon_so_pendente: anon inseriu solicitacao com data_avaliacao';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
    ASSERT (SELECT count(*) FROM public.solicitacoes_acesso WHERE email = 'novo@scont.test') = 1,
        'anon_so_pendente: cadastro pendente do anon nao gravou';
    ASSERT (SELECT count(*) FROM public.solicitacoes_acesso WHERE email LIKE 'hack%') = 0,
        'anon_so_pendente: linha indevida gravada';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- 2. nao-equipe nao edita usuarios (nem a propria linha: is_admin)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE n int;
BEGIN
    PERFORM pg_temp.preparar();
    PERFORM pg_temp.como('00000000-0000-0000-0000-0000000000a1', 'a@cliente.test');
    SET LOCAL ROLE authenticated;
    BEGIN
        UPDATE public.usuarios SET is_admin = true WHERE id = auth.uid();
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN
            RAISE EXCEPTION 'usuarios_sem_auto_admin: cliente se tornou admin (% linha)', n;
        END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    ASSERT public.eh_equipe() = false, 'usuarios_sem_auto_admin: cliente virou equipe';
    RESET ROLE;
    ASSERT (SELECT is_admin FROM public.usuarios WHERE id = '00000000-0000-0000-0000-0000000000a1') = false,
        'usuarios_sem_auto_admin: is_admin do cliente mudou';

    -- equipe continua editando usuarios
    PERFORM pg_temp.como('00000000-0000-0000-0000-0000000000e1', 'eq@scont.test');
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET nome = 'Eq Editado' WHERE id = '00000000-0000-0000-0000-0000000000e1';
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 1, 'usuarios_equipe_edita: equipe nao editou a propria linha';
    RESET ROLE;
    -- admin promove outro usuario (fluxo de aprovacao do admin-dashboard)
    PERFORM pg_temp.como('00000000-0000-0000-0000-0000000000d1', 'adm@scont.test');
    SET LOCAL ROLE authenticated;
    UPDATE public.usuarios SET is_admin = true WHERE id = '00000000-0000-0000-0000-0000000000e1';
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 1, 'usuarios_equipe_edita: admin nao promoveu usuario';
    RESET ROLE;
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- 3. funcoes SECURITY DEFINER com guarda de equipe
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE n int;
BEGIN
    PERFORM pg_temp.preparar();
    -- cliente (nao-equipe): nada
    PERFORM pg_temp.como('00000000-0000-0000-0000-0000000000a1', 'a@cliente.test');
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.fn_alertas_sistema();
    ASSERT n = 0, 'guarda_alertas: cliente recebeu '||n||' alertas';
    SELECT count(*) INTO n FROM public.contabil_listar_usuarios_aprovados();
    ASSERT n = 0, 'guarda_usuarios_aprovados: cliente recebeu '||n||' linhas';
    -- a funcao original renomeada nao pode ser chamada direto
    BEGIN
        PERFORM 1 FROM public.fn_alertas_sistema_sem_guarda();
        RAISE EXCEPTION 'guarda_alertas: authenticated executou fn_alertas_sistema_sem_guarda()';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
    -- anon: nada (ou sem permissao)
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    BEGIN
        SELECT count(*) INTO n FROM public.fn_alertas_sistema();
        ASSERT n = 0, 'guarda_alertas: anon recebeu alertas';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        SELECT count(*) INTO n FROM public.contabil_listar_usuarios_aprovados();
        ASSERT n = 0, 'guarda_usuarios_aprovados: anon recebeu linhas';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
    -- equipe: dados
    PERFORM pg_temp.como('00000000-0000-0000-0000-0000000000e1', 'eq@scont.test');
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.fn_alertas_sistema();
    ASSERT n = 1, 'guarda_alertas: equipe deveria ver 1 alerta (pendente), veio '||n;
    SELECT count(*) INTO n FROM public.contabil_listar_usuarios_aprovados();
    ASSERT n = 1, 'guarda_usuarios_aprovados: equipe deveria ver 1 aprovado, veio '||n;
    RESET ROLE;
    -- retorno preservado
    ASSERT pg_get_function_result('public.fn_alertas_sistema()'::regprocedure) =
        'TABLE(categoria text, ferramenta text, severidade text, titulo text, descricao text, data_ref timestamp with time zone, link text, detalhes jsonb)',
        'guarda_alertas: tipo de retorno mudou';
    ASSERT pg_get_function_result('public.contabil_listar_usuarios_aprovados()'::regprocedure) =
        'TABLE(id uuid, nome text, email text, empresa text)',
        'guarda_usuarios_aprovados: tipo de retorno mudou';
    -- search_path fixo nas DEFINER
    SELECT count(*) INTO n FROM pg_proc p
      WHERE p.oid IN ('public.fn_alertas_sistema()'::regprocedure,
                      'public.contabil_listar_usuarios_aprovados()'::regprocedure)
        AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp'];
    ASSERT n = 2, 'guarda_search_path: funcoes sem search_path=public, pg_temp';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- 4. storage.objects dentro do bloqueio
-- ---------------------------------------------------------------------
BEGIN;
DO $$
DECLARE n int;
BEGIN
    PERFORM pg_temp.preparar();
    PERFORM pg_temp.como('00000000-0000-0000-0000-0000000000a1', 'a@cliente.test');
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM storage.objects;
    ASSERT n = 0, 'storage_bloqueado: cliente leu '||n||' objetos';
    DELETE FROM storage.objects;
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 0, 'storage_bloqueado: cliente apagou objetos';
    BEGIN
        INSERT INTO storage.objects (bucket_id, name) VALUES ('documentos', 'cliente.pdf');
        RAISE EXCEPTION 'storage_bloqueado: cliente enviou objeto';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
    -- equipe continua lendo
    PERFORM pg_temp.como('00000000-0000-0000-0000-0000000000e1', 'eq@scont.test');
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM storage.objects;
    ASSERT n = 1, 'storage_equipe: equipe nao leu objetos';
    RESET ROLE;
    -- anon (formulario publico) continua enviando
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    INSERT INTO storage.objects (bucket_id, name) VALUES ('documentos', 'anon.pdf');
    RESET ROLE;
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------
-- 6. apagar empresa com acessos de clientes e bloqueado (RESTRICT)
-- ---------------------------------------------------------------------
BEGIN;
DO $$
BEGIN
    PERFORM pg_temp.preparar();
    BEGIN
        DELETE FROM public.rh_empresas WHERE codigo_empresa = 'T-A';
        RAISE EXCEPTION 'fk_restrict: apagar empresa apagou os acessos em cascata';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    ASSERT (SELECT count(*) FROM public.cliente_acessos WHERE codigo_empresa = 'T-A') = 1,
        'fk_restrict: acesso do cliente sumiu';
    -- empresa sem acessos continua podendo ser apagada
    INSERT INTO public.rh_empresas (codigo_empresa, nome_empresa) VALUES ('T-Z', 'Sem acessos');
    DELETE FROM public.rh_empresas WHERE codigo_empresa = 'T-Z';
END $$;
ROLLBACK;
