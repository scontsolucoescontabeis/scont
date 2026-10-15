-- Projeto PDI/tests/rls_pdi.sql
-- Testa RLS e regras do banco do módulo PDI. NÃO rodar em produção:
-- cria usuários/PDI de teste. Use um Postgres descartável com stubs de auth/storage.
-- Uso: psql -f tests/rls_pdi.sql  (falha com EXCEPTION no primeiro teste que não passar)

\set ON_ERROR_STOP on
RESET ROLE;
TRUNCATE public.pdi_auditoria, public.pdis, public.pdi_socios, public.usuarios CASCADE;

INSERT INTO public.usuarios (id, nome, email, is_admin) VALUES
 ('00000000-0000-0000-0000-0000000000a1', 'Admin',  'a@x', true),
 ('00000000-0000-0000-0000-0000000000b1', 'Socio',  's@x', false),
 ('00000000-0000-0000-0000-0000000000c1', 'Gestor', 'g@x', false),
 ('00000000-0000-0000-0000-0000000000d1', 'Colab',  'c@x', false),
 ('00000000-0000-0000-0000-0000000000e1', 'Outro',  'o@x', false);
INSERT INTO public.pdi_socios (usuario_id, nome) VALUES ('00000000-0000-0000-0000-0000000000b1', 'Socio');

