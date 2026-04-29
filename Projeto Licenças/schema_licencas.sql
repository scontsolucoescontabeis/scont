-- ================================================================
-- SCHEMA: Projeto Licenças — Portal Scont
-- Banco de dados: mesmo projeto Supabase do portal
-- LGPD: Conformidade com Lei 13.709/2018
-- Versão: 3.0
-- ================================================================
-- IMPORTANTE: Execute no mesmo projeto Supabase que contém as tabelas
-- perfis, formularios, socios, empregados do portal.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ================================================================
-- TABELA: empresas
-- Clientes/empresas cujos dados são protegidos pela LGPD.
-- ================================================================
CREATE TABLE public.empresas (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome             TEXT        NOT NULL,
    cnpj             TEXT,
    contato          TEXT,
    email            TEXT,
    telefone         TEXT,
    estabelecimentos TEXT,
    observacoes      TEXT,

    -- LGPD Art. 7º: base legal para o tratamento dos dados
    base_legal       TEXT        NOT NULL DEFAULT 'execucao_contrato'
                                 CHECK (base_legal IN (
                                     'consentimento',
                                     'execucao_contrato',
                                     'obrigacao_legal',
                                     'interesse_legitimo',
                                     'protecao_vida',
                                     'tutela_saude',
                                     'interesse_publico',
                                     'exercicio_direito'
                                 )),

    -- Auditoria completa (Art. 46 LGPD)
    -- criado_por / atualizado_por / deletado_por preenchidos automaticamente
    -- com auth.email() do usuário autenticado no portal
    ativo            BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    criado_por       TEXT,
    atualizado_em    TIMESTAMPTZ,
    atualizado_por   TEXT,
    deletado_em      TIMESTAMPTZ,
    deletado_por     TEXT
);

COMMENT ON TABLE  public.empresas            IS 'Clientes — dados pessoais protegidos pela LGPD';
COMMENT ON COLUMN public.empresas.base_legal IS 'Art. 7º LGPD: hipótese que autoriza o tratamento';


-- ================================================================
-- TABELA: licencas
-- ================================================================
CREATE TABLE public.licencas (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id      UUID        REFERENCES public.empresas(id) ON DELETE RESTRICT,
    estabelecimento TEXT        NOT NULL,
    tipo            TEXT        NOT NULL,
    numero          TEXT,
    data_emissao    DATE,
    data_validade   DATE,
    orgao_emissor   TEXT,
    responsavel     TEXT,
    observacoes     TEXT,
    tipo_operacao   TEXT,

    ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    criado_por      TEXT,
    atualizado_em   TIMESTAMPTZ,
    atualizado_por  TEXT,
    deletado_em     TIMESTAMPTZ,
    deletado_por    TEXT,

    CONSTRAINT chk_datas_licenca CHECK (
        data_validade IS NULL OR data_emissao IS NULL OR data_validade >= data_emissao
    )
);


-- ================================================================
-- TABELA: alvaras
-- ================================================================
CREATE TABLE public.alvaras (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id      UUID        REFERENCES public.empresas(id) ON DELETE RESTRICT,
    estabelecimento TEXT        NOT NULL,
    tipo            TEXT        NOT NULL,
    numero          TEXT,
    data_emissao    DATE,
    data_validade   DATE,
    orgao_emissor   TEXT,
    responsavel     TEXT,
    observacoes     TEXT,

    ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    criado_por      TEXT,
    atualizado_em   TIMESTAMPTZ,
    atualizado_por  TEXT,
    deletado_em     TIMESTAMPTZ,
    deletado_por    TEXT,

    CONSTRAINT chk_datas_alvara CHECK (
        data_validade IS NULL OR data_emissao IS NULL OR data_validade >= data_emissao
    )
);


-- ================================================================
-- TABELA: processos
-- ================================================================
CREATE TABLE public.processos (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id              UUID        REFERENCES public.empresas(id) ON DELETE RESTRICT,
    documento_id            UUID,
    tipo_documento          TEXT        CHECK (tipo_documento IN ('licencas', 'alvaras')),
    numero_processo         TEXT,
    status                  TEXT        NOT NULL DEFAULT 'aberto'
                                        CHECK (status IN (
                                            'aberto', 'em_analise', 'aprovado',
                                            'rejeitado', 'concluido', 'cancelado'
                                        )),
    data_abertura           DATE        NOT NULL DEFAULT CURRENT_DATE,
    data_prevista_conclusao DATE,
    data_conclusao          DATE,
    responsavel             TEXT,
    estabelecimento         TEXT,
    descricao               TEXT,
    observacoes             TEXT,

    ativo                   BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    criado_por              TEXT,
    atualizado_em           TIMESTAMPTZ,
    atualizado_por          TEXT,
    deletado_em             TIMESTAMPTZ,
    deletado_por            TEXT
);


