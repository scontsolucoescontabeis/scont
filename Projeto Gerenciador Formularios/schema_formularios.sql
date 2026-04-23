-- ============================================================
-- SCONT - GERENCIADOR DE FORMULÁRIOS
-- Schema Supabase completo
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================


-- ============================================================
-- 1. TABELA: formularios
--    Registros de abertura de empresa (registro) e alterações
-- ============================================================
CREATE TABLE IF NOT EXISTS public.formularios (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_formulario             TEXT NOT NULL CHECK (tipo_formulario IN ('registro', 'alteracao')),
    status                      TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'validado', 'rejeitado')),

    -- Dados gerais (ambos os tipos)
    razao_social                TEXT,
    cnpj                        TEXT,
    nome_fantasia               TEXT,
    email_comercial             TEXT,
    email_comercial_novo        TEXT,       -- apenas alteracao
    telefone_comercial          TEXT,
    telefone_comercial_novo     TEXT,       -- apenas alteracao
    cep                         TEXT,
    logradouro                  TEXT,
    numero                      TEXT,
    complemento                 TEXT,
    bairro                      TEXT,
    cidade                      TEXT,
    estado                      TEXT,
    inscricao_estadual          TEXT,
    inscricao_municipal         TEXT,
    regime_tributario           TEXT,
    simples_nacional            TEXT,
    mei                         TEXT,
    imune_isento                TEXT,

    -- Campos exclusivos de registro
    porte_empresa               TEXT,
    horario                     TEXT,
    forma_atuacao               TEXT,       -- presencial / online / ambos
    cnae_principal              TEXT,
    atividades_secundarias      TEXT,
    capital_social              TEXT,       -- valor formatado (moeda)
    data_inicio_atividades      DATE,
    natureza_juridica           TEXT,
    objeto_social               TEXT,
    observacoes                 TEXT,

    -- Campos exclusivos de alteração
    tipo_alteracao              TEXT,       -- alteracao_endereco / alteracao_socios / etc.
    descricao_alteracao         TEXT,
    motivo_alteracao            TEXT,
    -- Alteração de endereço
    cep_novo                    TEXT,
    logradouro_novo             TEXT,
    numero_novo                 TEXT,
    complemento_novo            TEXT,
    bairro_novo                 TEXT,
    cidade_nova                 TEXT,
    estado_novo                 TEXT,
    -- Alteração de capital social
    capital_social_atual        TEXT,
    capital_social_novo         TEXT,
    -- Outros campos de alteração
    cnae_principal_novo         TEXT,
    regime_tributario_novo      TEXT,
    nome_fantasia_novo          TEXT,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formularios_tipo   ON public.formularios (tipo_formulario);
CREATE INDEX IF NOT EXISTS idx_formularios_status ON public.formularios (status);
CREATE INDEX IF NOT EXISTS idx_formularios_cnpj   ON public.formularios (cnpj);
CREATE INDEX IF NOT EXISTS idx_formularios_created ON public.formularios (created_at DESC);


-- ============================================================
-- 2. TABELA: socios
--    Sócios vinculados a um formulário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.socios (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formulario_id           UUID NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
    numero_socio            INTEGER NOT NULL DEFAULT 1,
    nome                    TEXT,
    cpf                     TEXT,
    rg                      TEXT,
    cnh                     TEXT,
    endereco_residencial    TEXT,
    cep                     TEXT,
    email                   TEXT,
    celular                 TEXT,
    estado_civil            TEXT,
    regime_partilha         TEXT,
    naturalidade            TEXT,
    profissao               TEXT,
    participacao            TEXT,       -- porcentagem formatada
    administrador           BOOLEAN NOT NULL DEFAULT FALSE,
    responsavel_cnpj        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socios_formulario ON public.socios (formulario_id);


-- ============================================================
-- 3. TABELA: empregados
--    Fichas de admissão de empregados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empregados (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_formulario             TEXT NOT NULL DEFAULT 'empregado',

    -- Dados da empresa
    empresa                     TEXT,
    cnpj_empresa                TEXT,
    cargo                       TEXT,
    salario                     TEXT,
    data_admissao               DATE,
    horario_trabalho            TEXT,
    dias_trabalho               TEXT[],     -- array: ['seg','ter','qua',...]
    tipo_contrato               TEXT,

    -- Dados pessoais
    nome                        TEXT,
    cpf                         TEXT UNIQUE,
    rg                          TEXT,
    data_nascimento             DATE,
    sexo                        TEXT,
    estado_civil                TEXT,
    escolaridade                TEXT,
    naturalidade                TEXT,
    nacionalidade               TEXT,
    nome_mae                    TEXT,
    nome_pai                    TEXT,

    -- Endereço
    cep                         TEXT,
    logradouro                  TEXT,
    numero                      TEXT,
    complemento                 TEXT,
    bairro                      TEXT,
    cidade                      TEXT,
    estado                      TEXT,

    -- Contato
    telefone                    TEXT,
    email                       TEXT,

    -- Documentos / benefícios
    pis_pasep                   TEXT,
    ctps_numero                 TEXT,
    ctps_serie                  TEXT,
    ctps_uf                     TEXT,
    titulo_eleitor              TEXT,
    zona_eleitoral              TEXT,
    secao_eleitoral             TEXT,
    cnh_numero                  TEXT,
    cnh_categoria               TEXT,
    cnh_validade                DATE,
    cnh_primeira_habilitacao    DATE,
    reservista                  TEXT,

    -- Conta bancária
    banco                       TEXT,
    agencia                     TEXT,
    conta                       TEXT,
    tipo_conta                  TEXT,
    pix                         TEXT,

    -- Informações adicionais
    deficiencia                 TEXT,
    tipo_deficiencia            TEXT,
    usa_vale_transporte         BOOLEAN DEFAULT FALSE,
    valor_vale_transporte       TEXT,
    observacoes                 TEXT,

    status                      TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'validado', 'rejeitado')),
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
    empregado_id    UUID REFERENCES public.empregados(id) ON DELETE CASCADE,
    tipo_documento  TEXT,       -- ex: 'Contrato Social', 'RG', 'CPF', etc.
    nome_arquivo    TEXT NOT NULL,
    caminho_storage TEXT NOT NULL,  -- path dentro do bucket
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
--    Log de alterações feitas pelo gerenciador
-- ============================================================
CREATE TABLE IF NOT EXISTS public.historico_edicoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela          TEXT NOT NULL,  -- 'formularios', 'socios', 'empregados', 'dependentes'
    registro_id     UUID NOT NULL,
    campo           TEXT NOT NULL,
    valor_anterior  TEXT,
    valor_novo      TEXT,
    editado_por     TEXT,           -- e-mail ou nome do admin
    editado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_registro ON public.historico_edicoes (registro_id);
