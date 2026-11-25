-- O administrador do portal (is_admin) enxerga qualquer empresa pelo Portal do Cliente.
-- Pressupoe: stub + fixtures + schema_portal_cliente + guardas + bloqueio + schema_portal_cliente_admin.
-- Roda em transacao com ROLLBACK.

BEGIN;
DO $$
DECLARE n int;
BEGIN
    INSERT INTO public.rh_empresas (codigo_empresa, nome_empresa, cnpj) VALUES
        ('T-A', 'Zzteste Alfa Comercio Ltda', '11.222.333/0001-81'),
        ('T-B', 'Zzteste Beta Servicos Ltda', '22.333.444/0001-72');
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ('00000000-0000-0000-0000-0000000000a1', 'a@cliente.test', '{"portal":"cliente","codigo_empresa":"T-A"}'),
        ('00000000-0000-0000-0000-0000000000b1', 'b@cliente.test', '{"portal":"cliente","codigo_empresa":"T-B"}'),
        ('00000000-0000-0000-0000-0000000000e1', 'eq@scont.test',  '{}'),
        ('00000000-0000-0000-0000-0000000000d1', 'adm@scont.test', '{}');
    UPDATE public.usuarios SET is_admin = true WHERE id = '00000000-0000-0000-0000-0000000000d1';
    INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES ('Eq', 'eq@scont.test', 'aprovado');
    -- cliente A aprovado em T-A; cliente B continua pendente em T-B
    UPDATE public.cliente_acessos SET status = 'aprovado'
      WHERE usuario_id = '00000000-0000-0000-0000-0000000000a1';

    -- admin: enxerga todas as empresas, mesmo sem nenhum vinculo
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', '00000000-0000-0000-0000-0000000000d1', 'email', 'adm@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.empresas_do_cliente();
    ASSERT n = (SELECT count(*) FROM public.rh_empresas), 'admin_ve_todas: admin nao recebeu todas as empresas (' || n || ')';
    ASSERT (SELECT count(*) FROM public.empresas_do_cliente() e WHERE e = 'T-B') = 1, 'admin_ve_todas: faltou T-B';
    RESET ROLE;

    -- cliente aprovado em T-A: so T-A (nao herda o poder do admin)
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'email', 'a@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;
    ASSERT (SELECT array_agg(e) FROM public.empresas_do_cliente() e) = ARRAY['T-A'], 'cliente_so_a_propria: cliente A viu outras empresas';
    RESET ROLE;

    -- cliente com pedido pendente: nada
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', '00000000-0000-0000-0000-0000000000b1', 'email', 'b@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;
    ASSERT (SELECT count(*) FROM public.empresas_do_cliente()) = 0, 'pendente_nada: cliente pendente viu empresa';
    RESET ROLE;

    -- equipe que nao e admin: nada (equipe nao vira cliente)
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', '00000000-0000-0000-0000-0000000000e1', 'email', 'eq@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    ASSERT (SELECT count(*) FROM public.empresas_do_cliente()) = 0, 'equipe_nao_admin: equipe sem is_admin recebeu empresas';
    RESET ROLE;

    -- anon nao executa
    SET LOCAL ROLE anon;
    BEGIN
        PERFORM public.empresas_do_cliente();
        RAISE EXCEPTION 'anon_nao_executa: anon executou empresas_do_cliente()';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
END $$;
ROLLBACK;
