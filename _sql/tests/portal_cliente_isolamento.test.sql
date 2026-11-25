-- Teste de isolacao do portal do cliente (Parte 1). Tudo dentro de BEGIN/ROLLBACK.
BEGIN;

DO $$
DECLARE
    ua uuid := gen_random_uuid();   -- cliente A (T-A)
    ub uuid := gen_random_uuid();   -- cliente B (T-B)
    uc uuid := gen_random_uuid();   -- empresa inexistente
    ud uuid := gen_random_uuid();   -- sem codigo_empresa
    uadm uuid := gen_random_uuid(); -- admin
    ueq uuid := gen_random_uuid();  -- equipe via solicitacoes_acesso
    n int;
    arr text[];
    r record;
BEGIN
    INSERT INTO public.rh_empresas (codigo_empresa, nome_empresa, cnpj) VALUES
        ('T-A', 'Zzteste Alfa Comercio Ltda', '11.222.333/0001-81'),
        ('T-B', 'Zzteste Beta Servicos Ltda',  '99.888.777/0001-66');

    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        (ua, 'a@cliente.test', '{"portal":"cliente","codigo_empresa":"T-A"}'),
        (ub, 'b@cliente.test', '{"portal":"cliente","codigo_empresa":"T-B"}'),
        (uc, 'c@cliente.test', '{"portal":"cliente","codigo_empresa":"NAO-EXISTE"}'),
        (ud, 'd@cliente.test', '{"portal":"cliente"}'),
        (uadm, 'adm@scont.test', '{}'),
        (ueq, 'eq@scont.test', '{}');
    UPDATE public.usuarios SET is_admin = true WHERE id = uadm;

    -- cadastro_cria_pedido_pendente
    SELECT count(*) INTO n FROM public.cliente_acessos
      WHERE usuario_id = ua AND codigo_empresa = 'T-A' AND status = 'pendente';
    ASSERT n = 1, 'cadastro_cria_pedido_pendente: A sem pedido pendente';
    SELECT count(*) INTO n FROM public.cliente_acessos
      WHERE usuario_id = ub AND codigo_empresa = 'T-B' AND status = 'pendente';
    ASSERT n = 1, 'cadastro_cria_pedido_pendente: B sem pedido pendente';

    -- cadastro_empresa_inexistente_nao_quebra
    SELECT count(*) INTO n FROM public.cliente_usuarios WHERE id IN (uc, ud);
    ASSERT n = 2, 'cadastro_empresa_inexistente_nao_quebra: cliente_usuarios nao criado';
    SELECT count(*) INTO n FROM public.cliente_acessos WHERE usuario_id IN (uc, ud);
    ASSERT n = 0, 'cadastro_empresa_inexistente_nao_quebra: criou acesso indevido';

    -- pedido_duplicado_ignorado
    INSERT INTO public.cliente_acessos (usuario_id, codigo_empresa) VALUES (ua, 'T-A')
      ON CONFLICT DO NOTHING;
    SELECT count(*) INTO n FROM public.cliente_acessos WHERE usuario_id = ua AND codigo_empresa = 'T-A';
    ASSERT n = 1, 'pedido_duplicado_ignorado: duplicou pedido';

    -- === como cliente A ===
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ua, 'email', 'a@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;

    UPDATE public.cliente_acessos SET status = 'aprovado';
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 0, 'cliente_nao_se_aprova: cliente conseguiu alterar status';

    SELECT count(*) INTO n FROM public.cliente_acessos;
    ASSERT n = 1, 'cliente_ve_so_o_proprio: cliente_acessos visivel != 1';
    SELECT count(*) INTO n FROM public.cliente_usuarios;
    ASSERT n = 1, 'cliente_ve_so_o_proprio: cliente_usuarios visivel != 1';

    SELECT array_agg(x) INTO arr FROM public.empresas_do_cliente() x;
    ASSERT arr IS NULL, 'empresas_do_cliente_so_aprovadas: pendente deveria ser vazio';

    ASSERT public.eh_equipe() = false, 'eh_equipe_admin_e_aprovado: cliente deveria ser false';
    RESET ROLE;

    -- === admin aprova ===
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', uadm, 'email', 'adm@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.cliente_acessos WHERE usuario_id IN (ua, ub);
    ASSERT n = 2, 'admin_aprova_e_ve_todos: admin nao ve os 2 pedidos';
    UPDATE public.cliente_acessos SET status = 'aprovado' WHERE usuario_id = ua;
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 1, 'admin_aprova_e_ve_todos: admin nao conseguiu aprovar';
    ASSERT public.eh_equipe() = true, 'eh_equipe_admin_e_aprovado: admin deveria ser true';
    RESET ROLE;

    -- === A apos aprovacao (mesma sessao) ===
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ua, 'email', 'a@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT array_agg(x) INTO arr FROM public.empresas_do_cliente() x;
    ASSERT arr = ARRAY['T-A'], 'empresas_do_cliente_so_aprovadas: aprovado deveria ser {T-A}';
    RESET ROLE;

    -- === admin revoga ===
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', uadm, 'email', 'adm@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.cliente_acessos SET status = 'revogado' WHERE usuario_id = ua;
    RESET ROLE;

    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ua, 'email', 'a@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT array_agg(x) INTO arr FROM public.empresas_do_cliente() x;
    ASSERT arr IS NULL, 'empresas_do_cliente_so_aprovadas: revogado deveria ser vazio';
    RESET ROLE;

    -- === busca publica como anon ===
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO n FROM public.buscar_empresas_publico('ab');
    ASSERT n = 0, 'busca_publica_exige_minimo: texto de 2 caracteres retornou linhas';
    SELECT count(*) INTO n FROM public.buscar_empresas_publico('T-A');
    ASSERT n = 0, 'busca_publica_exige_minimo: texto de 3 caracteres retornou linhas';
    SELECT count(*) INTO n FROM public.buscar_empresas_publico('Zzteste Alfa');
    ASSERT n = 1, 'busca_publica_exige_minimo: busca por nome (4+) nao achou';
    SELECT count(*) INTO n FROM public.buscar_empresas_publico('11222333000181');
    ASSERT n = 1, 'busca_publica_exige_minimo: busca por CNPJ so digitos nao achou';
    SELECT count(*) INTO n FROM public.buscar_empresas_publico('11.222.333/0001-81');
    ASSERT n = 1, 'busca_publica_exige_minimo: busca por CNPJ formatado nao achou';
    SELECT * INTO r FROM public.buscar_empresas_publico('Zzteste Alfa');
    ASSERT r.codigo_empresa = 'T-A' AND r.nome_empresa = 'Zzteste Alfa Comercio Ltda',
        'busca_publica_exige_minimo: colunas incorretas';
    SELECT count(*) INTO n FROM public.buscar_empresas_publico('Zzteste');
    ASSERT n <= 8, 'busca_publica_exige_minimo: mais de 8 linhas';
    -- anon nao le tabelas novas
    BEGIN
        PERFORM 1 FROM public.cliente_acessos;
        ASSERT false, 'anon_sem_acesso_tabelas: anon leu cliente_acessos';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;

    -- === eh_equipe com solicitacoes_acesso ===
    INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES ('Eq', 'EQ@scont.test', 'pendente');
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ueq, 'email', 'eq@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    ASSERT public.eh_equipe() = false, 'eh_equipe_admin_e_aprovado: pendente deveria ser false';
    RESET ROLE;
    UPDATE public.solicitacoes_acesso SET status = 'aprovado' WHERE email = 'EQ@scont.test';
    SET LOCAL ROLE authenticated;
    ASSERT public.eh_equipe() = true, 'eh_equipe_admin_e_aprovado: aprovado deveria ser true';
    RESET ROLE;
