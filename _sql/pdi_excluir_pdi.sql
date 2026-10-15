-- ============================================================
-- SCONT – PDI: exclusão de PDI pelo administrador (incremental)
-- Execute no SQL Editor do Supabase (projeto do Portal), DEPOIS de schema_pdi.sql.
-- Idempotente. Equivale às mesmas funções já presentes em schema_pdi.sql.
-- ============================================================
CREATE OR REPLACE FUNCTION public.pdi_avaliacao_guarda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_pilares INTEGER;
    v_ciencias INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- exclusão do PDI inteiro (pdi_excluir, só admin) pode levar as fichas concluídas junto
        IF OLD.status = 'concluida' AND COALESCE(current_setting('pdi.excluindo', TRUE), '') <> 'on' THEN
            RAISE EXCEPTION 'Avaliação concluída não pode ser excluída.';
        END IF;
        RETURN OLD;
    END IF;

    IF NOT public.pdi_pode_avaliar(OLD.pdi_id) THEN
        IF (to_jsonb(NEW) - 'consideracoes_colaborador' - 'updated_at')
           IS DISTINCT FROM (to_jsonb(OLD) - 'consideracoes_colaborador' - 'updated_at') THEN
            RAISE EXCEPTION 'O colaborador só pode registrar as considerações.';
        END IF;
        IF OLD.status = 'concluida' THEN
            RAISE EXCEPTION 'Avaliação concluída está bloqueada para edição.';
        END IF;
        RETURN NEW;
    END IF;

    IF OLD.status = 'concluida' THEN
        IF NEW.status <> 'concluida' THEN
            IF NOT public.is_admin() THEN
                RAISE EXCEPTION 'Somente o administrador reabre uma avaliação concluída.';
            END IF;
            IF BTRIM(COALESCE(NEW.reabertura_justificativa, '')) = '' THEN
                RAISE EXCEPTION 'Reabertura exige justificativa.';
            END IF;
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Avaliação concluída está bloqueada para edição.';
    END IF;

    IF NEW.status = 'concluida' THEN
        SELECT COUNT(*) INTO v_pilares FROM public.pdi_avaliacao_pilares p
         WHERE p.avaliacao_id = OLD.id
           AND ((p.na AND BTRIM(COALESCE(p.justificativa_na, '')) <> '')
                OR (NOT p.na AND p.nota_ciclo IS NOT NULL));
        IF v_pilares < 4 THEN
            RAISE EXCEPTION 'Informe nota (ou N/A justificado) para os 4 pilares.';
        END IF;
        IF NEW.resultado IS NULL THEN
            RAISE EXCEPTION 'Informe o resultado do ciclo.';
        END IF;
        IF COALESCE(array_length(NEW.direcionamentos, 1), 0) = 0 THEN
            RAISE EXCEPTION 'Informe ao menos um direcionamento.';
        END IF;
        SELECT COUNT(DISTINCT papel) INTO v_ciencias FROM public.pdi_ciencias
         WHERE referencia = 'avaliacao' AND referencia_id = OLD.id;
        IF v_ciencias < 3 THEN
            RAISE EXCEPTION 'A ficha só conclui com a ciência de colaborador, gestor e Diretoria.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pdi_pilares_guarda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_av UUID;
BEGIN
    IF TG_OP = 'DELETE' AND COALESCE(current_setting('pdi.excluindo', TRUE), '') = 'on' THEN
        RETURN OLD;
    END IF;
    v_av := COALESCE(NEW.avaliacao_id, OLD.avaliacao_id);
    SELECT status INTO v_status FROM public.pdi_avaliacoes_trimestrais WHERE id = v_av;
    IF v_status = 'concluida' THEN
        RAISE EXCEPTION 'Avaliação concluída está bloqueada para edição.';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.pdi_excluir(p_pdi UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Somente o administrador exclui PDIs.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.pdis WHERE id = p_pdi) THEN
        RAISE EXCEPTION 'PDI não encontrado.';
    END IF;
    PERFORM set_config('pdi.excluindo', 'on', TRUE);   -- vale só nesta transação
    DELETE FROM public.pdis WHERE id = p_pdi;
END;
$$;
REVOKE ALL ON FUNCTION public.pdi_excluir(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdi_excluir(UUID) TO authenticated;
