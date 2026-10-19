-- Projeto PDI/tests/renovar_pdi.sql
-- Renovação de PDI (PDI do ano seguinte ligado ao anterior). NÃO rodar em produção (cria usuários/PDI de teste).
-- Uso: psql -f tests/renovar_pdi.sql  (Postgres descartável com stubs de auth/storage + schema_pdi.sql + seed)
\set ON_ERROR_STOP on
RESET ROLE;
TRUNCATE public.pdi_auditoria, public.pdis, public.pdi_socios, public.usuarios CASCADE;
INSERT INTO public.usuarios (id, nome, email, is_admin) VALUES
 ('00000000-0000-0000-0000-0000000000a1', 'Admin',  'a@x', true),
 ('00000000-0000-0000-0000-0000000000c1', 'Gestor', 'g@x', false),
 ('00000000-0000-0000-0000-0000000000d1', 'Colab',  'c@x', false);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);

DO $$
DECLARE v_pdi UUID; v_av UUID;
BEGIN
    v_pdi := public.pdi_criar_a_partir_do_modelo((SELECT id FROM public.pdi_modelos LIMIT 1),
        '00000000-0000-0000-0000-0000000000d1', 'Colab', 'Assistente', '2026-09-08',
        '00000000-0000-0000-0000-0000000000c1', 'Gestor', '2026-10-07');
    PERFORM set_config('pdi.id', v_pdi::text, false);
    UPDATE public.pdis SET contexto_desenvolvimento = 'contexto X',
        perfil_comportamental = '{"disc":"S","arquivo":"abc/relatorio.pdf"}'::jsonb WHERE id = v_pdi;
    -- ficha 1 concluída e ficha 4 concluída com prioridades
    INSERT INTO public.pdi_avaliacoes_trimestrais (pdi_id, ciclo_numero, prioridades_proximo_ciclo)
        VALUES (v_pdi, 4, E'- Conferir folha antes do fechamento\r\n\n2) Documentar rotina de rescisão\n• Revisar benefícios') RETURNING id INTO v_av;
    INSERT INTO public.pdi_avaliacao_pilares (pdi_id, avaliacao_id, pilar, nota_ciclo)
        SELECT v_pdi, v_av, p, 3 FROM unnest(ARRAY['tecnicas','comportamentais','performance','melhorias']) p;
    INSERT INTO public.pdi_ciencias (pdi_id, referencia, referencia_id, papel, nome)
        SELECT v_pdi, 'avaliacao', v_av, p, p FROM unnest(ARRAY['colaborador','gestor','diretoria']) p;
    UPDATE public.pdi_avaliacoes_trimestrais SET status = 'concluida', resultado = 'dentro', direcionamentos = ARRAY['manutencao'] WHERE id = v_av;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.eu(p_uid TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', p_uid, false); END $$;
CREATE OR REPLACE FUNCTION pg_temp.deve_falhar(p_sql TEXT, p_msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'OK  % (bloqueado: %)', p_msg, SQLERRM; RETURN; END;
    RAISE EXCEPTION 'FALHOU: % — deveria ter sido bloqueado', p_msg;
END $$;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

SET ROLE authenticated;
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000d1');
SELECT pg_temp.deve_falhar($q$SELECT public.pdi_renovar(current_setting('pdi.id')::uuid)$q$, 'colaborador não renova PDI');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.deve_falhar($q$SELECT public.pdi_renovar(current_setting('pdi.id')::uuid)$q$, 'gestor não renova PDI');

SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000a1');
SELECT set_config('pdi.novo', public.pdi_renovar(current_setting('pdi.id')::uuid)::text, false);
SELECT pg_temp.deve_falhar($q$SELECT public.pdi_renovar(current_setting('pdi.id')::uuid)$q$, 'PDI não é renovado duas vezes');

RESET ROLE;
DO $$
DECLARE n INTEGER; v pdis;
BEGIN
    SELECT * INTO v FROM public.pdis WHERE id = current_setting('pdi.novo')::uuid;
    IF v.pdi_anterior_id IS DISTINCT FROM current_setting('pdi.id')::uuid THEN RAISE EXCEPTION 'FALHOU: pdi_anterior_id'; END IF;
    IF v.data_inicio <> DATE '2027-10-07' THEN RAISE EXCEPTION 'FALHOU: D do novo PDI = % (esperado 2027-10-07)', v.data_inicio; END IF;
    IF v.colaborador_user_id <> '00000000-0000-0000-0000-0000000000d1' OR v.gestor_user_id <> '00000000-0000-0000-0000-0000000000c1' THEN
        RAISE EXCEPTION 'FALHOU: vínculos de colaborador/gestor não foram mantidos';
    END IF;
    RAISE NOTICE 'OK  novo PDI ligado ao anterior, D = fim do anterior, mesmos vínculos';
    IF v.contexto_desenvolvimento <> 'contexto X' OR v.perfil_comportamental ->> 'disc' <> 'S' THEN
        RAISE EXCEPTION 'FALHOU: contexto/perfil não copiados';
    END IF;
    IF v.perfil_comportamental ? 'arquivo' THEN RAISE EXCEPTION 'FALHOU: o anexo do relatório não deveria ser copiado'; END IF;
    RAISE NOTICE 'OK  contexto e perfil copiados, sem o anexo do relatório';
    SELECT count(*) INTO n FROM public.pdi_acoes WHERE pdi_id = v.id AND origem = 'ficha_trimestral' AND ciclo = 1
       AND prazo_dias = (DATE '2028-01-07' - 1) - DATE '2027-10-07';   -- vence no último dia do ciclo 1
    IF n <> 3 THEN RAISE EXCEPTION 'FALHOU: % ações vindas das prioridades (esperado 3)', n; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.pdi_acoes WHERE pdi_id = v.id AND foco_acao = 'Documentar rotina de rescisão')
       OR NOT EXISTS (SELECT 1 FROM public.pdi_acoes WHERE pdi_id = v.id AND foco_acao = 'Conferir folha antes do fechamento') THEN
        RAISE EXCEPTION 'FALHOU: marcadores/linhas não foram limpos';
    END IF;
    RAISE NOTICE 'OK  prioridades da última ficha concluída viraram 3 ações do ciclo 1';
    SELECT count(*) INTO n FROM public.pdi_ciclos WHERE pdi_id = v.id;
    IF n <> 4 THEN RAISE EXCEPTION 'FALHOU: ciclos do novo PDI'; END IF;
END $$;

-- excluir o PDI anterior não derruba o novo (a ligação vira nula)
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000a1');
SET ROLE authenticated;
SELECT public.pdi_excluir(current_setting('pdi.id')::uuid);
RESET ROLE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.pdis WHERE id = current_setting('pdi.novo')::uuid AND pdi_anterior_id IS NULL) THEN
        RAISE EXCEPTION 'FALHOU: novo PDI deveria sobreviver à exclusão do anterior';
    END IF;
    RAISE NOTICE 'OK  excluir o anterior mantém o novo (ligação some)';
END $$;
SELECT 'RENOVAR: TODOS OS TESTES PASSARAM' AS resultado;
