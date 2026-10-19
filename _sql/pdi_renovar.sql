-- ============================================================
-- SCONT – PDI: renovação (PDI do ano seguinte ligado ao anterior) — incremental
-- Execute no SQL Editor do Supabase (projeto do Portal), DEPOIS de schema_pdi.sql.
-- Idempotente. Equivale ao que também está em schema_pdi.sql.
-- ============================================================
ALTER TABLE public.pdis ADD COLUMN IF NOT EXISTS pdi_anterior_id UUID REFERENCES public.pdis (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pdis_anterior ON public.pdis (pdi_anterior_id);

-- Cria o PDI seguinte: mesmo modelo, colaborador e gestor; copia contexto e perfil; vira D = fim do anterior
-- (ou a data informada); as "prioridades para o próximo ciclo" da última ficha concluída viram ações do ciclo 1.
CREATE OR REPLACE FUNCTION public.pdi_renovar(p_anterior UUID, p_data_inicio DATE DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_ant public.pdis;
    v_novo UUID;
    v_inicio DATE;
    v_prior TEXT;
    v_base INTEGER;
    v_prazo INTEGER;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Somente o administrador renova PDIs.';
    END IF;
    SELECT * INTO v_ant FROM public.pdis WHERE id = p_anterior;
    IF NOT FOUND THEN RAISE EXCEPTION 'PDI não encontrado.'; END IF;
    IF v_ant.modelo_id IS NULL THEN
        RAISE EXCEPTION 'O modelo deste PDI não existe mais; crie o novo PDI manualmente.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.pdis WHERE pdi_anterior_id = p_anterior) THEN
        RAISE EXCEPTION 'Este PDI já foi renovado.';
    END IF;

    v_inicio := COALESCE(p_data_inicio, (v_ant.data_inicio + make_interval(months => v_ant.meses_acompanhamento))::date);

    v_novo := public.pdi_criar_a_partir_do_modelo(
        v_ant.modelo_id, v_ant.colaborador_user_id, v_ant.colaborador_nome, v_ant.cargo_setor, v_ant.admissao,
        v_ant.gestor_user_id, v_ant.gestor_nome, v_inicio);

    -- o anexo do relatório fica de fora: o arquivo pertence ao PDI anterior
    UPDATE public.pdis SET
        pdi_anterior_id = p_anterior,
        contexto_desenvolvimento = v_ant.contexto_desenvolvimento,
        perfil_comportamental = COALESCE(v_ant.perfil_comportamental, '{}'::jsonb) - 'arquivo',
        apoio_scont = COALESCE(v_ant.apoio_scont, apoio_scont)
    WHERE id = v_novo;

    SELECT prioridades_proximo_ciclo INTO v_prior FROM public.pdi_avaliacoes_trimestrais
     WHERE pdi_id = p_anterior AND status = 'concluida'
     ORDER BY ciclo_numero DESC LIMIT 1;

    IF BTRIM(COALESCE(v_prior, '')) <> '' THEN
        v_prazo := (v_inicio + interval '3 months')::date - 1 - v_inicio;   -- vence no último dia do ciclo 1
        SELECT COUNT(*) INTO v_base FROM public.pdi_acoes WHERE pdi_id = v_novo;
        INSERT INTO public.pdi_acoes (pdi_id, ordem, foco_acao, responsaveis, prazo_dias, evidencia_esperada, ciclo, origem)
        SELECT v_novo, v_base + t.n, t.linha, 'Colaborador(a) e gestor', v_prazo,
               'Registro da entrega e validação do gestor', 1, 'ficha_trimestral'
          FROM (SELECT row_number() OVER () AS n, linha
                  FROM (SELECT BTRIM(regexp_replace(l, '^\s*([-•*–]|\d+\s*[.)])\s*', '')) AS linha
                          FROM regexp_split_to_table(v_prior, E'\r?\n') AS l) x
                 WHERE linha <> '') t;
    END IF;

    RETURN v_novo;
END;
$$;
REVOKE ALL ON FUNCTION public.pdi_renovar(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdi_renovar(UUID, DATE) TO authenticated;
