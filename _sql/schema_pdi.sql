-- ============================================================
-- SCONT – MÓDULO PDI (Plano de Desenvolvimento Individual)
-- Execute no SQL Editor do Supabase (projeto do Portal).
-- Idempotente: pode rodar mais de uma vez.
-- Pré-requisito: public.is_admin() e public.usuarios (schema.sql).
-- Spec: Projeto PDI/docs/superpowers/specs/2026-10-15-pdi-design.md
-- ============================================================

-- ------------------------------------------------------------
-- 0. Utilitário: updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pdi_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 1. Tabelas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pdi_modelos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cargo_setor  TEXT NOT NULL,
    versao       INTEGER NOT NULL DEFAULT 1,
    conteudo     JSONB NOT NULL DEFAULT '{}'::jsonb,
    ativo        BOOLEAN NOT NULL DEFAULT TRUE,
    created_by   UUID DEFAULT auth.uid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sócios Scont com poder de avaliar (vínculo explícito, só admin escreve).
CREATE TABLE IF NOT EXISTS public.pdi_socios (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID NOT NULL UNIQUE,
    rh_socio_id  UUID,
    nome         TEXT NOT NULL,
    created_by   UUID DEFAULT auth.uid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pdis (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modelo_id                 UUID REFERENCES public.pdi_modelos (id) ON DELETE SET NULL,
    colaborador_user_id       UUID,
    colaborador_nome          TEXT NOT NULL,
    cargo_setor               TEXT NOT NULL,
    admissao                  DATE,
    gestor_user_id            UUID,
    gestor_nome               TEXT,
    data_inicio               DATE NOT NULL,
    meses_acompanhamento      INTEGER NOT NULL DEFAULT 12 CHECK (meses_acompanhamento BETWEEN 1 AND 36),
    acompanhamento_texto      TEXT NOT NULL DEFAULT '12 meses propostos a partir do início do PDI',
    avaliacao_texto           TEXT NOT NULL DEFAULT 'Trimestral, com acompanhamento da Diretoria',
    contexto_desenvolvimento  TEXT,
    perfil_comportamental     JSONB NOT NULL DEFAULT '{}'::jsonb,
    apoio_scont               TEXT,
    conteudo                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    status                    TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('rascunho', 'ativo', 'encerrado')),
    created_by                UUID DEFAULT auth.uid(),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdis_colab  ON public.pdis (colaborador_user_id);
CREATE INDEX IF NOT EXISTS idx_pdis_gestor ON public.pdis (gestor_user_id);

CREATE TABLE IF NOT EXISTS public.pdi_competencias_tecnicas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id      UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    competencia TEXT NOT NULL,
    pratica     TEXT,
    meta_ciclo1 TEXT,
    priorizada  BOOLEAN NOT NULL DEFAULT FALSE,
    ordem       INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_tec_pdi ON public.pdi_competencias_tecnicas (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_niveis_tecnicos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id                 UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    competencia_tecnica_id UUID NOT NULL REFERENCES public.pdi_competencias_tecnicas (id) ON DELETE CASCADE,
    data                   DATE NOT NULL DEFAULT CURRENT_DATE,
    nivel                  INTEGER NOT NULL CHECK (nivel BETWEEN 1 AND 4),
    evidencia              TEXT,
    registrado_por         UUID DEFAULT auth.uid(),
    validado_por           UUID,
    validado_em            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_niveis_pdi ON public.pdi_niveis_tecnicos (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_competencias_comportamentais (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id               UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    competencia          TEXT NOT NULL,
    comportamento_esperado TEXT,
    acao_evidencia       TEXT,
    ordem                INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_comp_pdi ON public.pdi_competencias_comportamentais (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_avaliacoes_comportamentais (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id         UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    competencia_id UUID NOT NULL REFERENCES public.pdi_competencias_comportamentais (id) ON DELETE CASCADE,
    data           DATE NOT NULL DEFAULT CURRENT_DATE,
    nota           INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 4),
    evidencia      TEXT,
    avaliado_por   UUID DEFAULT auth.uid(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_avcomp_pdi ON public.pdi_avaliacoes_comportamentais (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_acoes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id             UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    ordem              INTEGER NOT NULL DEFAULT 0,
    foco_acao          TEXT NOT NULL,
    responsaveis       TEXT,
    prazo_dias         INTEGER,
    recorrencia        TEXT CHECK (recorrencia IS NULL OR recorrencia IN ('semanal')),
    evidencia_esperada TEXT,
    status             TEXT NOT NULL DEFAULT 'a_iniciar' CHECK (status IN ('a_iniciar', 'em_andamento', 'concluido')),
    ciclo              INTEGER NOT NULL DEFAULT 1 CHECK (ciclo BETWEEN 1 AND 4),
    origem             TEXT NOT NULL DEFAULT 'modelo' CHECK (origem IN ('modelo', 'ficha_trimestral', 'manual')),
    concluido_em       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pdi_acoes_prazo_ck CHECK (prazo_dias IS NOT NULL OR recorrencia IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_pdi_acoes_pdi ON public.pdi_acoes (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_indicadores (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id             UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    chave              TEXT NOT NULL,
    nome               TEXT NOT NULL,
    formula            TEXT,
    meta_texto         TEXT,
    tipo_meta          TEXT NOT NULL DEFAULT 'numerica' CHECK (tipo_meta IN ('numerica', 'relativa_linha_base', 'a_pactuar')),
    operador           TEXT CHECK (operador IS NULL OR operador IN ('>=', '<=', '=')),
    valor_meta         NUMERIC(6,2),
    evidencia          TEXT,
    calculo_automatico TEXT CHECK (calculo_automatico IS NULL OR calculo_automatico IN ('autonomia', 'pendencias', 'controles')),
    ordem              INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pdi_id, chave)
);

CREATE TABLE IF NOT EXISTS public.pdi_indicador_apuracoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id          UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    indicador_id    UUID NOT NULL REFERENCES public.pdi_indicadores (id) ON DELETE CASCADE,
    competencia_mes DATE NOT NULL,
    numerador       NUMERIC(12,2) NOT NULL CHECK (numerador >= 0),
    denominador     NUMERIC(12,2) NOT NULL CHECK (denominador >= 0),
    percentual      NUMERIC(6,1) GENERATED ALWAYS AS (
                        CASE WHEN denominador > 0 THEN ROUND(numerador / denominador * 100, 1) END
                    ) STORED,
    linha_base      BOOLEAN NOT NULL DEFAULT FALSE,
    observacao      TEXT,
    apurado_por     UUID DEFAULT auth.uid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (indicador_id, competencia_mes)
);

CREATE TABLE IF NOT EXISTS public.pdi_melhorias (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id              UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    data                DATE NOT NULL DEFAULT CURRENT_DATE,
    rotina              TEXT NOT NULL,
    situacao_anterior   TEXT,
    melhoria_evidencia  TEXT,
    validacao_gestor    TEXT NOT NULL DEFAULT 'pendente' CHECK (validacao_gestor IN ('pendente', 'validado', 'nao_validado')),
    comentario_gestor   TEXT,
    validado_por        UUID,
    validado_em         TIMESTAMPTZ,
    created_by          UUID DEFAULT auth.uid(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_melhorias_pdi ON public.pdi_melhorias (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_alinhamentos_semanais (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id           UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    semana_ref       DATE NOT NULL,
    concluidos       TEXT,
    pendencias       TEXT,
    apoio_necessario TEXT,
    dificuldades     TEXT,
    feedback_gestor  TEXT,
    realizado        BOOLEAN NOT NULL DEFAULT FALSE,
    created_by       UUID DEFAULT auth.uid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pdi_id, semana_ref)
);

CREATE TABLE IF NOT EXISTS public.pdi_sinalizacoes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id           UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    descricao        TEXT NOT NULL,
    data_sinalizacao DATE NOT NULL DEFAULT CURRENT_DATE,
    prazo_entrega    DATE NOT NULL,
    antes_do_prazo   BOOLEAN GENERATED ALWAYS AS (data_sinalizacao <= prazo_entrega) STORED,
    resultado        TEXT,
    created_by       UUID DEFAULT auth.uid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_sinal_pdi ON public.pdi_sinalizacoes (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_ciclos (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id                    UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    numero                    INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 4),
    inicio                    DATE NOT NULL,
    fim                       DATE NOT NULL,
    periodo_relativo          TEXT,
    foco_resultado_esperado   TEXT,
    data_avaliacao_agendada   DATE,
    mudancas_escopo_apoio     TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pdi_id, numero)
);

CREATE TABLE IF NOT EXISTS public.pdi_avaliacoes_trimestrais (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id                    UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    ciclo_numero              INTEGER NOT NULL CHECK (ciclo_numero BETWEEN 1 AND 4),
    data_reuniao              DATE,
    gestor_nome               TEXT,
    avancos                   TEXT,
    pontos_desenvolvimento    TEXT,
    prioridades_proximo_ciclo TEXT,
    consideracoes_colaborador TEXT,
    resultado                 TEXT CHECK (resultado IS NULL OR resultado IN ('abaixo', 'parcial', 'dentro', 'acima')),
    direcionamentos           TEXT[] NOT NULL DEFAULT '{}',
    status                    TEXT NOT NULL DEFAULT 'rascunho'
                              CHECK (status IN ('rascunho', 'em_reuniao', 'aguardando_ciencia', 'concluida')),
    reabertura_justificativa  TEXT,
    created_by                UUID DEFAULT auth.uid(),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pdi_id, ciclo_numero)
);

CREATE TABLE IF NOT EXISTS public.pdi_avaliacao_pilares (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id         UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    avaliacao_id   UUID NOT NULL REFERENCES public.pdi_avaliacoes_trimestrais (id) ON DELETE CASCADE,
    pilar          TEXT NOT NULL CHECK (pilar IN ('tecnicas', 'comportamentais', 'performance', 'melhorias')),
    nota_inicial   INTEGER CHECK (nota_inicial BETWEEN 1 AND 4),
    nota_ciclo     INTEGER CHECK (nota_ciclo BETWEEN 1 AND 4),
    na             BOOLEAN NOT NULL DEFAULT FALSE,
    justificativa_na TEXT,
    evidencias     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (avaliacao_id, pilar),
    CONSTRAINT pdi_pilar_na_ck CHECK (NOT na OR BTRIM(COALESCE(justificativa_na, '')) <> '')
);

CREATE TABLE IF NOT EXISTS public.pdi_feedbacks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id      UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    ciclo_numero INTEGER CHECK (ciclo_numero BETWEEN 1 AND 4),
    autor_id    UUID NOT NULL DEFAULT auth.uid(),
    autor_nome  TEXT,
    autor_papel TEXT NOT NULL CHECK (autor_papel IN ('gestor', 'socio', 'admin')),
    texto       TEXT NOT NULL CHECK (BTRIM(texto) <> ''),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_feedbacks_pdi ON public.pdi_feedbacks (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_evidencias (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id      UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    ref_tipo    TEXT NOT NULL CHECK (ref_tipo IN ('acao', 'nivel', 'melhoria', 'indicador', 'comportamental')),
    ref_id      UUID NOT NULL,
    texto       TEXT,
    link        TEXT,
    arquivo_path TEXT,
    created_by  UUID DEFAULT auth.uid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_evid_ref ON public.pdi_evidencias (ref_tipo, ref_id);

CREATE TABLE IF NOT EXISTS public.pdi_ciencias (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdi_id        UUID NOT NULL REFERENCES public.pdis (id) ON DELETE CASCADE,
    referencia    TEXT NOT NULL CHECK (referencia IN ('pdi', 'avaliacao')),
    referencia_id UUID NOT NULL,
    papel         TEXT NOT NULL CHECK (papel IN ('colaborador', 'gestor', 'diretoria')),
    usuario_id    UUID NOT NULL DEFAULT auth.uid(),
    nome          TEXT NOT NULL,
    assinado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (referencia, referencia_id, papel)
);
CREATE INDEX IF NOT EXISTS idx_pdi_ciencias_pdi ON public.pdi_ciencias (pdi_id);

CREATE TABLE IF NOT EXISTS public.pdi_auditoria (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela      TEXT NOT NULL,
    registro_id UUID,
    pdi_id      UUID,
    acao        TEXT NOT NULL,
    antes       JSONB,
    depois      JSONB,
    usuario_id  UUID DEFAULT auth.uid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdi_auditoria_pdi ON public.pdi_auditoria (pdi_id);

-- ------------------------------------------------------------
-- 2. Funções de papel (SECURITY DEFINER evita recursão de RLS)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pdi_eh_socio()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.pdi_socios WHERE usuario_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.pdi_eh_gestor(p_pdi UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.pdis WHERE id = p_pdi AND gestor_user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.pdi_eh_colab(p_pdi UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.pdis WHERE id = p_pdi AND colaborador_user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.pdi_pode_avaliar(p_pdi UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.is_admin() OR public.pdi_eh_socio() OR public.pdi_eh_gestor(p_pdi);
$$;

CREATE OR REPLACE FUNCTION public.pdi_pode_ver(p_pdi UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.pdi_pode_avaliar(p_pdi) OR public.pdi_eh_colab(p_pdi);
$$;

-- Papel do usuário logado (para a interface): admin | socio | gestor | colaborador | nenhum
CREATE OR REPLACE FUNCTION public.pdi_meus_papeis()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'admin',       public.is_admin(),
        'socio',       public.pdi_eh_socio(),
        'gestor',      EXISTS (SELECT 1 FROM public.pdis WHERE gestor_user_id = auth.uid()),
        'colaborador', EXISTS (SELECT 1 FROM public.pdis WHERE colaborador_user_id = auth.uid())
    );
$$;

-- ------------------------------------------------------------
-- 3. Triggers de integridade
-- ------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pdi_modelos', 'pdis', 'pdi_competencias_tecnicas', 'pdi_competencias_comportamentais',
        'pdi_acoes', 'pdi_indicadores', 'pdi_melhorias', 'pdi_alinhamentos_semanais',
        'pdi_ciclos', 'pdi_avaliacoes_trimestrais', 'pdi_avaliacao_pilares'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I
             FOR EACH ROW EXECUTE FUNCTION public.pdi_set_updated_at()', t);
    END LOOP;
END $$;

-- 3.1 Colaborador só altera os campos que lhe cabem
CREATE OR REPLACE FUNCTION public.pdi_restringe_colab_melhoria()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.pdi_pode_avaliar(OLD.pdi_id) THEN
        IF (to_jsonb(NEW) - 'data' - 'rotina' - 'situacao_anterior' - 'melhoria_evidencia' - 'updated_at')
           IS DISTINCT FROM
           (to_jsonb(OLD) - 'data' - 'rotina' - 'situacao_anterior' - 'melhoria_evidencia' - 'updated_at') THEN
            RAISE EXCEPTION 'Somente o gestor ou a Diretoria valida melhorias.';
        END IF;
    ELSIF NEW.validacao_gestor IS DISTINCT FROM OLD.validacao_gestor
          AND NEW.validacao_gestor <> 'pendente' THEN
        NEW.validado_por := auth.uid();
        NEW.validado_em  := NOW();
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pdi_melhorias_restringe ON public.pdi_melhorias;
CREATE TRIGGER trg_pdi_melhorias_restringe BEFORE UPDATE ON public.pdi_melhorias
    FOR EACH ROW EXECUTE FUNCTION public.pdi_restringe_colab_melhoria();

-- 3.1b Ações: colaborador só atualiza status/conclusão das suas ações
CREATE OR REPLACE FUNCTION public.pdi_restringe_colab_acao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.pdi_pode_avaliar(OLD.pdi_id) THEN
        IF (to_jsonb(NEW) - 'status' - 'concluido_em' - 'updated_at')
           IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'concluido_em' - 'updated_at') THEN
            RAISE EXCEPTION 'O colaborador só atualiza o status das ações.';
        END IF;
    END IF;
    IF NEW.status = 'concluido' AND OLD.status <> 'concluido' THEN
        NEW.concluido_em := NOW();
    ELSIF NEW.status <> 'concluido' THEN
        NEW.concluido_em := NULL;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pdi_acoes_restringe ON public.pdi_acoes;
CREATE TRIGGER trg_pdi_acoes_restringe BEFORE UPDATE ON public.pdi_acoes
    FOR EACH ROW EXECUTE FUNCTION public.pdi_restringe_colab_acao();

-- 3.2 Níveis: colaborador só registra (sem validar); validação carimba autor/data
CREATE OR REPLACE FUNCTION public.pdi_niveis_guarda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.pdi_pode_avaliar(NEW.pdi_id) THEN
        NEW.validado_por := NULL;
        NEW.validado_em  := NULL;
    ELSIF NEW.validado_em IS NOT NULL AND NEW.validado_por IS NULL THEN
        NEW.validado_por := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pdi_niveis_guarda ON public.pdi_niveis_tecnicos;
CREATE TRIGGER trg_pdi_niveis_guarda BEFORE INSERT OR UPDATE ON public.pdi_niveis_tecnicos
    FOR EACH ROW EXECUTE FUNCTION public.pdi_niveis_guarda();

-- 3.3 Ficha trimestral: colaborador só escreve "considerações"; concluída é imutável;
--     conclusão exige notas/N-A justificado, resultado, direcionamento e 3 ciências;
--     reabertura só admin com justificativa.
CREATE OR REPLACE FUNCTION public.pdi_avaliacao_guarda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_pilares INTEGER;
    v_ciencias INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'concluida' THEN
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
DROP TRIGGER IF EXISTS trg_pdi_avaliacao_guarda ON public.pdi_avaliacoes_trimestrais;
CREATE TRIGGER trg_pdi_avaliacao_guarda BEFORE UPDATE OR DELETE ON public.pdi_avaliacoes_trimestrais
    FOR EACH ROW EXECUTE FUNCTION public.pdi_avaliacao_guarda();

-- 3.4 Pilares da ficha: bloqueados quando a ficha está concluída
CREATE OR REPLACE FUNCTION public.pdi_pilares_guarda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_av UUID;
BEGIN
    v_av := COALESCE(NEW.avaliacao_id, OLD.avaliacao_id);
    SELECT status INTO v_status FROM public.pdi_avaliacoes_trimestrais WHERE id = v_av;
    IF v_status = 'concluida' THEN
        RAISE EXCEPTION 'Avaliação concluída está bloqueada para edição.';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_pdi_pilares_guarda ON public.pdi_avaliacao_pilares;
CREATE TRIGGER trg_pdi_pilares_guarda BEFORE INSERT OR UPDATE OR DELETE ON public.pdi_avaliacao_pilares
    FOR EACH ROW EXECUTE FUNCTION public.pdi_pilares_guarda();

-- 3.5 Ciência: papel precisa corresponder ao vínculo do usuário no PDI
CREATE OR REPLACE FUNCTION public.pdi_ciencia_guarda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    NEW.usuario_id := auth.uid();
    NEW.assinado_em := NOW();
    IF public.is_admin() THEN RETURN NEW; END IF;
    IF NEW.papel = 'colaborador' AND NOT public.pdi_eh_colab(NEW.pdi_id) THEN
        RAISE EXCEPTION 'Somente o colaborador do PDI registra a ciência de colaborador.';
    ELSIF NEW.papel = 'gestor' AND NOT public.pdi_eh_gestor(NEW.pdi_id) THEN
        RAISE EXCEPTION 'Somente o gestor responsável registra a ciência de gestor.';
    ELSIF NEW.papel = 'diretoria' AND NOT public.pdi_eh_socio() THEN
        RAISE EXCEPTION 'Somente sócio registra a ciência da Diretoria.';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pdi_ciencia_guarda ON public.pdi_ciencias;
CREATE TRIGGER trg_pdi_ciencia_guarda BEFORE INSERT ON public.pdi_ciencias
    FOR EACH ROW EXECUTE FUNCTION public.pdi_ciencia_guarda();

-- 3.6 Auditoria
CREATE OR REPLACE FUNCTION public.pdi_auditar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r JSONB;
BEGIN
    r := to_jsonb(COALESCE(NEW, OLD));
    INSERT INTO public.pdi_auditoria (tabela, registro_id, pdi_id, acao, antes, depois)
    VALUES (
        TG_TABLE_NAME,
        (r ->> 'id')::uuid,
        CASE WHEN TG_TABLE_NAME = 'pdis' THEN (r ->> 'id')::uuid ELSE (r ->> 'pdi_id')::uuid END,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pdis', 'pdi_niveis_tecnicos', 'pdi_avaliacoes_comportamentais', 'pdi_avaliacoes_trimestrais',
        'pdi_avaliacao_pilares', 'pdi_melhorias', 'pdi_ciencias', 'pdi_feedbacks'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_auditoria ON public.%1$I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
             FOR EACH ROW EXECUTE FUNCTION public.pdi_auditar()', t);
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pdi_modelos', 'pdi_socios', 'pdis', 'pdi_competencias_tecnicas', 'pdi_niveis_tecnicos',
        'pdi_competencias_comportamentais', 'pdi_avaliacoes_comportamentais', 'pdi_acoes',
        'pdi_indicadores', 'pdi_indicador_apuracoes', 'pdi_melhorias', 'pdi_alinhamentos_semanais',
        'pdi_sinalizacoes', 'pdi_ciclos', 'pdi_avaliacoes_trimestrais', 'pdi_avaliacao_pilares',
        'pdi_feedbacks', 'pdi_evidencias', 'pdi_ciencias', 'pdi_auditoria'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Remove políticas anteriores deste módulo (idempotência)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
              WHERE schemaname = 'public' AND tablename LIKE 'pdi%' OR (schemaname = 'public' AND tablename = 'pdis')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Modelos: admin e sócios leem; admin escreve
CREATE POLICY pdi_modelos_sel ON public.pdi_modelos FOR SELECT TO authenticated
    USING (public.is_admin() OR public.pdi_eh_socio());
CREATE POLICY pdi_modelos_all ON public.pdi_modelos FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sócios: admin escreve; o próprio sócio lê a si
CREATE POLICY pdi_socios_sel ON public.pdi_socios FOR SELECT TO authenticated
    USING (public.is_admin() OR usuario_id = auth.uid());
CREATE POLICY pdi_socios_all ON public.pdi_socios FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PDIs
CREATE POLICY pdis_sel ON public.pdis FOR SELECT TO authenticated USING (public.pdi_pode_ver(id));
CREATE POLICY pdis_ins ON public.pdis FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY pdis_upd ON public.pdis FOR UPDATE TO authenticated
    USING (public.pdi_pode_avaliar(id)) WITH CHECK (public.pdi_pode_avaliar(id));
CREATE POLICY pdis_del ON public.pdis FOR DELETE TO authenticated USING (public.is_admin());

-- Classe A: todos os envolvidos leem; só quem avalia escreve
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pdi_competencias_tecnicas', 'pdi_competencias_comportamentais', 'pdi_avaliacoes_comportamentais',
        'pdi_acoes', 'pdi_indicadores', 'pdi_indicador_apuracoes', 'pdi_ciclos', 'pdi_avaliacao_pilares'
    ] LOOP
        EXECUTE format('CREATE POLICY %1$s_sel ON public.%1$I FOR SELECT TO authenticated USING (public.pdi_pode_ver(pdi_id))', t);
        EXECUTE format('CREATE POLICY %1$s_ins ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.pdi_pode_avaliar(pdi_id))', t);
        EXECUTE format('CREATE POLICY %1$s_upd ON public.%1$I FOR UPDATE TO authenticated USING (public.pdi_pode_avaliar(pdi_id)) WITH CHECK (public.pdi_pode_avaliar(pdi_id))', t);
        EXECUTE format('CREATE POLICY %1$s_del ON public.%1$I FOR DELETE TO authenticated USING (public.pdi_pode_avaliar(pdi_id))', t);
    END LOOP;
END $$;

-- Ações: colaborador atualiza o status das suas ações (não cria/exclui)
CREATE POLICY pdi_acoes_upd_colab ON public.pdi_acoes FOR UPDATE TO authenticated
    USING (public.pdi_eh_colab(pdi_id)) WITH CHECK (public.pdi_eh_colab(pdi_id));

-- Níveis: colaborador registra (a trigger zera a validação); só avaliador valida/edita
CREATE POLICY pdi_niveis_sel ON public.pdi_niveis_tecnicos FOR SELECT TO authenticated
    USING (public.pdi_pode_ver(pdi_id));
CREATE POLICY pdi_niveis_ins ON public.pdi_niveis_tecnicos FOR INSERT TO authenticated
    WITH CHECK (public.pdi_pode_ver(pdi_id));
CREATE POLICY pdi_niveis_upd ON public.pdi_niveis_tecnicos FOR UPDATE TO authenticated
    USING (public.pdi_pode_avaliar(pdi_id)) WITH CHECK (public.pdi_pode_avaliar(pdi_id));
CREATE POLICY pdi_niveis_del ON public.pdi_niveis_tecnicos FOR DELETE TO authenticated
    USING (public.pdi_pode_avaliar(pdi_id));

-- Classe B: colaborador e avaliadores escrevem
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pdi_melhorias', 'pdi_alinhamentos_semanais', 'pdi_sinalizacoes', 'pdi_evidencias'
    ] LOOP
        EXECUTE format('CREATE POLICY %1$s_sel ON public.%1$I FOR SELECT TO authenticated USING (public.pdi_pode_ver(pdi_id))', t);
        EXECUTE format('CREATE POLICY %1$s_ins ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.pdi_pode_ver(pdi_id))', t);
        EXECUTE format('CREATE POLICY %1$s_upd ON public.%1$I FOR UPDATE TO authenticated USING (public.pdi_pode_ver(pdi_id)) WITH CHECK (public.pdi_pode_ver(pdi_id))', t);
        EXECUTE format('CREATE POLICY %1$s_del ON public.%1$I FOR DELETE TO authenticated USING (public.pdi_pode_avaliar(pdi_id))', t);
    END LOOP;
END $$;

-- Fichas trimestrais: ver todos os envolvidos; criar/editar avaliadores;
-- colaborador atualiza (a trigger restringe a "considerações")
CREATE POLICY pdi_aval_sel ON public.pdi_avaliacoes_trimestrais FOR SELECT TO authenticated
    USING (public.pdi_pode_ver(pdi_id));
CREATE POLICY pdi_aval_ins ON public.pdi_avaliacoes_trimestrais FOR INSERT TO authenticated
    WITH CHECK (public.pdi_pode_avaliar(pdi_id));
CREATE POLICY pdi_aval_upd ON public.pdi_avaliacoes_trimestrais FOR UPDATE TO authenticated
    USING (public.pdi_pode_ver(pdi_id)) WITH CHECK (public.pdi_pode_ver(pdi_id));
CREATE POLICY pdi_aval_del ON public.pdi_avaliacoes_trimestrais FOR DELETE TO authenticated
    USING (public.pdi_pode_avaliar(pdi_id));

-- Feedbacks: imutáveis; só avaliadores escrevem; colaborador lê os seus
CREATE POLICY pdi_feedbacks_sel ON public.pdi_feedbacks FOR SELECT TO authenticated
    USING (public.pdi_pode_ver(pdi_id));
CREATE POLICY pdi_feedbacks_ins ON public.pdi_feedbacks FOR INSERT TO authenticated
    WITH CHECK (public.pdi_pode_avaliar(pdi_id) AND autor_id = auth.uid());

-- Ciências: não se altera nem se apaga
CREATE POLICY pdi_ciencias_sel ON public.pdi_ciencias FOR SELECT TO authenticated
    USING (public.pdi_pode_ver(pdi_id));
CREATE POLICY pdi_ciencias_ins ON public.pdi_ciencias FOR INSERT TO authenticated
    WITH CHECK (public.pdi_pode_ver(pdi_id));

-- Auditoria: admin e sócios leem; escrita só via trigger (SECURITY DEFINER)
CREATE POLICY pdi_auditoria_sel ON public.pdi_auditoria FOR SELECT TO authenticated
    USING (public.is_admin() OR public.pdi_eh_socio());

-- ------------------------------------------------------------
-- 5. Criação do PDI a partir de um modelo (copia o conteúdo: snapshot)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pdi_criar_a_partir_do_modelo(
    p_modelo_id UUID,
    p_colaborador_user_id UUID,
    p_colaborador_nome TEXT,
    p_cargo_setor TEXT,
    p_admissao DATE,
    p_gestor_user_id UUID,
    p_gestor_nome TEXT,
    p_data_inicio DATE
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_modelo public.pdi_modelos;
    v_id UUID;
    v_c JSONB;
    v_item JSONB;
    v_i INTEGER;
BEGIN
    -- auth.uid() nulo = execução administrativa (SQL Editor); usuários logados precisam ser admin
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Somente o administrador cria PDIs.';
    END IF;
    SELECT * INTO v_modelo FROM public.pdi_modelos WHERE id = p_modelo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado.'; END IF;
    v_c := v_modelo.conteudo;

    INSERT INTO public.pdis (modelo_id, colaborador_user_id, colaborador_nome, cargo_setor, admissao,
                             gestor_user_id, gestor_nome, data_inicio, apoio_scont, conteudo)
    VALUES (p_modelo_id, p_colaborador_user_id, p_colaborador_nome,
            COALESCE(NULLIF(p_cargo_setor, ''), v_modelo.cargo_setor), p_admissao,
            p_gestor_user_id, p_gestor_nome, p_data_inicio, v_c ->> 'apoio_scont', v_c)
    RETURNING id INTO v_id;

    v_i := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_c -> 'tecnicas', '[]'::jsonb)) LOOP
        v_i := v_i + 1;
        INSERT INTO public.pdi_competencias_tecnicas (pdi_id, competencia, pratica, meta_ciclo1, ordem)
        VALUES (v_id, v_item ->> 'competencia', v_item ->> 'pratica', v_item ->> 'meta', v_i);
    END LOOP;

    v_i := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_c -> 'comportamentais', '[]'::jsonb)) LOOP
        v_i := v_i + 1;
        INSERT INTO public.pdi_competencias_comportamentais (pdi_id, competencia, comportamento_esperado, acao_evidencia, ordem)
        VALUES (v_id, v_item ->> 'competencia', v_item ->> 'comportamento', v_item ->> 'acao', v_i);
    END LOOP;

    v_i := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_c -> 'acoes', '[]'::jsonb)) LOOP
        v_i := v_i + 1;
        INSERT INTO public.pdi_acoes (pdi_id, ordem, foco_acao, responsaveis, prazo_dias, recorrencia, evidencia_esperada)
        VALUES (v_id, v_i, v_item ->> 'foco', v_item ->> 'responsaveis',
                NULLIF(v_item ->> 'dias', 'null')::integer, NULLIF(v_item ->> 'recorrencia', 'null'),
                v_item ->> 'evidencia');
    END LOOP;

    v_i := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_c -> 'indicadores', '[]'::jsonb)) LOOP
        v_i := v_i + 1;
        INSERT INTO public.pdi_indicadores (pdi_id, chave, nome, formula, meta_texto, tipo_meta, operador,
                                            valor_meta, evidencia, calculo_automatico, ordem)
        VALUES (v_id, v_item ->> 'chave', v_item ->> 'nome', v_item ->> 'formula', v_item ->> 'meta_texto',
                v_item ->> 'tipo_meta', NULLIF(v_item ->> 'operador', 'null'),
                NULLIF(v_item ->> 'valor_meta', 'null')::numeric, v_item ->> 'evidencia',
                NULLIF(v_item ->> 'calculo_automatico', 'null'), v_i);
    END LOOP;

    FOR v_i IN 1..4 LOOP
        v_item := NULL;
        SELECT x INTO v_item FROM jsonb_array_elements(COALESCE(v_c -> 'ciclos', '[]'::jsonb)) x
         WHERE (x ->> 'numero')::int = v_i;
        INSERT INTO public.pdi_ciclos (pdi_id, numero, inicio, fim, periodo_relativo, foco_resultado_esperado)
        VALUES (v_id, v_i,
                (p_data_inicio + make_interval(months => 3 * (v_i - 1)))::date,
                (p_data_inicio + make_interval(months => 3 * v_i))::date - 1,
                v_item ->> 'periodo', v_item ->> 'foco');
    END LOOP;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pdi_criar_a_partir_do_modelo FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdi_criar_a_partir_do_modelo TO authenticated;

-- ------------------------------------------------------------
-- 6. Storage: relatórios comportamentais (privado, pasta = pdi_id)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdi-relatorios', 'pdi-relatorios', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS pdi_relatorios_sel ON storage.objects;
DROP POLICY IF EXISTS pdi_relatorios_ins ON storage.objects;
DROP POLICY IF EXISTS pdi_relatorios_del ON storage.objects;
CREATE POLICY pdi_relatorios_sel ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'pdi-relatorios'
           AND public.pdi_pode_ver((storage.foldername(name))[1]::uuid));
CREATE POLICY pdi_relatorios_ins ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'pdi-relatorios'
                AND public.pdi_pode_avaliar((storage.foldername(name))[1]::uuid));
CREATE POLICY pdi_relatorios_del ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'pdi-relatorios'
           AND public.pdi_pode_avaliar((storage.foldername(name))[1]::uuid));
