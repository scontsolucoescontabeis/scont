-- ============================================================
-- BPO FINANCEIRO — Monitor de Documentos Publicados
--
-- A equipe sobe o relatório "Documentos Publicados" do Onvio na tela
-- Projeto BPO/index.html; o navegador interpreta o arquivo e grava aqui.
-- A edge function "bpo-alertas" envia os e-mails de alerta.
--
-- Acesso: somente admin do portal e equipe "SCONT Soluções Contábeis"
-- (as tabelas guardam e-mails de clientes). Prestador de Serviço não vê.
--
-- Execute no SQL Editor do Supabase. Idempotente.
-- ============================================================

-- 0. PERMISSÃO
CREATE OR REPLACE FUNCTION public.bpo_pode_gerir()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT public.is_admin() OR EXISTS (
        SELECT 1 FROM public.solicitacoes_acesso
        WHERE email = auth.email()
          AND lower(empresa) = 'scont soluções contábeis'
    );
$$;
GRANT EXECUTE ON FUNCTION public.bpo_pode_gerir() TO authenticated;


-- 1. CONFIGURAÇÃO GERAL (linha única)
CREATE TABLE IF NOT EXISTS public.bpo_config (
    id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    email_chefe             TEXT,
    emails_copia_relatorio  TEXT[] NOT NULL DEFAULT '{}',
    email_operador          TEXT,
    modo_teste              BOOLEAN NOT NULL DEFAULT TRUE,
    email_teste             TEXT,
    ignorar_emails_dominio  TEXT[] NOT NULL DEFAULT '{scontdf.com.br}',

    etapas                  JSONB NOT NULL DEFAULT '[{"tipo":"inicial","dia":1},{"tipo":"lembrete","dia":5},{"tipo":"lembrete","dia":10},{"tipo":"ultimo_aviso","dia":15},{"tipo":"relatorio","dia":17}]',
    ajustar_dia_util        BOOLEAN NOT NULL DEFAULT TRUE,
    feriados_extras         TEXT[] NOT NULL DEFAULT '{12-24,12-31}',
    dias_relatorio_antigo   SMALLINT NOT NULL DEFAULT 2,
    inicio_ciclos           DATE,   -- etapas com data anterior a esta não valem (NULL = sem limite)

    -- Variáveis: {cliente} {competencia} {competencia_extenso} {data_limite} {documentos}
    -- Formatação: linha em branco = parágrafo; "- " = item de lista; **texto** = negrito
    assunto_inicial         TEXT NOT NULL DEFAULT 'Solicitação de documentos — competência {competencia} — {cliente}',
    assunto_lembrete        TEXT NOT NULL DEFAULT 'Lembrete: documentos pendentes — competência {competencia} — {cliente}',
    assunto_ultimo_aviso    TEXT NOT NULL DEFAULT 'ÚLTIMO AVISO: documentos pendentes — competência {competencia} — {cliente}',
    assunto_relatorio       TEXT NOT NULL DEFAULT 'BPO Financeiro — documentos não recebidos — competência {competencia}',
    texto_inicial           TEXT NOT NULL DEFAULT E'Olá, **{cliente}**!\n\nChegou o momento de enviar os documentos da **competência {competencia_extenso}**:\n\n{documentos}\n\nPor favor, envie pelo **Onvio (Portal do Cliente)**, na pasta indicada.\n\nPrazo: até **{data_limite}**.\n\nQualquer dúvida, é só responder este e-mail.',
    texto_lembrete          TEXT NOT NULL DEFAULT E'Olá, **{cliente}**!\n\nAinda **não identificamos no Onvio** os documentos da **competência {competencia_extenso}**:\n\n{documentos}\n\nEles são necessários para o fechamento do mês. Por favor, envie pelo **Onvio (Portal do Cliente)**.\n\nPrazo final: **{data_limite}**.\n\nSe já enviou por outro canal, responda este e-mail para registrarmos.',
    texto_ultimo_aviso      TEXT NOT NULL DEFAULT E'Olá, **{cliente}**!\n\n**Último aviso:** os documentos da **competência {competencia_extenso}** ainda não chegaram:\n\n{documentos}\n\nHoje é o prazo final. Sem eles não conseguimos concluir o fechamento do mês, e a pendência será comunicada à coordenação do escritório.\n\nPor favor, envie ainda hoje pelo **Onvio (Portal do Cliente)**.\n\nSe houver alguma dificuldade, responda este e-mail que ajudamos.',

    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_por             TEXT
);
-- Bancos criados antes desta coluna existir:
ALTER TABLE public.bpo_config ADD COLUMN IF NOT EXISTS inicio_ciclos DATE;

INSERT INTO public.bpo_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- 2. EMPRESAS (marcador "possui BPO" + e-mails de cobrança)
--    Base de nomes/códigos: rh_empresas (referência lógica por codigo_empresa).
CREATE TABLE IF NOT EXISTS public.bpo_empresas (
    codigo_empresa  TEXT PRIMARY KEY,
    possui_bpo      BOOLEAN NOT NULL DEFAULT TRUE,
    emails          TEXT[] NOT NULL DEFAULT '{}',
    emails_cc       TEXT[] NOT NULL DEFAULT '{}',
    observacao      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_por     TEXT
);


