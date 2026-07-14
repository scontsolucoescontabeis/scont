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
    jornada_sabado              TEXT,               -- ex: "04:00" (jornada diferenciada do Sábado)
    jornada_sabado_ativa        BOOLEAN DEFAULT FALSE,
    sabado_sempre_extra         BOOLEAN DEFAULT FALSE, -- todas as horas do sábado contam como extra (exclusivo com jornada_sabado_ativa)
    jornada_sexta               TEXT,               -- ex: "04:00" (jornada diferenciada da Sexta-feira)
    jornada_sexta_ativa         BOOLEAN DEFAULT FALSE,
    rule_extra_100_opcional     BOOLEAN DEFAULT FALSE,

    -- Campos JSON com os dados da folha
    dados_json                  JSONB,              -- [{data, diaSemana, entrada1, saida1, entrada2, saida2}, ...]
    feriados_json               JSONB,              -- [{data: "DD/MM", descricao: "..."}, ...]
    dsr_dias                    JSONB,              -- ["01/01/2026", "02/01/2026", ...]
    flags_folga                 JSONB,              -- {"01/01/2026": "folga"|"falta", ...}

    -- Auditoria
    responsavel_alteracao       TEXT,
    status                      TEXT DEFAULT 'rascunho',
    criado_por                  TEXT,
    atualizado_por              TEXT,
    nome_usuario                TEXT,
    data_criacao                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_atualizacao            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rh_saves_empresa_trabalhador_competencia_unique
        UNIQUE (empresa_codigo, nome_trabalhador, competencia)
);

-- Remove constraint de status se existir de execução anterior
ALTER TABLE public.rh_saves DROP CONSTRAINT IF EXISTS rh_saves_status_check;

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
--
--    Padrão: DROP IF EXISTS antes de CREATE para permitir
--    re-execução segura do schema sem erros de duplicidade.
-- ============================================================

-- 7.1 rh_empresas
ALTER TABLE public.rh_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_empresas: leitura autenticado" ON public.rh_empresas;
DROP POLICY IF EXISTS "rh_empresas: escrita autenticado"  ON public.rh_empresas;

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

DROP POLICY IF EXISTS "rh_empregados: leitura autenticado" ON public.rh_empregados;
DROP POLICY IF EXISTS "rh_empregados: escrita autenticado"  ON public.rh_empregados;

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

DROP POLICY IF EXISTS "rh_rubricas: leitura autenticado" ON public.rh_rubricas;
DROP POLICY IF EXISTS "rh_rubricas: escrita autenticado"  ON public.rh_rubricas;

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

DROP POLICY IF EXISTS "rh_saves: leitura autenticado" ON public.rh_saves;
DROP POLICY IF EXISTS "rh_saves: escrita autenticado"  ON public.rh_saves;

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

DROP POLICY IF EXISTS "rh_regras: leitura autenticado" ON public.rh_regras_renomeacao;
DROP POLICY IF EXISTS "rh_regras: escrita autenticado"  ON public.rh_regras_renomeacao;

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

DROP POLICY IF EXISTS "rh_mapeamento: leitura autenticado" ON public.rh_mapeamento_nomes;
DROP POLICY IF EXISTS "rh_mapeamento: escrita autenticado"  ON public.rh_mapeamento_nomes;

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
-- 8. TABELA: rh_config_rubricas_txt
--    Presets de rubricas TXT por empresa (8 eventos fixos) +
--    config geral por empresa (jornada, observacoes, regras de
--    horas extras/turnos): jornada_diaria, jornada_sexta_ativa,
--    jornada_sexta, jornada_sabado_ativa, jornada_sabado,
--    sabado_sempre_extra, observacoes, rule_extra_100_opcional,
--    terceiro_turno, nao_compensar_extras
--    Coluna real descricao_rubrica: usada só por rubricas
--    personalizadas cadastradas pela ferramenta de Lançamentos
--    (evento fora do conjunto fixo, ex: "custom_<uuid>").
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_config_rubricas_txt (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa TEXT NOT NULL,
    evento         TEXT NOT NULL,
    codigo_rubrica TEXT NOT NULL DEFAULT '',
    tipo_valor     TEXT NOT NULL DEFAULT 'horas',
    CONSTRAINT rh_config_rub_txt_uniq UNIQUE (codigo_empresa, evento)
);

CREATE INDEX IF NOT EXISTS idx_rh_cfg_rub_txt_empresa
    ON public.rh_config_rubricas_txt (codigo_empresa);

