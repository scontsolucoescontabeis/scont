-- ============================================================
-- SCONT - GERENCIADOR DE FORMULÁRIOS
-- Schema Supabase — versão 2.0
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================


-- ============================================================
-- 1. TABELA: formularios
--    Registros de abertura de empresa (registro) e alterações
-- ============================================================
CREATE TABLE IF NOT EXISTS public.formularios (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_formulario             TEXT NOT NULL CHECK (tipo_formulario IN ('registro', 'alteracao')),
    status                      TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'validado', 'rejeitado', 'excluido')),

    -- Identificação (ambos os tipos)
    nome_empresa                TEXT,           -- razão social ou nome proposto

    -- Campos de registro: opções de nome
    nome_proposta1              TEXT,
    nome_proposta2              TEXT,

    -- Campos compartilhados
    nome_fantasia               TEXT,
    porte_empresa               TEXT,
    capital_social              NUMERIC(15,2),
    endereco                    TEXT,           -- endereço completo (registro)
    cep                         TEXT,
    iptu                        TEXT,
    metragem                    NUMERIC(10,2),
    horario                     TEXT,
    email_comercial             TEXT,
    telefone_comercial          TEXT,
    forma_atuacao               TEXT,           -- presencial / online / ambos
    cnae_principal              TEXT,
    atividades_secundarias      TEXT,           -- separadas por \n

    -- Campos exclusivos de alteração
    alterar_nome                BOOLEAN DEFAULT FALSE,
    nome_opcao_1                TEXT,
    nome_opcao_2                TEXT,
    nome_opcao_3                TEXT,
    alterar_fantasia            BOOLEAN DEFAULT FALSE,
    novo_nome_fantasia          TEXT,
    alterar_capital             BOOLEAN DEFAULT FALSE,
    novo_capital                NUMERIC(15,2),
    alterar_dados               BOOLEAN DEFAULT FALSE,
    novo_endereco               TEXT,
    cep_novo                    TEXT,
    iptu_novo                   TEXT,
    metragem_nova               NUMERIC(10,2),
    horario_novo                TEXT,
    email_comercial_novo        TEXT,
    telefone_comercial_novo     TEXT,
    alterar_atividades          BOOLEAN DEFAULT FALSE,
    atividade_principal_nova    TEXT,
    atividades_secundarias_nova TEXT,
    alterar_quadro_societario   BOOLEAN DEFAULT FALSE,

    -- Auditoria de preenchimento
    data_preenchimento          TEXT,
    hora_preenchimento          TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formularios_tipo    ON public.formularios (tipo_formulario);
CREATE INDEX IF NOT EXISTS idx_formularios_status  ON public.formularios (status);
CREATE INDEX IF NOT EXISTS idx_formularios_created ON public.formularios (created_at DESC);
-- idx_formularios_empresa criado após a migração (seção 7), pois pode depender de rename