-- 3. TIPOS DE DOCUMENTO MONITORADOS
CREATE TABLE IF NOT EXISTS public.bpo_tipos_documento (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL,
    pasta           TEXT NOT NULL,          -- trecho do nome da pasta no Onvio (sem acento/caixa)
    palavra_chave   TEXT,                   -- opcional: trecho do nome do arquivo
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    ordem           SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.bpo_tipos_documento (nome, pasta, palavra_chave, ordem)
SELECT 'Extrato bancário', 'Extrato Bancário e Relatórios Financeiros', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM public.bpo_tipos_documento);


-- 4. RELATÓRIOS IMPORTADOS
CREATE TABLE IF NOT EXISTS public.bpo_relatorios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_ini     DATE NOT NULL,
    periodo_fim     DATE NOT NULL,
    emitido_em      TIMESTAMPTZ,
    competencia     TEXT NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
    arquivo_nome    TEXT,
    total_clientes  INTEGER NOT NULL DEFAULT 0,
    total_arquivos  INTEGER NOT NULL DEFAULT 0,
    importado_por   TEXT,
    importado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bpo_relatorios_comp ON public.bpo_relatorios (competencia);


-- 5. PUBLICAÇÕES (linhas do relatório de empresas reconhecidas)
CREATE TABLE IF NOT EXISTS public.bpo_publicacoes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    relatorio_id    UUID NOT NULL REFERENCES public.bpo_relatorios(id) ON DELETE CASCADE,
    competencia     TEXT NOT NULL,
    codigo_empresa  TEXT NOT NULL,
    pasta           TEXT NOT NULL,
    arquivo         TEXT NOT NULL,
    vencimento      DATE,
    publicado_em    TIMESTAMPTZ,
    publicado_por   TEXT,
    visualizado_em  TIMESTAMPTZ,
    excluido_em     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bpo_publicacoes_comp ON public.bpo_publicacoes (competencia, codigo_empresa);


-- 6. VÍNCULOS NOME DO RELATÓRIO → EMPRESA
CREATE TABLE IF NOT EXISTS public.bpo_vinculos (
    nome_normalizado TEXT PRIMARY KEY,
    nome_original    TEXT NOT NULL,
    codigo_empresa   TEXT,                  -- NULL quando ignorar = true
    ignorar          BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 7. MARCAÇÕES MANUAIS (recebido por outro canal / dispensado)
CREATE TABLE IF NOT EXISTS public.bpo_marcacoes (
    competencia     TEXT NOT NULL,
    codigo_empresa  TEXT NOT NULL,
    tipo_id         UUID NOT NULL REFERENCES public.bpo_tipos_documento(id) ON DELETE CASCADE,
    situacao        TEXT NOT NULL CHECK (situacao IN ('RECEBIDO_MANUAL', 'DISPENSADO')),
    motivo          TEXT,
    marcado_por     TEXT,
    marcado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competencia, codigo_empresa, tipo_id)
);


-- 8. HISTÓRICO DE ALERTAS (1 linha por e-mail enviado ou tentado)
CREATE TABLE IF NOT EXISTS public.bpo_alertas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competencia     TEXT NOT NULL,
    codigo_empresa  TEXT,                   -- NULL no relatório da chefe
    etapa           TEXT NOT NULL,          -- D1, D5, D10, D15, D17 ou MANUAL
    tipo_texto      TEXT NOT NULL,          -- inicial | lembrete | ultimo_aviso | relatorio
    documentos      TEXT[] NOT NULL DEFAULT '{}',
    para            TEXT[] NOT NULL DEFAULT '{}',
    ok              BOOLEAN NOT NULL,
    modo_teste      BOOLEAN NOT NULL DEFAULT FALSE,
    erro            TEXT,
    enviado_por     TEXT,
    enviado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bpo_alertas_comp ON public.bpo_alertas (competencia, codigo_empresa);


-- 9. RLS — tudo restrito a admin / equipe Scont
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['bpo_config', 'bpo_empresas', 'bpo_tipos_documento', 'bpo_relatorios',
                             'bpo_publicacoes', 'bpo_vinculos', 'bpo_marcacoes', 'bpo_alertas']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "%s: scont/admin" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "%s: scont/admin" ON public.%I FOR ALL TO authenticated '
                       'USING (public.bpo_pode_gerir()) WITH CHECK (public.bpo_pode_gerir())', t, t);
    END LOOP;
END $$;


-- 10. updated_at automático
CREATE OR REPLACE FUNCTION public.bpo_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bpo_config_upd   ON public.bpo_config;
DROP TRIGGER IF EXISTS trg_bpo_empresas_upd ON public.bpo_empresas;
CREATE TRIGGER trg_bpo_config_upd   BEFORE UPDATE ON public.bpo_config   FOR EACH ROW EXECUTE FUNCTION public.bpo_set_updated_at();
CREATE TRIGGER trg_bpo_empresas_upd BEFORE UPDATE ON public.bpo_empresas FOR EACH ROW EXECUTE FUNCTION public.bpo_set_updated_at();