-- 8. RLS
ALTER TABLE public.rh_config_rubricas_txt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_config_rub_txt: leitura autenticado" ON public.rh_config_rubricas_txt;
DROP POLICY IF EXISTS "rh_config_rub_txt: escrita autenticado"  ON public.rh_config_rubricas_txt;

CREATE POLICY "rh_config_rub_txt: leitura autenticado"
    ON public.rh_config_rubricas_txt FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "rh_config_rub_txt: escrita autenticado"
    ON public.rh_config_rubricas_txt FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- TABELA: rh_grupos_empresas
--    Grupos nomeados de empresas para operações em lote.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_grupos_empresas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_grupo  TEXT NOT NULL UNIQUE,
    observacoes TEXT NOT NULL DEFAULT '',
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migração idempotente para bancos onde a tabela já existia sem a coluna
ALTER TABLE public.rh_grupos_empresas ADD COLUMN IF NOT EXISTS observacoes TEXT NOT NULL DEFAULT '';

ALTER TABLE public.rh_grupos_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_grupos_empresas: leitura autenticado" ON public.rh_grupos_empresas;
DROP POLICY IF EXISTS "rh_grupos_empresas: escrita autenticado" ON public.rh_grupos_empresas;

CREATE POLICY "rh_grupos_empresas: leitura autenticado"
    ON public.rh_grupos_empresas FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_grupos_empresas: escrita autenticado"
    ON public.rh_grupos_empresas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- TABELA: rh_grupos_empresas_itens
--    Empresas pertencentes a cada grupo.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_grupos_empresas_itens (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id       UUID NOT NULL REFERENCES public.rh_grupos_empresas(id) ON DELETE CASCADE,
    codigo_empresa TEXT NOT NULL,
    CONSTRAINT rh_grupo_item_uniq UNIQUE (grupo_id, codigo_empresa)
);

CREATE INDEX IF NOT EXISTS idx_rh_grupo_itens_grupo ON public.rh_grupos_empresas_itens (grupo_id);

ALTER TABLE public.rh_grupos_empresas_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_grupos_empresas_itens: leitura autenticado" ON public.rh_grupos_empresas_itens;
DROP POLICY IF EXISTS "rh_grupos_empresas_itens: escrita autenticado" ON public.rh_grupos_empresas_itens;

CREATE POLICY "rh_grupos_empresas_itens: leitura autenticado"
    ON public.rh_grupos_empresas_itens FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_grupos_empresas_itens: escrita autenticado"
    ON public.rh_grupos_empresas_itens FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- 9. TABELA: rh_feriados
--    Calendário de feriados global, compartilhado por todas as empresas.
--    Ver migração: schema_rh_feriados_globais.sql
-- ============================================================
-- CREATE TABLE public.rh_feriados (
--     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     data        TEXT NOT NULL,       -- "DD/MM" ou "DD/MM/AAAA"
--     descricao   TEXT NOT NULL,
--     criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );


-- ============================================================
-- 10. TABELA: rh_ferias_calculadas
--    Períodos de férias por empregado, importados do PDF
--    "Relação de Férias Calculadas" do sistema fonte, via
--    Administração > Importar Dados (admin.html).
--    Upsert por (codigo_empresa, codigo_empregado, ferias_inicio).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_ferias_calculadas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    nome_empresa      TEXT,
    codigo_empregado  TEXT NOT NULL,
    nome_empregado    TEXT NOT NULL,
    aquisitivo_inicio DATE,
    aquisitivo_fim    DATE,
    ferias_inicio     DATE NOT NULL,
    ferias_fim        DATE NOT NULL,
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rh_ferias_calc_uniq UNIQUE (codigo_empresa, codigo_empregado, ferias_inicio)
);

CREATE INDEX IF NOT EXISTS idx_rh_ferias_empresa_empregado
    ON public.rh_ferias_calculadas (codigo_empresa, codigo_empregado);

ALTER TABLE public.rh_ferias_calculadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_ferias_calculadas: leitura autenticado"
    ON public.rh_ferias_calculadas FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_ferias_calculadas: escrita autenticado"
    ON public.rh_ferias_calculadas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


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
--  rh_config_rubricas_txt  presets de rubricas TXT por empresa
--
-- MIGRAÇÃO DO PROJETO ANTERIOR (udnikmolgryzczalcbbz):
--   Se houver dados a migrar, exporte-os do projeto antigo e
--   importe nas tabelas rh_* deste projeto via CSV ou SQL.
--
-- ============================================================