-- ============================================================
-- 2. TABELA: socios
--    Sócios vinculados a um formulário (registro ou alteração)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.socios (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formulario_id           UUID NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
    numero_socio            INTEGER NOT NULL DEFAULT 1,
    acao_socio              TEXT CHECK (acao_socio IN ('inclusao', 'edicao', 'exclusao')),  -- apenas em alteração
    nome                    TEXT NOT NULL,
    cpf                     TEXT,
    endereco_residencial    TEXT,
    cep                     TEXT,
    email                   TEXT,
    celular                 TEXT,
    estado_civil            TEXT,
    regime_partilha         TEXT,
    naturalidade            TEXT,
    profissao               TEXT,
    participacao            NUMERIC(5,2),
    administrador           BOOLEAN NOT NULL DEFAULT FALSE,
    responsavel_cnpj        BOOLEAN NOT NULL DEFAULT FALSE,
    documento_url           TEXT,
    documento_nome          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socios_formulario ON public.socios (formulario_id);


-- ============================================================
-- 3. TABELA: empregados
--    Fichas de admissão de empregados
--    Nomes de coluna alinhados ao formulario_empregado.html
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empregados (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_formulario             TEXT NOT NULL DEFAULT 'empregado',

    -- Dados da empresa
    nome_empresa                TEXT,
    cnpj_empresa                TEXT,
    cargo                       TEXT,
    departamento                TEXT,
    numero_pis                  TEXT,
    data_admissao               DATE,
    salario_contratual          NUMERIC(15,2),
    horario_trabalho            TEXT,
    dias_trabalho               TEXT[],
    contrato_experiencia        TEXT,
    vale_transporte             BOOLEAN DEFAULT FALSE,
    desconto_vt                 BOOLEAN DEFAULT FALSE,

    -- Dados pessoais
    nome_completo               TEXT,
    cpf                         TEXT UNIQUE,
    data_nascimento             DATE,
    estado_civil                TEXT,
    nome_conjuge                TEXT,
    regime_partilha             TEXT,
    naturalidade                TEXT,
    grau_escolaridade           TEXT,
    raca                        TEXT,
    tem_filhos                  BOOLEAN DEFAULT FALSE,

    -- Endereço
    endereco                    TEXT,
    cep                         TEXT,

    -- Contato
    telefone                    TEXT,
    celular                     TEXT,
    email                       TEXT,

    -- Documentos
    ctps_numero                 TEXT,
    ctps_serie                  TEXT,
    ctps_uf                     TEXT,
    titulo_eleitor              TEXT,
    zona_eleitoral              TEXT,
    secao_eleitoral             TEXT,
    reservista                  TEXT,

    -- Conta bancária
    banco                       TEXT,
    agencia                     TEXT,
    conta                       TEXT,
    tipo_conta                  TEXT,
    pix                         TEXT,

    -- LGPD
    consentimento_lgpd          BOOLEAN DEFAULT FALSE,

    -- Auditoria
    data_preenchimento          TEXT,
    hora_preenchimento          TEXT,
    status                      TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'validado', 'rejeitado', 'excluido')),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empregados_empresa ON public.empregados (cnpj_empresa);
CREATE INDEX IF NOT EXISTS idx_empregados_cpf     ON public.empregados (cpf);
CREATE INDEX IF NOT EXISTS idx_empregados_status  ON public.empregados (status);
CREATE INDEX IF NOT EXISTS idx_empregados_created ON public.empregados (created_at DESC);


-- ============================================================
-- 4. TABELA: dependentes
--    Dependentes de um empregado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dependentes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empregado_id    UUID NOT NULL REFERENCES public.empregados(id) ON DELETE CASCADE,
    nome            TEXT,
    cpf             TEXT,
    parentesco      TEXT,
    data_nascimento DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependentes_empregado ON public.dependentes (empregado_id);


