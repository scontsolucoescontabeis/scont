-- Testa public.montador_dados_empresa(p_codigo). Transacao com ROLLBACK.
-- Pressupoe: stub + fixtures 01/02 + schema_portal_cliente + guardas + bloqueio + admin + schema_montador_portal.
BEGIN;
DO $$
DECLARE r jsonb; ok boolean;
BEGIN
    INSERT INTO public.rh_empresas (codigo_empresa, nome_empresa, cnpj, uf, municipio) VALUES
        ('M-A', 'Zzmont Alfa Ltda', '11.222.333/0001-81', 'SP', 'Campinas'),
        ('M-B', 'Zzmont Beta Ltda', '22.333.444/0001-72', 'RJ', 'Niteroi'),
        ('M-C', 'Zzmont Vazia Ltda', '33.444.555/0001-63', 'MG', 'Uberaba');
    INSERT INTO public.rh_empregados (codigo_empresa, codigo_empregado, nome_empregado, desc_cargo, desc_funcao, situacao, tipo_empregado, cpf, salario, endereco) VALUES
        ('M-A','1','Zeca Zulu','Vendedor','Vend X','Trabalhando','Empregado','111.111.111-11',2000,'Rua 1'),
        ('M-A','2','Ana Alves',NULL,'Auxiliar','Trabalhando','Estagiário','222.222.222-22',1000,'Rua 2'),
        ('M-A','3','Demitido Dino','Gerente','G','Demitido','Empregado','333.333.333-33',3000,'Rua 3'),
        ('M-A','4','Socio Sol','Diretor','D','Trabalhando','Contribuinte','444.444.444-44',0,'Rua 4'),
        ('M-A','5','Sem Cargo',NULL,NULL,'Trabalhando','Empregado','555.555.555-55',1,'Rua 5'),
        ('M-B','9','Beto Beta','Caixa','C','Trabalhando','Empregado','999.999.999-99',1500,'Rua 9'),
        -- mesmo codigo_empregado '1' em outra empresa, demitido
        ('M-B','1','Zeca Outro','Gerente','G','Demitido','Empregado','123.123.123-12',1,'Rua B');
    INSERT INTO public.rh_jornada_trabalho (codigo_empresa, codigo_empregado, dia_semana, entrada, intervalo_inicio, intervalo_fim, saida) VALUES
        ('M-A','1','segunda','08:00','12:00','13:00','17:00'),
        ('M-A','2','terca','09:00','12:00','13:00','18:00'),
        ('M-B','9','sexta','08:00','12:00','13:00','17:00'),
        -- nao elegiveis em M-A (demitido 3, contribuinte 4)
        ('M-A','3','quarta','07:00','11:00','12:00','16:00'),
        ('M-A','4','quinta','07:00','11:00','12:00','16:00'),
        -- mesmo codigo '1', demitido em M-B
        ('M-B','1','sabado','06:00','10:00','11:00','15:00');
    INSERT INTO public.rh_ferias_calculadas (codigo_empresa, codigo_empregado, ferias_inicio, ferias_fim) VALUES
        ('M-A','1', current_date - 40, current_date - 10),
        ('M-A','2', current_date + 10, current_date + 40),
        ('M-A','3', current_date + 10, current_date + 40),
        ('M-A','4', current_date + 10, current_date + 40),
        ('M-B','1', current_date + 5,  current_date + 20),
        ('M-B','9', current_date + 7,  current_date + 21);
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ('00000000-0000-0000-0000-0000000000a1', 'a@cliente.test', '{"portal":"cliente","codigo_empresa":"M-A"}'),
        ('00000000-0000-0000-0000-0000000000b1', 'b@cliente.test', '{"portal":"cliente","codigo_empresa":"M-B"}'),
        ('00000000-0000-0000-0000-0000000000e1', 'eq@scont.test',  '{}'),
        ('00000000-0000-0000-0000-0000000000d1', 'adm@scont.test', '{}'),
        ('00000000-0000-0000-0000-0000000000f1', 'f@scont.test',   '{}');
    DELETE FROM public.usuarios WHERE id = '00000000-0000-0000-0000-0000000000f1';  -- sem linha em usuarios
    UPDATE public.usuarios SET is_admin = true WHERE id = '00000000-0000-0000-0000-0000000000d1';
    INSERT INTO public.solicitacoes_acesso (nome, email, status) VALUES ('Eq', 'eq@scont.test', 'aprovado');
    UPDATE public.cliente_acessos SET status = 'aprovado'
      WHERE usuario_id = '00000000-0000-0000-0000-0000000000a1';  -- B segue pendente

    -- cliente A aprovado
    PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000a1','email','a@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.montador_dados_empresa('M-A');
    ASSERT r->'empresa'->>'codigo_empresa' = 'M-A' AND r->'empresa'->>'nome_empresa' = 'Zzmont Alfa Ltda'
       AND r->'empresa'->>'uf' = 'SP' AND r->'empresa'->>'municipio' = 'Campinas',
       'cliente_le_so_a_propria: empresa incorreta: ' || (r->'empresa')::text;
    ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'jornadas') j WHERE j->>'codigo_empregado' = '9'),
       'cliente_le_so_a_propria: vazou jornada de outra empresa';
    ASSERT (SELECT array_agg(j->>'codigo_empregado' || ':' || (j->>'dia_semana') ORDER BY j->>'codigo_empregado') FROM jsonb_array_elements(r->'jornadas') j)
           = ARRAY['1:segunda','2:terca'],
       'jornadas_so_elegiveis_e_chave_dupla: jornadas de A: ' || (r->'jornadas')::text;
    -- so_trabalhando_empregado_estagiario (ordenado por nome: Ana, Sem Cargo, Zeca)
    ASSERT (SELECT array_agg(e->>'codigo_empregado') FROM jsonb_array_elements(r->'empregados') e) = ARRAY['2','5','1'],
       'so_trabalhando_empregado_estagiario: lista errada: ' || (r->'empregados')::text;
    -- sem_dados_pessoais: chaves exatas
    SELECT bool_and(k) INTO ok FROM (
        SELECT (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(e) key)
               = ARRAY['cargo','codigo_empregado','nome_empregado','tipo_empregado'] AS k
        FROM jsonb_array_elements(r->'empregados') e) s;
    ASSERT ok, 'sem_dados_pessoais: chaves de empregado diferentes do permitido: ' || (r->'empregados')::text;
    -- cargo_cai_para_funcao
    ASSERT (SELECT e->>'cargo' FROM jsonb_array_elements(r->'empregados') e WHERE e->>'codigo_empregado' = '2') = 'Auxiliar',
       'cargo_cai_para_funcao: nao caiu para desc_funcao';
    ASSERT (SELECT e->'cargo' FROM jsonb_array_elements(r->'empregados') e WHERE e->>'codigo_empregado' = '5') = 'null'::jsonb,
       'cargo_cai_para_funcao: sem cargo/funcao deveria ser null';
    -- ferias_passadas_fora
    ASSERT jsonb_array_length(r->'ferias') = 1 AND r->'ferias'->0->>'codigo_empregado' = '2',
       'ferias_so_elegiveis_e_passadas_fora: ferias: ' || (r->'ferias')::text;
    -- cliente_outra_empresa_42501
    BEGIN
        PERFORM public.montador_dados_empresa('M-B');
        RAISE EXCEPTION 'cliente_outra_empresa_42501: cliente leu outra empresa';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- codigo invalido/variacoes por nao-admin: sempre 42501
    DECLARE c text; falhou boolean;
    BEGIN
        FOREACH c IN ARRAY ARRAY[NULL, '', ' M-A', 'm-a', 'M-A '] LOOP
            falhou := false;
            BEGIN
                PERFORM public.montador_dados_empresa(c);
            EXCEPTION WHEN insufficient_privilege THEN falhou := true;
            END;
            ASSERT falhou, 'codigo_invalido_42501: aceitou ' || COALESCE('"' || c || '"', 'NULL');
        END LOOP;
    END;
    RESET ROLE;

    -- pendente_negado
    PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000b1','email','b@cliente.test')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM public.montador_dados_empresa('M-B');
        RAISE EXCEPTION 'pendente_negado: cliente pendente leu dados';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;

    -- equipe_sem_vinculo_negada
    PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000e1','email','eq@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM public.montador_dados_empresa('M-A');
        RAISE EXCEPTION 'equipe_sem_vinculo_negada: equipe sem is_admin leu dados';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;

    -- admin
    PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000d1','email','adm@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    r := public.montador_dados_empresa('M-B');
    ASSERT r->'empresa'->>'codigo_empresa' = 'M-B' AND jsonb_array_length(r->'empregados') = 1,
       'admin_le_qualquer: admin nao leu M-B: ' || r::text;
    -- chave dupla: em M-B o '1' e demitido; so entram dados do '9'
    ASSERT (SELECT array_agg(j->>'codigo_empregado') FROM jsonb_array_elements(r->'jornadas') j) = ARRAY['9']
       AND (SELECT array_agg(f->>'codigo_empregado') FROM jsonb_array_elements(r->'ferias') f) = ARRAY['9'],
       'jornadas_so_elegiveis_e_chave_dupla: dados de M-B: ' || r::text;
    r := public.montador_dados_empresa('M-C');
    ASSERT r->'empresa'->>'codigo_empresa' = 'M-C' AND r->'empregados' = '[]'::jsonb
       AND r->'jornadas' = '[]'::jsonb AND r->'ferias' = '[]'::jsonb,
       'empresa_sem_empregados_lista_vazia: ' || r::text;
    r := public.montador_dados_empresa('NAO-EXISTE');
    ASSERT r->'empresa' = 'null'::jsonb AND r->'empregados' = '[]'::jsonb,
       'empresa_inexistente_null: ' || r::text;
    RESET ROLE;

    -- usuario sem linha em usuarios (is_admin NULL/false) e sem vinculo: 42501
    PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000f1','email','f@scont.test')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM public.montador_dados_empresa('M-A');
        RAISE EXCEPTION 'sem_linha_usuarios_negado: usuario sem linha em usuarios leu dados';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;

    -- privilegios explicitos
    ASSERT NOT has_function_privilege('anon', 'public.montador_dados_empresa(text)', 'EXECUTE'),
       'anon_nao_executa: anon tem EXECUTE';
    ASSERT has_function_privilege('authenticated', 'public.montador_dados_empresa(text)', 'EXECUTE'),
       'grant_authenticated: authenticated sem EXECUTE';

    -- anon_nao_executa
    SET LOCAL ROLE anon;
    BEGIN
        PERFORM public.montador_dados_empresa('M-A');
        RAISE EXCEPTION 'anon_nao_executa: anon executou a funcao';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
END $$;
ROLLBACK;
