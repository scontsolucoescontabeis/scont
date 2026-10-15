-- Projeto PDI/tests/excluir_pdi.sql
-- Exclusão de PDI pelo administrador. NÃO rodar em produção (cria usuários/PDI de teste).
-- Uso: psql -f tests/excluir_pdi.sql  (Postgres descartável com stubs de auth/storage + schema_pdi.sql + seed)
\set ON_ERROR_STOP on
RESET ROLE;
TRUNCATE public.pdi_auditoria, public.pdis, public.pdi_socios, public.usuarios CASCADE;
INSERT INTO public.usuarios (id, nome, email, is_admin) VALUES
 ('00000000-0000-0000-0000-0000000000a1', 'Admin',  'a@x', true),
 ('00000000-0000-0000-0000-0000000000b1', 'Socio',  's@x', false),
 ('00000000-0000-0000-0000-0000000000c1', 'Gestor', 'g@x', false),
 ('00000000-0000-0000-0000-0000000000d1', 'Colab',  'c@x', false);
INSERT INTO public.pdi_socios (usuario_id, nome) VALUES ('00000000-0000-0000-0000-0000000000b1', 'Socio');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);  -- preparação como admin

DO $$
DECLARE v_pdi UUID; v_av UUID;
BEGIN
    v_pdi := public.pdi_criar_a_partir_do_modelo((SELECT id FROM public.pdi_modelos LIMIT 1),
        '00000000-0000-0000-0000-0000000000d1', 'Colab', 'Assistente', '2026-09-08',
        '00000000-0000-0000-0000-0000000000c1', 'Gestor', '2026-10-07');
    PERFORM set_config('pdi.id', v_pdi::text, false);
    INSERT INTO public.pdi_avaliacoes_trimestrais (pdi_id, ciclo_numero) VALUES (v_pdi, 1) RETURNING id INTO v_av;
    INSERT INTO public.pdi_avaliacao_pilares (pdi_id, avaliacao_id, pilar, nota_ciclo)
        SELECT v_pdi, v_av, p, 2 FROM unnest(ARRAY['tecnicas','comportamentais','performance','melhorias']) p;
    INSERT INTO public.pdi_ciencias (pdi_id, referencia, referencia_id, papel, nome)
        SELECT v_pdi, 'avaliacao', v_av, p, p FROM unnest(ARRAY['colaborador','gestor','diretoria']) p;
    UPDATE public.pdi_avaliacoes_trimestrais SET status = 'concluida', resultado = 'parcial', direcionamentos = ARRAY['manutencao'] WHERE id = v_av;
    INSERT INTO public.pdi_feedbacks (pdi_id, autor_id, autor_papel, texto) VALUES (v_pdi, '00000000-0000-0000-0000-0000000000b1', 'socio', 'ok');
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
SELECT pg_temp.deve_falhar($q$SELECT public.pdi_excluir(current_setting('pdi.id')::uuid)$q$, 'colaborador não exclui PDI');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.deve_falhar($q$SELECT public.pdi_excluir(current_setting('pdi.id')::uuid)$q$, 'gestor não exclui PDI');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000b1');
SELECT pg_temp.deve_falhar($q$SELECT public.pdi_excluir(current_setting('pdi.id')::uuid)$q$, 'sócio não exclui PDI');
SELECT pg_temp.deve_falhar($q$DELETE FROM public.pdi_avaliacoes_trimestrais$q$, 'ficha concluída não é apagada diretamente');

SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000a1');
SELECT public.pdi_excluir(current_setting('pdi.id')::uuid);

RESET ROLE;
DO $$
DECLARE n INTEGER;
BEGIN
    SELECT (SELECT count(*) FROM public.pdis) + (SELECT count(*) FROM public.pdi_acoes) + (SELECT count(*) FROM public.pdi_ciclos)
         + (SELECT count(*) FROM public.pdi_avaliacoes_trimestrais) + (SELECT count(*) FROM public.pdi_avaliacao_pilares)
         + (SELECT count(*) FROM public.pdi_ciencias) + (SELECT count(*) FROM public.pdi_feedbacks)
         + (SELECT count(*) FROM public.pdi_competencias_tecnicas) + (SELECT count(*) FROM public.pdi_indicadores) INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: sobraram % linhas dependentes', n; END IF;
    RAISE NOTICE 'OK  admin excluiu o PDI e todos os dependentes (inclusive ficha concluída)';
    IF NOT EXISTS (SELECT 1 FROM public.pdi_auditoria WHERE tabela = 'pdis' AND acao = 'DELETE' AND antes ->> 'colaborador_nome' = 'Colab') THEN
        RAISE EXCEPTION 'FALHOU: auditoria não registrou a exclusão';
    END IF;
    RAISE NOTICE 'OK  auditoria preservou o registro do PDI excluído';
END $$;
SELECT 'EXCLUSAO: TODOS OS TESTES PASSARAM' AS resultado;