-- ============================================================
-- 5. TABELA: arquivos
--    Referências a arquivos enviados para o Storage
-- ============================================================
CREATE TABLE IF NOT EXISTS public.arquivos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formulario_id   UUID REFERENCES public.formularios(id) ON DELETE CASCADE,
    empregado_id    UUID REFERENCES public.empregados(id)  ON DELETE CASCADE,
    tipo_documento  TEXT,
    nome_arquivo    TEXT NOT NULL,
    caminho_storage TEXT NOT NULL,
    bucket          TEXT NOT NULL DEFAULT 'documentos',
    tamanho_bytes   BIGINT,
    mime_type       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT arquivo_deve_ter_referencia CHECK (
        formulario_id IS NOT NULL OR empregado_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_arquivos_formulario ON public.arquivos (formulario_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_empregado  ON public.arquivos (empregado_id);


-- ============================================================
-- 6. TABELA: historico_edicoes
--    Log imutável de alterações feitas pelo gerenciador
-- ============================================================
CREATE TABLE IF NOT EXISTS public.historico_edicoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela          TEXT NOT NULL,      -- 'formularios', 'socios', 'empregados'
    registro_id     UUID NOT NULL,
    campo           TEXT NOT NULL,
    valor_anterior  TEXT,
    valor_novo      TEXT,
    editado_por     TEXT,
    editado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_registro ON public.historico_edicoes (registro_id);
CREATE INDEX IF NOT EXISTS idx_historico_tabela   ON public.historico_edicoes (tabela);
CREATE INDEX IF NOT EXISTS idx_historico_editado  ON public.historico_edicoes (editado_em DESC);


-- ============================================================
-- 7. MIGRAÇÕES (execute se as tabelas já existirem)
--    Adequa a estrutura antiga ao schema v2.0
-- ============================================================

-- 7.1 formularios: renomear colunas antigas e adicionar as novas
DO $$
BEGIN
    -- Renomear razao_social → nome_empresa (se existir)
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='razao_social') THEN
        ALTER TABLE public.formularios RENAME COLUMN razao_social TO nome_empresa;
    END IF;

    -- Garantir que nome_empresa existe (caso a tabela tenha sido criada sem ela)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='nome_empresa') THEN
        ALTER TABLE public.formularios ADD COLUMN nome_empresa TEXT;
    END IF;

    -- Adicionar colunas novas se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='nome_proposta1') THEN
        ALTER TABLE public.formularios ADD COLUMN nome_proposta1 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='nome_proposta2') THEN
        ALTER TABLE public.formularios ADD COLUMN nome_proposta2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='endereco') THEN
        ALTER TABLE public.formularios ADD COLUMN endereco TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='iptu') THEN
        ALTER TABLE public.formularios ADD COLUMN iptu TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='metragem') THEN
        ALTER TABLE public.formularios ADD COLUMN metragem NUMERIC(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='alterar_nome') THEN
        ALTER TABLE public.formularios ADD COLUMN alterar_nome BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='nome_opcao_1') THEN
        ALTER TABLE public.formularios ADD COLUMN nome_opcao_1 TEXT;
        ALTER TABLE public.formularios ADD COLUMN nome_opcao_2 TEXT;
        ALTER TABLE public.formularios ADD COLUMN nome_opcao_3 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='alterar_fantasia') THEN
        ALTER TABLE public.formularios ADD COLUMN alterar_fantasia BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='novo_nome_fantasia') THEN
        ALTER TABLE public.formularios ADD COLUMN novo_nome_fantasia TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='alterar_capital') THEN
        ALTER TABLE public.formularios ADD COLUMN alterar_capital BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='novo_capital') THEN
        ALTER TABLE public.formularios ADD COLUMN novo_capital NUMERIC(15,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='alterar_dados') THEN
        ALTER TABLE public.formularios ADD COLUMN alterar_dados BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='novo_endereco') THEN
        ALTER TABLE public.formularios ADD COLUMN novo_endereco TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='iptu_novo') THEN
        ALTER TABLE public.formularios ADD COLUMN iptu_novo TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='metragem_nova') THEN
        ALTER TABLE public.formularios ADD COLUMN metragem_nova NUMERIC(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='horario_novo') THEN
        ALTER TABLE public.formularios ADD COLUMN horario_novo TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='alterar_atividades') THEN
        ALTER TABLE public.formularios ADD COLUMN alterar_atividades BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='atividade_principal_nova') THEN
        ALTER TABLE public.formularios ADD COLUMN atividade_principal_nova TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='atividades_secundarias_nova') THEN
        ALTER TABLE public.formularios ADD COLUMN atividades_secundarias_nova TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='alterar_quadro_societario') THEN
        ALTER TABLE public.formularios ADD COLUMN alterar_quadro_societario BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='data_preenchimento') THEN
        ALTER TABLE public.formularios ADD COLUMN data_preenchimento TEXT;
        ALTER TABLE public.formularios ADD COLUMN hora_preenchimento TEXT;
    END IF;

    -- Remover colunas antigas não usadas pelos formulários
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='cnpj') THEN
        ALTER TABLE public.formularios DROP COLUMN cnpj;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='inscricao_estadual') THEN
        ALTER TABLE public.formularios DROP COLUMN inscricao_estadual;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='inscricao_municipal') THEN
        ALTER TABLE public.formularios DROP COLUMN inscricao_municipal;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='regime_tributario') THEN
        ALTER TABLE public.formularios DROP COLUMN regime_tributario;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='simples_nacional') THEN
        ALTER TABLE public.formularios DROP COLUMN simples_nacional;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='mei') THEN
        ALTER TABLE public.formularios DROP COLUMN mei;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='imune_isento') THEN
        ALTER TABLE public.formularios DROP COLUMN imune_isento;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='tipo_alteracao') THEN
        ALTER TABLE public.formularios DROP COLUMN tipo_alteracao;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='descricao_alteracao') THEN
        ALTER TABLE public.formularios DROP COLUMN descricao_alteracao;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='motivo_alteracao') THEN
        ALTER TABLE public.formularios DROP COLUMN motivo_alteracao;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='logradouro_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN logradouro_novo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='numero_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN numero_novo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='complemento_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN complemento_novo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='bairro_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN bairro_novo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='cidade_nova') THEN
        ALTER TABLE public.formularios DROP COLUMN cidade_nova;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='estado_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN estado_novo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='capital_social_atual') THEN
        ALTER TABLE public.formularios DROP COLUMN capital_social_atual;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='capital_social_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN capital_social_novo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='cnae_principal_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN cnae_principal_novo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='regime_tributario_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN regime_tributario_novo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='formularios' AND column_name='nome_fantasia_novo') THEN
        ALTER TABLE public.formularios DROP COLUMN nome_fantasia_novo;
    END IF;
