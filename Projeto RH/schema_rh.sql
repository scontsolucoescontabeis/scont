-- ============================================================
-- SCONT – PROJETO RH
-- Schema Supabase completo
-- Execute no SQL Editor do Supabase (mesmo projeto do Portal SCONT)
-- Tabelas prefixadas com "rh_" para evitar conflito com outros módulos
-- ============================================================


-- ============================================================
-- 1. TABELA: rh_empresas
--    Cadastro de empresas gerenciadas pelo módulo RH
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_empresas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL UNIQUE,
    nome_empresa    TEXT NOT NULL,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_empresas_codigo ON public.rh_empresas (codigo_empresa);


-- ============================================================
-- 2. TABELA: rh_empregados
--    Empregados por empresa (referência para folha de ponto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_empregados (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa      TEXT NOT NULL,
    codigo_empregado    TEXT NOT NULL,
    nome_empregado      TEXT NOT NULL,
    data_criacao        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rh_empregados_empresa_codigo_unique UNIQUE (codigo_empresa, codigo_empregado)
);

CREATE INDEX IF NOT EXISTS idx_rh_empregados_empresa ON public.rh_empregados (codigo_empresa);


-- ============================================================
-- 3. TABELA: rh_rubricas
--    Mapeamento evento → código de rubrica por empresa
--    Eventos: horasTrabalhadas, horasExtras50, horasExtras100,
--             horasNoturnaConvertida, horasDevidas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_rubricas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    evento          TEXT NOT NULL,
    codigo_rubrica  TEXT NOT NULL,

    CONSTRAINT rh_rubricas_empresa_evento_unique UNIQUE (codigo_empresa, evento)
);

CREATE INDEX IF NOT EXISTS idx_rh_rubricas_empresa ON public.rh_rubricas (codigo_empresa);


-- ============================================================
-- 4. TABELA: rh_saves
--    Folhas de ponto salvas por empregado/competência
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_saves (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id                  UUID,               -- auth.users.id do responsável pelo lançamento
    empresa_codigo              TEXT NOT NULL,
    nome_trabalhador            TEXT NOT NULL,
    competencia                 TEXT NOT NULL,      -- formato MM/AAAA
    jornada                     TEXT,               -- ex: "08:00-12:00 13:00-17:00"
    rule_extra_100_opcional     BOOLEAN DEFAULT FALSE,

    -- Campos JSON com os dados da folha
    dados_json                  JSONB,              -- [{data, diaSemana, entrada1, saida1, entrada2, saida2}, ...]
    feriados_json               JSONB,              -- [{data: "DD/MM", descricao: "..."}, ...]
    dsr_dias                    JSONB,              -- ["01/01/2026", "02/01/2026", ...]
    flags_folga                 JSONB,              -- {"01/01/2026": "folga"|"falta", ...}

    -- Auditoria
    responsavel_alteracao       TEXT,
    status                      TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizado', 'exportado')),
    criado_por                  TEXT,
    atualizado_por              TEXT,
    nome_usuario                TEXT,
    data_criacao                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_atualizacao            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rh_saves_empresa_trabalhador_competencia_unique
        UNIQUE (empresa_codigo, nome_trabalhador, competencia)
);

CREATE INDEX IF NOT EXISTS idx_rh_saves_empresa     ON public.rh_saves (empresa_codigo);
CREATE INDEX IF NOT EXISTS idx_rh_saves_competencia ON public.rh_saves (competencia);
CREATE INDEX IF NOT EXISTS idx_rh_saves_usuario     ON public.rh_saves (usuario_id);


-- ============================================================
-- 5. TABELA: rh_regras_renomeacao
--    Regras de renomeação de arquivos para o módulo Renomeador
--    Suporte a templates: {CODIGO_EMPRESA}, {NOME_ARQUIVO}, {MM}, {AAAA}
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_regras_renomeacao (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    padrao_de   TEXT NOT NULL,      -- padrão de entrada (regex template)
    padrao_para TEXT NOT NULL,      -- padrão de saída (template com variáveis)
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. TABELA: rh_mapeamento_nomes
--    Dicionário de nomes de arquivo → nome de documento
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_mapeamento_nomes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_arquivo    TEXT NOT NULL UNIQUE,
    nome_documento  TEXT NOT NULL,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 7. ROW LEVEL SECURITY
--    Políticas permissivas para usuários autenticados.
--    O controle de acesso real é feito pelo Portal SCONT
--    (usuário precisa estar logado e ter a ferramenta liberada).
-- ============================================================

-- 7.1 rh_empresas
ALTER TABLE public.rh_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_empresas: leitura autenticado"
    ON public.rh_empresas FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "rh_empresas: escrita autenticado"
    ON public.rh_empresas FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.2 rh_empregados
ALTER TABLE public.rh_empregados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_empregados: leitura autenticado"
    ON public.rh_empregados FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "rh_empregados: escrita autenticado"
    ON public.rh_empregados FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.3 rh_rubricas
ALTER TABLE public.rh_rubricas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_rubricas: leitura autenticado"
    ON public.rh_rubricas FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "rh_rubricas: escrita autenticado"
    ON public.rh_rubricas FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.4 rh_saves
ALTER TABLE public.rh_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_saves: leitura autenticado"
    ON public.rh_saves FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "rh_saves: escrita autenticado"
    ON public.rh_saves FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.5 rh_regras_renomeacao
ALTER TABLE public.rh_regras_renomeacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_regras: leitura autenticado"
    ON public.rh_regras_renomeacao FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "rh_regras: escrita autenticado"
    ON public.rh_regras_renomeacao FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- 7.6 rh_mapeamento_nomes
ALTER TABLE public.rh_mapeamento_nomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_mapeamento: leitura autenticado"
    ON public.rh_mapeamento_nomes FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "rh_mapeamento: escrita autenticado"
    ON public.rh_mapeamento_nomes FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);


-- ============================================================
-- RESUMO DAS TABELAS
-- ============================================================
--
--  rh_empresas          cadastro de empresas
--      │
--      ├──► rh_empregados     (codigo_empresa FK lógica)
--      └──► rh_rubricas       (codigo_empresa FK lógica)
--
--  rh_saves             folhas de ponto (dados em JSONB)
--  rh_regras_renomeacao regras do módulo Renomeador
--  rh_mapeamento_nomes  dicionário nome_arquivo → nome_documento
--
-- MIGRAÇÃO DO PROJETO ANTERIOR (udnikmolgryzczalcbbz):
--   Se houver dados a migrar, exporte-os do projeto antigo e
--   importe nas tabelas rh_* deste projeto via CSV ou SQL.
--
-- ============================================================
