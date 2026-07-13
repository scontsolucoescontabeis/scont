-- ============================================================
-- SCONT – CALENDÁRIO DA FOLHA DE PAGAMENTO
-- Schema Supabase do módulo de cronograma da folha
-- Execute no SQL Editor do Supabase (mesmo projeto do Portal SCONT)
--
-- Reaproveita tabelas existentes:
--   • rh_empresas  (cadastro de empresas do módulo RH)
--   • rh_feriados  (feriados globais — cálculo de dia útil)
-- ============================================================


-- ============================================================
-- 1. TABELA: cal_folha_templates
--    Cronograma recorrente (modelo de atividades da folha).
--    codigo_empresa NULL = geral (na geração da competência vira
--    1 evento único, calendário unificado); preenchido = atividade
--    exclusiva daquela empresa (gera 1 evento só dela).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cal_folha_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT,                                -- NULL = todas as empresas
    titulo          TEXT NOT NULL,
    descricao       TEXT,
    tipo            TEXT NOT NULL DEFAULT 'fechamento'
                        CHECK (tipo IN ('fechamento','pagamento','obrigacao','envio',
                                        'ferias','decimo','alerta','observacao','outro')),
    prioridade      TEXT NOT NULL DEFAULT 'atencao'
                        CHECK (prioridade IN ('critico','urgente','atencao','info')),
    regra           TEXT NOT NULL DEFAULT 'dia_fixo'
                        CHECK (regra IN ('dia_fixo','dia_util','ultimo_dia_util')),
    dia             INTEGER NOT NULL DEFAULT 1,          -- dia do mês OU n-ésimo dia útil
    mes_offset      INTEGER NOT NULL DEFAULT 0,          -- 0 = mesmo mês da competência; 1 = mês seguinte
    mes_especifico  INTEGER,                             -- NULL = todo mês; 1-12 = só nessa competência (ex.: 13º)
    ajuste          TEXT NOT NULL DEFAULT 'antecipa'
                        CHECK (ajuste IN ('antecipa','posterga','mantem')),  -- quando cai em dia não útil
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_templates_empresa ON public.cal_folha_templates (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_cal_templates_ativo   ON public.cal_folha_templates (ativo);


-- ============================================================
-- 2. TABELA: cal_folha_eventos
--    Eventos concretos do calendário (gerados do cronograma
--    ou criados manualmente: prazos, tarefas, alertas, observações)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cal_folha_eventos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT,                                -- NULL = geral (todas as empresas)
    titulo          TEXT NOT NULL,
    descricao       TEXT,
    tipo            TEXT NOT NULL DEFAULT 'outro'
                        CHECK (tipo IN ('fechamento','pagamento','obrigacao','envio',
                                        'ferias','decimo','alerta','observacao','outro')),
    prioridade      TEXT NOT NULL DEFAULT 'atencao'
                        CHECK (prioridade IN ('critico','urgente','atencao','info')),
    data            DATE NOT NULL,
    competencia     TEXT NOT NULL,                       -- 'AAAA-MM'
    status          TEXT NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente','em_andamento','concluido')),
    responsavel     TEXT,
    origem          TEXT NOT NULL DEFAULT 'manual'
                        CHECK (origem IN ('manual','cronograma')),
    template_id     UUID REFERENCES public.cal_folha_templates(id) ON DELETE SET NULL,
    concluido_por   TEXT,
    concluido_em    TIMESTAMPTZ,
    criado_por      TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_eventos_data        ON public.cal_folha_eventos (data);
CREATE INDEX IF NOT EXISTS idx_cal_eventos_empresa     ON public.cal_folha_eventos (codigo_empresa);
CREATE INDEX IF NOT EXISTS idx_cal_eventos_competencia ON public.cal_folha_eventos (competencia);
CREATE INDEX IF NOT EXISTS idx_cal_eventos_status      ON public.cal_folha_eventos (status, data);

-- Evita duplicar evento gerado do cronograma para a mesma competência.
-- Calendário é único: um template geral (codigo_empresa NULL) gera
-- 1 evento só; um template de empresa específica gera 1 evento dela.
-- Dois índices porque UNIQUE padrão trata NULL como distinto de NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_eventos_geracao_unica_empresa
    ON public.cal_folha_eventos (template_id, codigo_empresa, competencia)
    WHERE template_id IS NOT NULL AND codigo_empresa IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_eventos_geracao_unica_geral
    ON public.cal_folha_eventos (template_id, competencia)
    WHERE template_id IS NOT NULL AND codigo_empresa IS NULL;


-- ============================================================
-- 3. TABELA: cal_folha_observacoes
--    Observações por empresa dentro de um evento do calendário
--    único (ex.: "Empresa X pediu prorrogação"). Mural de notas,
--    não sobrescreve histórico anterior.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cal_folha_observacoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       UUID NOT NULL REFERENCES public.cal_folha_eventos(id) ON DELETE CASCADE,
    codigo_empresa  TEXT NOT NULL,
    texto           TEXT NOT NULL,
    criado_por      TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_obs_evento  ON public.cal_folha_observacoes (evento_id);
CREATE INDEX IF NOT EXISTS idx_cal_obs_empresa ON public.cal_folha_observacoes (codigo_empresa);


-- ============================================================
-- 4. TABELA: cal_folha_checklist_itens
--    Checklist dentro de um evento. codigo_empresa NULL = item
--    genérico (não amarrado a nenhuma empresa); preenchido = item
--    daquela empresa específica (criado avulso ou "para todas").
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cal_folha_checklist_itens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       UUID NOT NULL REFERENCES public.cal_folha_eventos(id) ON DELETE CASCADE,
    codigo_empresa  TEXT,                                 -- NULL = item genérico
    texto           TEXT NOT NULL,
    concluido       BOOLEAN NOT NULL DEFAULT FALSE,
    concluido_por   TEXT,
    concluido_em    TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_check_evento  ON public.cal_folha_checklist_itens (evento_id);
CREATE INDEX IF NOT EXISTS idx_cal_check_empresa ON public.cal_folha_checklist_itens (codigo_empresa);


-- ============================================================
-- 5. ROW LEVEL SECURITY
--    Mesmo padrão dos demais módulos internos (RH / Fechamento):
--    qualquer usuário autenticado lê e escreve; o acesso à
--    ferramenta em si é controlado pelo portal-auth-guard
--    (tabela usuario_ferramentas).
-- ============================================================
ALTER TABLE public.cal_folha_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cal_folha_eventos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cal_folha_observacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cal_folha_checklist_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cal_templates: leitura autenticado" ON public.cal_folha_templates;
DROP POLICY IF EXISTS "cal_templates: escrita autenticado"  ON public.cal_folha_templates;
DROP POLICY IF EXISTS "cal_eventos: leitura autenticado"    ON public.cal_folha_eventos;
DROP POLICY IF EXISTS "cal_eventos: escrita autenticado"     ON public.cal_folha_eventos;
DROP POLICY IF EXISTS "cal_obs: leitura autenticado"        ON public.cal_folha_observacoes;
DROP POLICY IF EXISTS "cal_obs: escrita autenticado"        ON public.cal_folha_observacoes;
DROP POLICY IF EXISTS "cal_check: leitura autenticado"      ON public.cal_folha_checklist_itens;
DROP POLICY IF EXISTS "cal_check: escrita autenticado"      ON public.cal_folha_checklist_itens;

CREATE POLICY "cal_templates: leitura autenticado"
    ON public.cal_folha_templates FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "cal_templates: escrita autenticado"
    ON public.cal_folha_templates FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "cal_eventos: leitura autenticado"
    ON public.cal_folha_eventos FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "cal_eventos: escrita autenticado"
    ON public.cal_folha_eventos FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "cal_obs: leitura autenticado"
    ON public.cal_folha_observacoes FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "cal_obs: escrita autenticado"
    ON public.cal_folha_observacoes FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "cal_check: leitura autenticado"
    ON public.cal_folha_checklist_itens FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "cal_check: escrita autenticado"
    ON public.cal_folha_checklist_itens FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- 6. SEED: cronograma padrão de obrigações da folha
--    Modelos globais (todas as empresas). Ajuste dias e regras
--    conforme a rotina do escritório — são apenas ponto de partida.
-- ============================================================
INSERT INTO public.cal_folha_templates
    (titulo, descricao, tipo, prioridade, regra, dia, mes_offset, mes_especifico, ajuste)
SELECT * FROM (VALUES
    ('Recebimento de variáveis do cliente',
     'Prazo para o cliente enviar ponto, comissões e demais variáveis da folha',
     'envio', 'urgente', 'dia_fixo', 25, 0, NULL::INTEGER, 'antecipa'),

    ('Fechamento da folha',
     'Processamento e conferência interna da folha da competência',
     'fechamento', 'urgente', 'ultimo_dia_util', 1, 0, NULL, 'antecipa'),

    ('Pagamento de salários (5º dia útil)',
     'Prazo legal para pagamento dos salários da competência anterior',
     'pagamento', 'critico', 'dia_util', 5, 1, NULL, 'antecipa'),

    ('eSocial – Fechamento da folha (S-1299)',
     'Envio do fechamento dos eventos periódicos ao eSocial',
     'obrigacao', 'critico', 'dia_fixo', 15, 1, NULL, 'antecipa'),

    ('FGTS Digital',
     'Recolhimento do FGTS da competência anterior',
     'obrigacao', 'critico', 'dia_fixo', 20, 1, NULL, 'antecipa'),

    ('DCTFWeb / DARF (INSS)',
     'Transmissão da DCTFWeb e recolhimento das contribuições previdenciárias',
     'obrigacao', 'critico', 'dia_fixo', 20, 1, NULL, 'antecipa'),

    ('13º salário – 1ª parcela',
     'Prazo legal de pagamento da primeira parcela do 13º',
     'decimo', 'critico', 'dia_fixo', 30, 0, 11, 'antecipa'),

    ('13º salário – 2ª parcela',
     'Prazo legal de pagamento da segunda parcela do 13º',
     'decimo', 'critico', 'dia_fixo', 20, 0, 12, 'antecipa')
) AS v(titulo, descricao, tipo, prioridade, regra, dia, mes_offset, mes_especifico, ajuste)
WHERE NOT EXISTS (
    SELECT 1 FROM public.cal_folha_templates t WHERE t.titulo = v.titulo
);


-- ============================================================
-- 7. REGISTRO NO PORTAL
--    Disponibiliza a ferramenta no catálogo (conceda o acesso
--    aos usuários pela tela de admin, como nas demais)
-- ============================================================
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
SELECT 'Calendário da Folha',
       'Cronograma e controle das atividades da folha de pagamento por empresa',
       '📅', './Projeto Calendario Folha/index.html', TRUE, 25
WHERE NOT EXISTS (
    SELECT 1 FROM public.ferramentas
    WHERE url_base = './Projeto Calendario Folha/index.html'
);