END $$;

-- Índice em nome_empresa criado após a migração (a coluna pode ter sido renomeada acima)
CREATE INDEX IF NOT EXISTS idx_formularios_empresa ON public.formularios (nome_empresa);


-- 7.2 socios: remover rg e cnh, adicionar acao_socio, documento_url, documento_nome
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='socios' AND column_name='rg') THEN
        ALTER TABLE public.socios DROP COLUMN rg;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='socios' AND column_name='cnh') THEN
        ALTER TABLE public.socios DROP COLUMN cnh;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='socios' AND column_name='acao_socio') THEN
        ALTER TABLE public.socios ADD COLUMN acao_socio TEXT
            CHECK (acao_socio IN ('inclusao', 'edicao', 'exclusao'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='socios' AND column_name='documento_url') THEN
        ALTER TABLE public.socios ADD COLUMN documento_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='socios' AND column_name='documento_nome') THEN
        ALTER TABLE public.socios ADD COLUMN documento_nome TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='socios' AND column_name='participacao'
               AND data_type = 'text') THEN
        ALTER TABLE public.socios ALTER COLUMN participacao TYPE NUMERIC(5,2)
            USING participacao::numeric;
    END IF;
END $$;


-- 7.3 empregados: alinhar colunas com formulario_empregado.html
DO $$
BEGIN
    -- ── Renomeações ──────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='nome')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='nome_completo') THEN
        ALTER TABLE public.empregados RENAME COLUMN nome TO nome_completo;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='empresa')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='nome_empresa') THEN
        ALTER TABLE public.empregados RENAME COLUMN empresa TO nome_empresa;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='escolaridade')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='grau_escolaridade') THEN
        ALTER TABLE public.empregados RENAME COLUMN escolaridade TO grau_escolaridade;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='usa_vale_transporte')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='vale_transporte') THEN
        ALTER TABLE public.empregados RENAME COLUMN usa_vale_transporte TO vale_transporte;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='salario')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='salario_contratual') THEN
        ALTER TABLE public.empregados RENAME COLUMN salario TO salario_contratual;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='tipo_contrato')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='contrato_experiencia') THEN
        ALTER TABLE public.empregados RENAME COLUMN tipo_contrato TO contrato_experiencia;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='pis_pasep')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados' AND column_name='numero_pis') THEN
        ALTER TABLE public.empregados RENAME COLUMN pis_pasep TO numero_pis;
    END IF;

    -- ── Novas colunas ─────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='celular') THEN
        ALTER TABLE public.empregados ADD COLUMN celular TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='nome_conjuge') THEN
        ALTER TABLE public.empregados ADD COLUMN nome_conjuge TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='regime_partilha') THEN
        ALTER TABLE public.empregados ADD COLUMN regime_partilha TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='raca') THEN
        ALTER TABLE public.empregados ADD COLUMN raca TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='endereco') THEN
        ALTER TABLE public.empregados ADD COLUMN endereco TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='tem_filhos') THEN
        ALTER TABLE public.empregados ADD COLUMN tem_filhos BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='desconto_vt') THEN
        ALTER TABLE public.empregados ADD COLUMN desconto_vt BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='departamento') THEN
        ALTER TABLE public.empregados ADD COLUMN departamento TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='consentimento_lgpd') THEN
        ALTER TABLE public.empregados ADD COLUMN consentimento_lgpd BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='data_preenchimento') THEN
        ALTER TABLE public.empregados ADD COLUMN data_preenchimento TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='hora_preenchimento') THEN
        ALTER TABLE public.empregados ADD COLUMN hora_preenchimento TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='nome_empresa') THEN
        ALTER TABLE public.empregados ADD COLUMN nome_empresa TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='cargo') THEN
        ALTER TABLE public.empregados ADD COLUMN cargo TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='vale_transporte') THEN
        ALTER TABLE public.empregados ADD COLUMN vale_transporte BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='salario_contratual') THEN
        ALTER TABLE public.empregados ADD COLUMN salario_contratual NUMERIC(15,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='dias_trabalho') THEN
        ALTER TABLE public.empregados ADD COLUMN dias_trabalho TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='horario_trabalho') THEN
        ALTER TABLE public.empregados ADD COLUMN horario_trabalho TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='contrato_experiencia') THEN
        ALTER TABLE public.empregados ADD COLUMN contrato_experiencia TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='numero_pis') THEN
        ALTER TABLE public.empregados ADD COLUMN numero_pis TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='nome_completo') THEN
        ALTER TABLE public.empregados ADD COLUMN nome_completo TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='data_nascimento') THEN
        ALTER TABLE public.empregados ADD COLUMN data_nascimento DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='estado_civil') THEN
        ALTER TABLE public.empregados ADD COLUMN estado_civil TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='naturalidade') THEN
        ALTER TABLE public.empregados ADD COLUMN naturalidade TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='cep') THEN
        ALTER TABLE public.empregados ADD COLUMN cep TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='telefone') THEN
        ALTER TABLE public.empregados ADD COLUMN telefone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='email') THEN
        ALTER TABLE public.empregados ADD COLUMN email TEXT;
    END IF;

    -- ── Converter salario_contratual para NUMERIC se ainda for TEXT ──
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='empregados'
                 AND column_name='salario_contratual' AND data_type = 'text') THEN
        ALTER TABLE public.empregados
            ALTER COLUMN salario_contratual TYPE NUMERIC(15,2)
            USING salario_contratual::numeric;
    END IF;