CREATE INDEX IF NOT EXISTS idx_historico_tabela   ON public.historico_edicoes (tabela);
CREATE INDEX IF NOT EXISTS idx_historico_editado  ON public.historico_edicoes (editado_em DESC);


-- ============================================================
-- 7. ROW LEVEL SECURITY
--    Políticas permissivas: formulários usam a chave anon,
--    sem login do usuário → precisamos permitir acesso anônimo.
-- ============================================================

-- 7.1 formularios — acesso total para anon e authenticated
ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formularios: acesso total anon"
    ON public.formularios FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "formularios: acesso total authenticated"
    ON public.formularios FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.2 socios
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "socios: acesso total anon"
    ON public.socios FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "socios: acesso total authenticated"
    ON public.socios FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.3 empregados
ALTER TABLE public.empregados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empregados: acesso total anon"
    ON public.empregados FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "empregados: acesso total authenticated"
    ON public.empregados FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.4 dependentes
ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dependentes: acesso total anon"
    ON public.dependentes FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "dependentes: acesso total authenticated"
    ON public.dependentes FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.5 arquivos
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arquivos: acesso total anon"
    ON public.arquivos FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "arquivos: acesso total authenticated"
    ON public.arquivos FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.6 historico_edicoes
ALTER TABLE public.historico_edicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico: acesso total anon"
    ON public.historico_edicoes FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "historico: acesso total authenticated"
    ON public.historico_edicoes FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- ============================================================
-- 8. STORAGE: bucket "documentos"
--    Criar o bucket via dashboard ou via API.
--    Estrutura de pastas esperada:
--
--    documentos/
--    ├── Alteracao/{cnpj_ou_empresa}/{tipo_documento}/
--    └── Novos-Empregados/{cnpj_ou_empresa}/{nome_empregado}/
--        ├── Formulario/
--        ├── Documentos-de-Identificacao/
--        ├── Documentos-Familiares/
--        └── Documentos-Medicos/
--
-- Execute no SQL Editor para criar política de storage permissiva:
-- ============================================================

-- Política de storage para bucket "documentos"
-- (Execute após criar o bucket pelo painel do Supabase)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documentos',
    'documentos',
    FALSE,
    52428800,   -- 50 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage documentos: upload anon"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "storage documentos: upload authenticated"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "storage documentos: leitura authenticated"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'documentos');

CREATE POLICY "storage documentos: leitura anon"
    ON storage.objects FOR SELECT
    TO anon
    USING (bucket_id = 'documentos');

CREATE POLICY "storage documentos: delete authenticated"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'documentos');


-- ============================================================
-- RESUMO DAS TABELAS
-- ============================================================
--
--  formularios (registro + alteracao)
--      │
--      ├──► socios          (formulario_id FK)
--      └──► arquivos        (formulario_id FK)
--
--  empregados
--      ├──► dependentes     (empregado_id FK)
--      └──► arquivos        (empregado_id FK)
--
--  historico_edicoes        (registro_id sem FK — aponta para qualquer tabela)
--
-- Fluxo principal:
--   1. Usuário preenche formulário HTML → INSERT em formularios + socios
--   2. Upload de arquivos → storage bucket "documentos" + INSERT em arquivos
--   3. Gerenciador lê todos os registros, filtra por tipo/status
--   4. Admin edita via modal → UPDATE + INSERT em historico_edicoes
--
-- ============================================================