END $$;

-- =====================================================================
-- Task 2: bloqueio nas tabelas atuais (politica restritiva somente-equipe)
-- =====================================================================
DO $$
DECLARE
    ua uuid := gen_random_uuid();   -- cliente A aprovado
    uav uuid := gen_random_uuid();  -- cadastro avulso (sem metadados nem solicitacao)
    ueq uuid := gen_random_uuid();  -- equipe via solicitacoes_acesso
    ueqc uuid := gen_random_uuid(); -- equipe que tambem e cliente
    upend uuid := gen_random_uuid(); -- cadastro de equipe pendente
    n int;
    arr text[];
    r record;
BEGIN
    -- rh_empresas T-A ja foi inserida no bloco anterior (mesma transacao)
    INSERT INTO public.rh_socios (codigo_empresa, nome) VALUES ('T-A', 'Socio Teste');
    INSERT INTO public.fixture_formulario_anon (conteudo) VALUES ('publico');
    INSERT INTO public.fixture_sem_rls (valor) VALUES ('x');

    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        (ua,   'a2@cliente.test',  '{"portal":"cliente","codigo_empresa":"T-A"}'),
        (uav,  'avulso@x.test',    '{}'),
        (ueq,  'eq2@scont.test',   '{}'),
        (ueqc, 'eqc@scont.test',   '{"portal":"cliente","codigo_empresa":"T-A"}');
    INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES
        ('Eq2', 'eq2@scont.test', 'aprovado'),
        ('EqC', 'EQC@scont.test', 'aprovado');
    UPDATE public.cliente_acessos SET status = 'aprovado' WHERE usuario_id IN (ua, ueqc);

    -- cliente_nao_le_tabela_atual (inclui vinculo APROVADO a T-A)
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ua, 'email', 'a2@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT array_agg(x) INTO arr FROM public.empresas_do_cliente() x;
    ASSERT arr = ARRAY['T-A'], 'cliente_nao_le_tabela_atual: setup, A deveria estar aprovado';
    SELECT count(*) INTO n FROM public.rh_empresas;
    ASSERT n = 0, 'cliente_nao_le_tabela_atual: cliente leu rh_empresas';
    SELECT count(*) INTO n FROM public.rh_socios;
    ASSERT n = 0, 'cliente_nao_le_tabela_atual: cliente leu rh_socios';
    SELECT count(*) INTO n FROM public.usuarios;
    ASSERT n = 1, 'cliente_le_so_proprio_usuarios: esperado 1 (propria linha, aceitavel), veio '||n;
    SELECT count(*) INTO n FROM public.solicitacoes_acesso;
    ASSERT n = 0, 'cliente_nao_le_tabela_atual: cliente leu solicitacoes_acesso de outros';
    BEGIN
        INSERT INTO public.rh_empresas (codigo_empresa, nome_empresa) VALUES ('T-X', 'Invasor');
        ASSERT false, 'cliente_nao_le_tabela_atual: cliente conseguiu INSERT em rh_empresas';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    UPDATE public.rh_empresas SET nome_empresa = 'hack';
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 0, 'cliente_nao_le_tabela_atual: cliente conseguiu UPDATE em rh_empresas';
    DELETE FROM public.rh_socios;
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 0, 'cliente_nao_le_tabela_atual: cliente conseguiu DELETE em rh_socios';
    RESET ROLE;

    -- cadastro_avulso_nao_le_tabela_atual
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', uav, 'email', 'avulso@x.test')::text, true);
    SET LOCAL ROLE authenticated;
    ASSERT public.eh_equipe() = false, 'cadastro_avulso_nao_le_tabela_atual: avulso deveria ser nao-equipe';
    SELECT count(*) INTO n FROM public.rh_empresas;
    ASSERT n = 0, 'cadastro_avulso_nao_le_tabela_atual: avulso leu rh_empresas';
    RESET ROLE;

    -- equipe_continua_lendo
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ueq, 'email', 'eq2@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.rh_empresas;
    ASSERT n >= 1, 'equipe_continua_lendo: equipe nao leu rh_empresas';
    SELECT count(*) INTO n FROM public.rh_socios;
    ASSERT n = 1, 'equipe_continua_lendo: equipe nao leu rh_socios';
    INSERT INTO public.rh_socios (codigo_empresa, nome) VALUES ('T-A', 'Novo');
    RESET ROLE;

    -- email_igual_cliente_equipe
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ueqc, 'email', 'eqc@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    ASSERT public.eh_equipe() = true, 'email_igual_cliente_equipe: deveria ser equipe';
    SELECT count(*) INTO n FROM public.rh_empresas;
    ASSERT n >= 1, 'email_igual_cliente_equipe: nao leu rh_empresas';
    RESET ROLE;

    -- tabelas SECURITY DEFINER continuam funcionando apos o bloqueio
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO n FROM public.buscar_empresas_publico('Zzteste Alfa');
    ASSERT n = 1, 'definer_apos_bloqueio: buscar_empresas_publico quebrou para anon';
    RESET ROLE;
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ua, 'email', 'a2@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.buscar_empresas_publico('Zzteste Alfa');
    ASSERT n = 1, 'definer_apos_bloqueio: buscar_empresas_publico quebrou para cliente';
    SELECT array_agg(x) INTO arr FROM public.empresas_do_cliente() x;
    ASSERT arr = ARRAY['T-A'], 'definer_apos_bloqueio: empresas_do_cliente quebrou';
    RESET ROLE;

    -- anon_inalterado: politica restritiva e so TO authenticated
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    SELECT count(*) INTO n FROM public.fixture_formulario_anon;
    ASSERT n = 1, 'anon_inalterado: anon perdeu leitura em tabela com politica anon';
    RESET ROLE;

    -- === usuario pendente (cadastro de equipe, ainda nao aprovado) ===
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (upend, 'pend@scont.test', '{}');
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', upend, 'email', 'Pend@Scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    ASSERT public.eh_equipe() = false, 'pendente: deveria ser nao-equipe';
    INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES ('Pend', 'pend@scont.test', 'pendente');
    SELECT count(*) INTO n FROM public.solicitacoes_acesso;
    ASSERT n = 1, 'pendente_le_so_a_propria: esperado 1 (ha outras linhas), veio '||n;
    SELECT count(*) INTO n FROM public.solicitacoes_acesso WHERE email = 'pend@scont.test';
    ASSERT n = 1, 'pendente_le_so_a_propria: nao leu a propria';
    UPDATE public.solicitacoes_acesso SET status = 'aprovado' WHERE email <> 'pend@scont.test';
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 0, 'pendente_nao_altera_outras: UPDATE afetou '||n;
    DELETE FROM public.solicitacoes_acesso WHERE email <> 'pend@scont.test';
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 0, 'pendente_nao_altera_outras: DELETE afetou '||n;
    BEGIN
        UPDATE public.solicitacoes_acesso SET status = 'aprovado' WHERE email = 'pend@scont.test';
        ASSERT false, 'pendente_nao_se_aprova: UPDATE para aprovado passou';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES ('X', 'x1@scont.test', 'aprovado');
        ASSERT false, 'pendente_nao_insere_aprovado: INSERT aprovado passou';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES ('X', 'outro@scont.test', 'pendente');
        ASSERT false, 'pendente_nao_insere_alheio: INSERT com e-mail alheio passou';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    SELECT count(*) INTO n FROM public.usuarios;
    ASSERT n = 1, 'pendente_usuarios_so_proprio: esperado 1, veio '||n;
    SELECT count(*) INTO n FROM public.usuarios WHERE id <> upend;
    ASSERT n = 0, 'pendente_usuarios_so_proprio: leu linha alheia';
    UPDATE public.usuarios SET nome = 'hack' WHERE id <> upend;
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 0, 'pendente_usuarios_so_proprio: alterou linha alheia';
    RESET ROLE;

    -- equipe ve todas as solicitacoes e usuarios
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', ueq, 'email', 'eq2@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.solicitacoes_acesso;
    ASSERT n >= 3, 'equipe_ve_solicitacoes: veio '||n;
    SELECT count(*) INTO n FROM public.usuarios;
    ASSERT n >= 4, 'equipe_ve_usuarios: veio '||n;
    RESET ROLE;

    -- tabela sem RLS permanece intocada
    SELECT count(*) INTO n FROM pg_policies
      WHERE tablename = 'fixture_sem_rls' AND policyname = 'portal_cliente: somente equipe';
    ASSERT n = 0, 'sem_rls_intocada: politica criada em tabela sem RLS';
    SELECT rowsecurity INTO r FROM pg_tables WHERE tablename = 'fixture_sem_rls';
    ASSERT r.rowsecurity = false, 'sem_rls_intocada: RLS foi ligada sozinha';
END $$;

ROLLBACK;