END $$;


-- ============================================================
-- 8. ROW LEVEL SECURITY — LGPD
--
-- Princípios aplicados:
--   • Necessidade: anon só pode inserir (enviar formulário),
--     nunca ler dados de terceiros.
--   • Segurança: dados pessoais inacessíveis a não-autenticados.
--   • Prevenção: sem UPDATE/DELETE por anon.
--   • Direito de acesso/apagamento (art. 18 LGPD): authenticated
--     pode consultar e deletar mediante solicitação do titular.
--   • Imutabilidade do log: historico_edicoes sem UPDATE/DELETE.
-- ============================================================

ALTER TABLE public.formularios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empregados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependentes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_edicoes ENABLE ROW LEVEL SECURITY;

-- ── formularios ──────────────────────────────────────────────
-- anon e authenticated: INSERT (formulário preenchido pelo cliente ou pela equipe)
-- authenticated: SELECT + UPDATE (gestão) + DELETE (apagamento a pedido do titular)
-- Nota LGPD: a sessão do portal persiste no localStorage; o cliente Supabase usa o
-- role "authenticated" mesmo nas páginas de formulário → INSERT deve ser permitido
-- para ambos os roles sem comprometer a restrição de leitura por anon.
DROP POLICY IF EXISTS "formularios: anon full"              ON public.formularios;
DROP POLICY IF EXISTS "formularios: authenticated full"     ON public.formularios;
DROP POLICY IF EXISTS "formularios: anon insert"            ON public.formularios;
DROP POLICY IF EXISTS "formularios: staff insert"           ON public.formularios;
DROP POLICY IF EXISTS "formularios: staff select"           ON public.formularios;
DROP POLICY IF EXISTS "formularios: staff update"           ON public.formularios;
DROP POLICY IF EXISTS "formularios: staff delete"           ON public.formularios;