DO $$
DECLARE v_modelo UUID; v_pdi UUID;
BEGIN
    SELECT id INTO v_modelo FROM public.pdi_modelos LIMIT 1;
    v_pdi := public.pdi_criar_a_partir_do_modelo(v_modelo, '00000000-0000-0000-0000-0000000000d1', 'Colab',
             'Assistente', '2026-09-08', '00000000-0000-0000-0000-0000000000c1', 'Gestor', '2026-10-07');
    PERFORM set_config('pdi.id', v_pdi::text, false);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.eu(p_uid TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', p_uid, false);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.deve_falhar(p_sql TEXT, p_msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'OK  % (bloqueado: %)', p_msg, SQLERRM;
        RETURN;
    END;
    RAISE EXCEPTION 'FALHOU: % — deveria ter sido bloqueado', p_msg;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.deve_afetar_zero(p_sql TEXT, p_msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE n INTEGER;
BEGIN
    BEGIN
        EXECUTE p_sql;
        GET DIAGNOSTICS n = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'OK  % (erro: %)', p_msg, SQLERRM;
        RETURN;
    END;
    IF n > 0 THEN RAISE EXCEPTION 'FALHOU: % — afetou % linha(s)', p_msg, n; END IF;
    RAISE NOTICE 'OK  % (0 linhas afetadas pela RLS)', p_msg;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.deve_ser(p_sql TEXT, p_esperado TEXT, p_msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE r TEXT;
BEGIN
    EXECUTE p_sql INTO r;
    IF r IS DISTINCT FROM p_esperado THEN
        RAISE EXCEPTION 'FALHOU: % — esperado %, obtido %', p_msg, p_esperado, r;
    END IF;
    RAISE NOTICE 'OK  %', p_msg;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;
SELECT set_config('pdi.id', current_setting('pdi.id'), false);

-- ===== visibilidade =====
SET ROLE authenticated;
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000e1');
SELECT pg_temp.deve_ser('SELECT count(*)::text FROM public.pdis', '0', 'estranho não vê PDI');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000d1');
SELECT pg_temp.deve_ser('SELECT count(*)::text FROM public.pdis', '1', 'colaborador vê o seu PDI');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.deve_ser('SELECT count(*)::text FROM public.pdis', '1', 'gestor vê o PDI do liderado');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000b1');
SELECT pg_temp.deve_ser('SELECT count(*)::text FROM public.pdis', '1', 'sócio vê todos');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.deve_ser('SELECT count(*)::text FROM public.pdis', '1', 'admin vê todos');

-- ===== colaborador não altera avaliação =====
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000d1');
SELECT pg_temp.deve_falhar(
 $q$INSERT INTO public.pdi_avaliacoes_comportamentais (pdi_id, competencia_id, nota)
    SELECT pdi_id, id, 4 FROM public.pdi_competencias_comportamentais LIMIT 1$q$,
 'colaborador não registra nota comportamental');
SELECT pg_temp.deve_falhar(
 $q$INSERT INTO public.pdi_feedbacks (pdi_id, autor_papel, texto)
    VALUES (current_setting('pdi.id')::uuid, 'gestor', 'oi')$q$,
 'colaborador não escreve feedback');
SELECT pg_temp.deve_falhar(
 $q$INSERT INTO public.pdi_socios (usuario_id, nome) VALUES (gen_random_uuid(), 'x')$q$,
 'colaborador não se torna sócio');

-- nível registrado por colaborador nunca nasce validado
INSERT INTO public.pdi_niveis_tecnicos (pdi_id, competencia_tecnica_id, nivel, validado_em)
SELECT pdi_id, id, 2, NOW() FROM public.pdi_competencias_tecnicas ORDER BY ordem LIMIT 1;
SELECT pg_temp.deve_ser('SELECT (validado_em IS NULL)::text FROM public.pdi_niveis_tecnicos LIMIT 1', 'true',
                        'nível do colaborador nasce não validado');

-- melhoria: colaborador registra, não valida
INSERT INTO public.pdi_melhorias (pdi_id, rotina, situacao_anterior, melhoria_evidencia)
VALUES (current_setting('pdi.id')::uuid, 'Ponto', 'antes', 'depois');
SELECT pg_temp.deve_falhar(
 $q$UPDATE public.pdi_melhorias SET validacao_gestor = 'validado'$q$,
 'colaborador não valida a própria melhoria');

-- ação: colaborador só muda status
UPDATE public.pdi_acoes SET status = 'em_andamento' WHERE ordem = 1;
SELECT pg_temp.deve_falhar($q$UPDATE public.pdi_acoes SET foco_acao = 'x' WHERE ordem = 1$q$,
 'colaborador não reescreve a ação');

-- ===== gestor valida =====
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000c1');
UPDATE public.pdi_melhorias SET validacao_gestor = 'validado', comentario_gestor = 'ok';
SELECT pg_temp.deve_ser('SELECT (validado_em IS NOT NULL AND validado_por IS NOT NULL)::text FROM public.pdi_melhorias',
                        'true', 'validação do gestor carimba autor e data');
UPDATE public.pdi_niveis_tecnicos SET validado_em = NOW();
SELECT pg_temp.deve_ser('SELECT (validado_por IS NOT NULL)::text FROM public.pdi_niveis_tecnicos', 'true',
                        'validação de nível carimba o validador');

-- ===== feedback =====
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.pdi_feedbacks (pdi_id, autor_papel, autor_nome, texto)
VALUES (current_setting('pdi.id')::uuid, 'socio', 'Socio', 'Bom avanço.');
SELECT pg_temp.deve_afetar_zero($q$UPDATE public.pdi_feedbacks SET texto = 'alterado'$q$, 'feedback é imutável');
SELECT pg_temp.deve_afetar_zero($q$DELETE FROM public.pdi_feedbacks$q$, 'feedback não é apagado');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000d1');
SELECT pg_temp.deve_ser('SELECT count(*)::text FROM public.pdi_feedbacks', '1', 'colaborador lê os feedbacks recebidos');
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000e1');
SELECT pg_temp.deve_ser('SELECT count(*)::text FROM public.pdi_feedbacks', '0', 'estranho não lê feedbacks');

-- ===== ficha trimestral =====
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000c1');
INSERT INTO public.pdi_avaliacoes_trimestrais (pdi_id, ciclo_numero) VALUES (current_setting('pdi.id')::uuid, 1);
SELECT pg_temp.deve_falhar(
 $q$INSERT INTO public.pdi_avaliacao_pilares (pdi_id, avaliacao_id, pilar, na)
    SELECT pdi_id, id, 'tecnicas', true FROM public.pdi_avaliacoes_trimestrais$q$,
 'N/A sem justificativa é recusado');
INSERT INTO public.pdi_avaliacao_pilares (pdi_id, avaliacao_id, pilar, nota_inicial, nota_ciclo, na, justificativa_na)
SELECT pdi_id, id, p, 1, 2, false, NULL FROM public.pdi_avaliacoes_trimestrais,
       unnest(ARRAY['tecnicas','comportamentais','melhorias']) p;
INSERT INTO public.pdi_avaliacao_pilares (pdi_id, avaliacao_id, pilar, na, justificativa_na)
SELECT pdi_id, id, 'performance', true, 'Sem medição no ciclo' FROM public.pdi_avaliacoes_trimestrais;

SELECT pg_temp.deve_falhar(
 $q$UPDATE public.pdi_avaliacoes_trimestrais SET status = 'concluida', resultado = 'parcial',
    direcionamentos = ARRAY['manutencao']$q$,
 'ficha não conclui sem as 3 ciências');

-- colaborador só escreve considerações
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000d1');
UPDATE public.pdi_avaliacoes_trimestrais SET consideracoes_colaborador = 'Aprendi muito.';
SELECT pg_temp.deve_falhar($q$UPDATE public.pdi_avaliacoes_trimestrais SET resultado = 'acima'$q$,
 'colaborador não define o resultado');

-- ciências: papel precisa bater com o vínculo
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.deve_falhar(
 $q$INSERT INTO public.pdi_ciencias (pdi_id, referencia, referencia_id, papel, nome)
    SELECT pdi_id, 'avaliacao', id, 'diretoria', 'Gestor' FROM public.pdi_avaliacoes_trimestrais$q$,
 'gestor não assina como Diretoria');
INSERT INTO public.pdi_ciencias (pdi_id, referencia, referencia_id, papel, nome)
SELECT pdi_id, 'avaliacao', id, 'gestor', 'Gestor' FROM public.pdi_avaliacoes_trimestrais;
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000d1');
INSERT INTO public.pdi_ciencias (pdi_id, referencia, referencia_id, papel, nome)
SELECT pdi_id, 'avaliacao', id, 'colaborador', 'Colab' FROM public.pdi_avaliacoes_trimestrais;
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.pdi_ciencias (pdi_id, referencia, referencia_id, papel, nome)
SELECT pdi_id, 'avaliacao', id, 'diretoria', 'Socio' FROM public.pdi_avaliacoes_trimestrais;

-- conclui e fica bloqueada
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000c1');
UPDATE public.pdi_avaliacoes_trimestrais SET status = 'concluida', resultado = 'parcial',
       direcionamentos = ARRAY['manutencao'];
SELECT pg_temp.deve_ser('SELECT status FROM public.pdi_avaliacoes_trimestrais', 'concluida', 'ficha concluída');
SELECT pg_temp.deve_falhar($q$UPDATE public.pdi_avaliacoes_trimestrais SET avancos = 'x'$q$,
 'ficha concluída é imutável (gestor)');
SELECT pg_temp.deve_falhar($q$UPDATE public.pdi_avaliacao_pilares SET nota_ciclo = 4$q$,
 'pilares da ficha concluída são imutáveis');
SELECT pg_temp.deve_falhar($q$UPDATE public.pdi_avaliacoes_trimestrais SET status = 'rascunho', reabertura_justificativa = 'x'$q$,
 'gestor não reabre ficha concluída');

-- admin reabre só com justificativa
SELECT pg_temp.eu('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.deve_falhar($q$UPDATE public.pdi_avaliacoes_trimestrais SET status = 'rascunho'$q$,
 'reabertura sem justificativa é recusada');
UPDATE public.pdi_avaliacoes_trimestrais SET status = 'rascunho', reabertura_justificativa = 'Correção de nota';
SELECT pg_temp.deve_ser('SELECT status FROM public.pdi_avaliacoes_trimestrais', 'rascunho', 'admin reabriu com justificativa');

-- auditoria
RESET ROLE;
SELECT pg_temp.deve_ser(
 $q$SELECT (count(*) FILTER (WHERE tabela = 'pdi_avaliacoes_trimestrais') > 0
            AND count(*) FILTER (WHERE tabela = 'pdi_ciencias') = 3)::text FROM public.pdi_auditoria$q$,
 'true', 'auditoria registrou fichas e ciências');

SELECT 'TODOS OS TESTES DE RLS PASSARAM' AS resultado;