-- ================================================================
-- TABELA: andamento_processos  (IMUTÁVEL — log de auditoria)
-- Art. 46 LGPD: nenhum UPDATE ou DELETE permitido por RLS.
-- ================================================================
CREATE TABLE public.andamento_processos (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    processo_id     UUID        NOT NULL REFERENCES public.processos(id) ON DELETE RESTRICT,
    status_anterior TEXT,
    status_novo     TEXT        NOT NULL,
    data_mudanca    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responsavel     TEXT,
    observacao      TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    criado_por      TEXT
);

COMMENT ON TABLE public.andamento_processos IS
    'Log imutável de auditoria — UPDATE e DELETE bloqueados por RLS';


-- ================================================================
-- ÍNDICES (parciais em ativo = TRUE)
-- ================================================================
CREATE INDEX idx_licencas_validade   ON public.licencas  (data_validade) WHERE ativo = TRUE;
CREATE INDEX idx_alvaras_validade    ON public.alvaras   (data_validade) WHERE ativo = TRUE;
CREATE INDEX idx_processos_status    ON public.processos (status)        WHERE ativo = TRUE;
CREATE INDEX idx_andamentos_proc_id  ON public.andamento_processos (processo_id);
CREATE INDEX idx_licencas_empresa    ON public.licencas  (empresa_id)    WHERE ativo = TRUE;
CREATE INDEX idx_alvaras_empresa     ON public.alvaras   (empresa_id)    WHERE ativo = TRUE;
CREATE INDEX idx_processos_empresa   ON public.processos (empresa_id)    WHERE ativo = TRUE;


-- ================================================================
-- FUNÇÕES DE AUDITORIA
-- auth.email() retorna o e-mail do usuário autenticado via JWT do portal.
-- Preenche automaticamente os campos de rastreabilidade exigidos pelo Art. 46 LGPD.
-- ================================================================

-- Preenche criado_por no INSERT
CREATE OR REPLACE FUNCTION fn_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.criado_por IS NULL THEN
        NEW.criado_por = auth.email();
    END IF;
    RETURN NEW;
END;
$$;

-- Atualiza atualizado_em e atualizado_por no UPDATE
CREATE OR REPLACE FUNCTION fn_atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em  = NOW();
    NEW.atualizado_por = auth.email();
    RETURN NEW;
END;
$$;

-- Soft delete: intercepta DELETE e converte em UPDATE
-- SECURITY DEFINER: necessário para contornar RLS e aplicar o UPDATE no mesmo registro
-- que o usuário autenticado está "deletando".
-- Retorna NULL → cancela o DELETE físico; nenhum dado é removido do banco.
CREATE OR REPLACE FUNCTION fn_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
    EXECUTE format(
        'UPDATE public.%I
            SET ativo = FALSE,
                deletado_em  = NOW(),
                deletado_por = %L
          WHERE id = %L',
        TG_TABLE_NAME,
        COALESCE(auth.email(), 'sistema'),
        OLD.id
    );
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION fn_soft_delete() IS
    'Converte DELETE em soft delete. Nenhum dado removido — conformidade LGPD Art. 46.';


-- ================================================================
-- TRIGGERS
-- ================================================================

-- INSERT: preenche criado_por
CREATE TRIGGER trg_audit_insert_empresas
    BEFORE INSERT ON public.empresas
    FOR EACH ROW EXECUTE FUNCTION fn_audit_insert();

CREATE TRIGGER trg_audit_insert_licencas
    BEFORE INSERT ON public.licencas
    FOR EACH ROW EXECUTE FUNCTION fn_audit_insert();

CREATE TRIGGER trg_audit_insert_alvaras
    BEFORE INSERT ON public.alvaras
    FOR EACH ROW EXECUTE FUNCTION fn_audit_insert();

CREATE TRIGGER trg_audit_insert_processos
    BEFORE INSERT ON public.processos
    FOR EACH ROW EXECUTE FUNCTION fn_audit_insert();

CREATE TRIGGER trg_audit_insert_andamentos
    BEFORE INSERT ON public.andamento_processos
    FOR EACH ROW EXECUTE FUNCTION fn_audit_insert();

-- UPDATE: atualiza timestamp e atualizado_por
CREATE TRIGGER trg_ts_empresas
    BEFORE UPDATE ON public.empresas
    FOR EACH ROW EXECUTE FUNCTION fn_atualizar_timestamp();

CREATE TRIGGER trg_ts_licencas
    BEFORE UPDATE ON public.licencas
    FOR EACH ROW EXECUTE FUNCTION fn_atualizar_timestamp();

CREATE TRIGGER trg_ts_alvaras
    BEFORE UPDATE ON public.alvaras
    FOR EACH ROW EXECUTE FUNCTION fn_atualizar_timestamp();

CREATE TRIGGER trg_ts_processos
    BEFORE UPDATE ON public.processos
    FOR EACH ROW EXECUTE FUNCTION fn_atualizar_timestamp();

-- DELETE: converte em soft delete (sem trigger em andamento_processos — tabela imutável)
CREATE TRIGGER trg_soft_delete_empresas
    BEFORE DELETE ON public.empresas
    FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_soft_delete_licencas
    BEFORE DELETE ON public.licencas
    FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_soft_delete_alvaras
    BEFORE DELETE ON public.alvaras
    FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_soft_delete_processos
    BEFORE DELETE ON public.processos
    FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();