CREATE POLICY "formularios: anon insert"
    ON public.formularios FOR INSERT TO anon
    WITH CHECK (TRUE);

CREATE POLICY "formularios: staff insert"
    ON public.formularios FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "formularios: staff select"
    ON public.formularios FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "formularios: staff update"
    ON public.formularios FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "formularios: staff delete"
    ON public.formularios FOR DELETE TO authenticated
    USING (TRUE);


-- ── socios ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "socios: anon full"           ON public.socios;
DROP POLICY IF EXISTS "socios: authenticated full"  ON public.socios;
DROP POLICY IF EXISTS "socios: anon insert"         ON public.socios;
DROP POLICY IF EXISTS "socios: staff insert"        ON public.socios;
DROP POLICY IF EXISTS "socios: staff select"        ON public.socios;
DROP POLICY IF EXISTS "socios: staff update"        ON public.socios;
DROP POLICY IF EXISTS "socios: staff delete"        ON public.socios;

CREATE POLICY "socios: anon insert"
    ON public.socios FOR INSERT TO anon
    WITH CHECK (TRUE);

CREATE POLICY "socios: staff insert"
    ON public.socios FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "socios: staff select"
    ON public.socios FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "socios: staff update"
    ON public.socios FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "socios: staff delete"
    ON public.socios FOR DELETE TO authenticated
    USING (TRUE);


-- ── empregados ───────────────────────────────────────────────
-- Contém dados sensíveis (saúde, banco, família) — acesso restrito
DROP POLICY IF EXISTS "empregados: anon full"           ON public.empregados;
DROP POLICY IF EXISTS "empregados: authenticated full"  ON public.empregados;
DROP POLICY IF EXISTS "empregados: anon insert"         ON public.empregados;
DROP POLICY IF EXISTS "empregados: staff insert"        ON public.empregados;
DROP POLICY IF EXISTS "empregados: staff select"        ON public.empregados;
DROP POLICY IF EXISTS "empregados: staff update"        ON public.empregados;
DROP POLICY IF EXISTS "empregados: staff delete"        ON public.empregados;

CREATE POLICY "empregados: anon insert"
    ON public.empregados FOR INSERT TO anon
    WITH CHECK (TRUE);

CREATE POLICY "empregados: staff insert"
    ON public.empregados FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "empregados: staff select"
    ON public.empregados FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "empregados: staff update"
    ON public.empregados FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "empregados: staff delete"
    ON public.empregados FOR DELETE TO authenticated
    USING (TRUE);


-- ── dependentes ──────────────────────────────────────────────
-- Dados de menores de idade — proteção reforçada (art. 14 LGPD)
DROP POLICY IF EXISTS "dependentes: anon full"           ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: authenticated full"  ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: anon insert"         ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: staff insert"        ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: staff select"        ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: staff update"        ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: staff delete"        ON public.dependentes;

CREATE POLICY "dependentes: anon insert"
    ON public.dependentes FOR INSERT TO anon
    WITH CHECK (TRUE);

CREATE POLICY "dependentes: staff insert"
    ON public.dependentes FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "dependentes: staff select"
    ON public.dependentes FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "dependentes: staff update"
    ON public.dependentes FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "dependentes: staff delete"
    ON public.dependentes FOR DELETE TO authenticated
    USING (TRUE);


-- ── arquivos ─────────────────────────────────────────────────
-- anon NÃO pode SELECT: impede acesso a documentos de terceiros
DROP POLICY IF EXISTS "arquivos: anon full"           ON public.arquivos;
DROP POLICY IF EXISTS "arquivos: authenticated full"  ON public.arquivos;
DROP POLICY IF EXISTS "arquivos: anon insert"         ON public.arquivos;
DROP POLICY IF EXISTS "arquivos: staff insert"        ON public.arquivos;
DROP POLICY IF EXISTS "arquivos: staff select"        ON public.arquivos;
DROP POLICY IF EXISTS "arquivos: staff update"        ON public.arquivos;
DROP POLICY IF EXISTS "arquivos: staff delete"        ON public.arquivos;