-- ================================================================
-- FUNÇÃO LGPD: Portabilidade de dados (Art. 18, V)
-- Retorna JSON com todos os dados do titular, incluindo histórico completo.
-- Requer usuário autenticado.
-- ================================================================
CREATE OR REPLACE FUNCTION fn_exportar_dados_empresa(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: autenticação necessária';
    END IF;

    RETURN jsonb_build_object(
        'exportado_em',       NOW(),
        'exportado_por',      auth.email(),
        'base_legal',         'Art. 18, V — Lei 13.709/2018 (LGPD)',
        'empresa', (
            SELECT to_jsonb(e)
              FROM public.empresas e
             WHERE e.id = p_empresa_id
        ),
        'licencas', (
            SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
              FROM public.licencas l
             WHERE l.empresa_id = p_empresa_id
        ),
        'alvaras', (
            SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
              FROM public.alvaras a
             WHERE a.empresa_id = p_empresa_id
        ),
        'processos', (
            SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
              FROM public.processos p
             WHERE p.empresa_id = p_empresa_id
        ),
        'andamentos', (
            SELECT COALESCE(jsonb_agg(to_jsonb(ap)), '[]'::jsonb)
              FROM public.andamento_processos ap
             WHERE ap.processo_id IN (
                 SELECT id FROM public.processos WHERE empresa_id = p_empresa_id
             )
        )
    );
END;
$$;


-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- Art. 46 LGPD: medidas técnicas e administrativas de segurança.
--
-- Papel "authenticated": usuário com sessão JWT válida do portal.
-- Papel "anon": sem sessão — nenhuma política concedida = acesso bloqueado.
-- Papel "service_role": painel Supabase — ignora RLS por design.
-- ================================================================

ALTER TABLE public.empresas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alvaras             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.andamento_processos ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------
-- EMPRESAS
-- ----------------------------------------------------------------

CREATE POLICY "empresas_select" ON public.empresas
    FOR SELECT TO authenticated
    USING (ativo = TRUE AND deletado_em IS NULL);

CREATE POLICY "empresas_insert" ON public.empresas
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "empresas_update" ON public.empresas
    FOR UPDATE TO authenticated
    USING  (ativo = TRUE AND deletado_em IS NULL)
    WITH CHECK (TRUE);

-- DELETE permitido para authenticated — trigger converte em soft delete automaticamente
CREATE POLICY "empresas_delete" ON public.empresas
    FOR DELETE TO authenticated
    USING (ativo = TRUE AND deletado_em IS NULL);


-- ----------------------------------------------------------------
-- LICENCAS
-- ----------------------------------------------------------------

CREATE POLICY "licencas_select" ON public.licencas
    FOR SELECT TO authenticated
    USING (ativo = TRUE AND deletado_em IS NULL);

CREATE POLICY "licencas_insert" ON public.licencas
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "licencas_update" ON public.licencas
    FOR UPDATE TO authenticated
    USING  (ativo = TRUE AND deletado_em IS NULL)
    WITH CHECK (TRUE);

CREATE POLICY "licencas_delete" ON public.licencas
    FOR DELETE TO authenticated
    USING (ativo = TRUE AND deletado_em IS NULL);


-- ----------------------------------------------------------------
-- ALVARAS
-- ----------------------------------------------------------------

CREATE POLICY "alvaras_select" ON public.alvaras
    FOR SELECT TO authenticated
    USING (ativo = TRUE AND deletado_em IS NULL);

CREATE POLICY "alvaras_insert" ON public.alvaras
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "alvaras_update" ON public.alvaras
    FOR UPDATE TO authenticated
    USING  (ativo = TRUE AND deletado_em IS NULL)
    WITH CHECK (TRUE);

CREATE POLICY "alvaras_delete" ON public.alvaras
    FOR DELETE TO authenticated
    USING (ativo = TRUE AND deletado_em IS NULL);


-- ----------------------------------------------------------------
-- PROCESSOS
-- ----------------------------------------------------------------

CREATE POLICY "processos_select" ON public.processos
    FOR SELECT TO authenticated
    USING (ativo = TRUE AND deletado_em IS NULL);

CREATE POLICY "processos_insert" ON public.processos
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "processos_update" ON public.processos
    FOR UPDATE TO authenticated
    USING  (ativo = TRUE AND deletado_em IS NULL)
    WITH CHECK (TRUE);

CREATE POLICY "processos_delete" ON public.processos
    FOR DELETE TO authenticated
    USING (ativo = TRUE AND deletado_em IS NULL);


-- ----------------------------------------------------------------
-- ANDAMENTO_PROCESSOS (imutável)
-- SELECT e INSERT para authenticated.
-- UPDATE e DELETE sem política = bloqueio total.
-- ----------------------------------------------------------------

CREATE POLICY "andamentos_select" ON public.andamento_processos
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "andamentos_insert" ON public.andamento_processos
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);


-- ================================================================
-- VERIFICAÇÃO
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE 'trg_%' ORDER BY tgrelid::regclass;
-- ================================================================