CREATE POLICY "arquivos: anon insert"
    ON public.arquivos FOR INSERT TO anon
    WITH CHECK (TRUE);

CREATE POLICY "arquivos: staff insert"
    ON public.arquivos FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "arquivos: staff select"
    ON public.arquivos FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "arquivos: staff update"
    ON public.arquivos FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "arquivos: staff delete"
    ON public.arquivos FOR DELETE TO authenticated
    USING (TRUE);


-- ── historico_edicoes ────────────────────────────────────────
-- Log imutável de auditoria: sem UPDATE nem DELETE para ninguém
-- anon não tem qualquer acesso (dados internos de operação)
DROP POLICY IF EXISTS "historico: anon full"           ON public.historico_edicoes;
DROP POLICY IF EXISTS "historico: authenticated full"  ON public.historico_edicoes;
DROP POLICY IF EXISTS "historico: staff select"        ON public.historico_edicoes;
DROP POLICY IF EXISTS "historico: staff insert"        ON public.historico_edicoes;

CREATE POLICY "historico: staff select"
    ON public.historico_edicoes FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "historico: staff insert"
    ON public.historico_edicoes FOR INSERT TO authenticated
    WITH CHECK (TRUE);


-- ============================================================
-- 9. STORAGE: bucket "documentos"
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documentos',
    'documentos',
    FALSE,
    52428800,   -- 50 MB
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage: bucket "documentos" ─────────────────────────────
-- anon: apenas INSERT (upload no envio do formulário)
-- anon NÃO pode SELECT: documentos pessoais acessíveis só pela equipe
-- authenticated: SELECT + DELETE (apagamento a pedido do titular LGPD art. 18)
DROP POLICY IF EXISTS "storage documentos: upload anon"          ON storage.objects;
DROP POLICY IF EXISTS "storage documentos: upload authenticated"  ON storage.objects;
DROP POLICY IF EXISTS "storage documentos: leitura authenticated" ON storage.objects;
DROP POLICY IF EXISTS "storage documentos: leitura anon"          ON storage.objects;
DROP POLICY IF EXISTS "storage documentos: delete authenticated"  ON storage.objects;

CREATE POLICY "storage documentos: upload anon"
    ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "storage documentos: upload authenticated"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "storage documentos: leitura authenticated"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'documentos');

CREATE POLICY "storage documentos: delete authenticated"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'documentos');


-- ============================================================
-- RESUMO DAS TABELAS
-- ============================================================
--
--  formularios (registro + alteracao)
--      ├──► socios          (formulario_id FK)
--      └──► arquivos        (formulario_id FK)
--
--  empregados
--      ├──► dependentes     (empregado_id FK)
--      └──► arquivos        (empregado_id FK)
--
--  historico_edicoes        (registro_id sem FK — aponta para qualquer tabela)
--
-- Estrutura de pastas no bucket "documentos":
--   Formularios/Registro/{nome_empresa}/
--   Formularios/Alteracao/{nome_empresa}/
--   Empregados/{cnpj_empresa}/{nome_empregado}/
--       Documentos-de-Identificacao/
--       Documentos-Familiares/
--       Documentos-Medicos/
--
-- ============================================================


-- ============================================================
-- 10. REALTIME — habilitar atualização automática no gerenciador
--     Execute no SQL Editor do Supabase após criar as tabelas.
--     REPLICA IDENTITY FULL garante que UPDATE e DELETE
--     enviem a linha completa (antes e depois) pelo canal.
-- ============================================================

ALTER TABLE public.formularios  REPLICA IDENTITY FULL;
ALTER TABLE public.empregados   REPLICA IDENTITY FULL;
ALTER TABLE public.socios       REPLICA IDENTITY FULL;

-- Adiciona as tabelas à publicação do Supabase Realtime.
-- Se a publicação já incluir ALL TABLES este bloco é desnecessário,
-- mas é seguro executar de qualquer forma.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'formularios'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.formularios;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'empregados'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.empregados;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'socios'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.socios;
    END IF;
END $$;
