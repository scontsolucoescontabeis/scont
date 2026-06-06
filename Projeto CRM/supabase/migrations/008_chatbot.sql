-- =============================================================================
-- Migration 008: Tabelas do Chatbot + Seed
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. chatbot_config — singleton de configuração global
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chatbot_config (
  id               INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bot_ativo        BOOLEAN NOT NULL DEFAULT true,
  horario_inicio   TIME    NOT NULL DEFAULT '08:00',
  horario_fim      TIME    NOT NULL DEFAULT '18:00',
  dias_semana      INT[]   NOT NULL DEFAULT '{1,2,3,4,5}',
  timeout_minutos  INT     NOT NULL DEFAULT 15,
  max_tentativas   INT     NOT NULL DEFAULT 3,
  msg_boas_vindas  TEXT    NOT NULL DEFAULT 'Olá! Bem-vindo à SCONT Soluções Contábeis 👋 Como posso ajudar?',
  msg_fora_horario TEXT    NOT NULL DEFAULT 'Nosso atendimento funciona de seg–sex, 8h–18h. Sua mensagem foi registrada e retornaremos em breve!',
  msg_fila         TEXT    NOT NULL DEFAULT 'Encaminhando para {departamento} — assunto: {assunto}. Protocolo: {protocolo}. Um especialista irá atendê-lo em breve!',
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. chatbot_dept_config — configuração por departamento
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chatbot_dept_config (
  departamento    departamento_enum PRIMARY KEY,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  horario_inicio  TIME,        -- NULL = usa o global
  horario_fim     TIME,        -- NULL = usa o global
  msg_especifica  TEXT         -- NULL = sem mensagem extra
);

-- -----------------------------------------------------------------------------
-- 3. chatbot_menus — árvore de menus configuráveis
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chatbot_menus (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    UUID REFERENCES chatbot_menus(id) ON DELETE CASCADE,  -- NULL = categoria raiz
  departamento departamento_enum NOT NULL,
  titulo       TEXT NOT NULL,
  nivel        INT  NOT NULL CHECK (nivel IN (1, 2)),  -- 1=categoria, 2=sub-categoria
  ordem        INT  NOT NULL DEFAULT 0,
  ativo        BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_chatbot_menus_dept
  ON chatbot_menus(departamento, nivel, ativo, ordem);

-- -----------------------------------------------------------------------------
-- 4. chatbot_sessoes — estado do bot por conversa (1:1 com conversas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chatbot_sessoes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id          UUID NOT NULL UNIQUE REFERENCES conversas(id) ON DELETE CASCADE,
  estado               TEXT NOT NULL DEFAULT 'NOVO'
                       CHECK (estado IN ('NOVO','AGUARD_DEPT','AGUARD_CAT','AGUARD_SUB','AGUARD_CONF','AGUARD_AVAL','CONCLUIDO')),
  dept_selecionado     departamento_enum,
  categoria_id         UUID REFERENCES chatbot_menus(id),
  subcategoria_id      UUID REFERENCES chatbot_menus(id),
  tentativas_invalidas INT NOT NULL DEFAULT 0,
  iniciado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. chatbot_avaliacoes — CSAT
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chatbot_avaliacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  nota        INT  NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. Colunas adicionadas à tabela conversas
-- -----------------------------------------------------------------------------
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_departamento TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_categoria    TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_subcategoria TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_categoria_id UUID REFERENCES chatbot_menus(id);

-- -----------------------------------------------------------------------------
-- 7. Realtime para chatbot_sessoes
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chatbot_sessoes;
EXCEPTION WHEN others THEN NULL; END $$;

-- =============================================================================
-- RLS — Row Level Security
-- =============================================================================

-- chatbot_config
ALTER TABLE chatbot_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_config_select" ON chatbot_config;
DROP POLICY IF EXISTS "chatbot_config_update" ON chatbot_config;
CREATE POLICY "chatbot_config_select" ON chatbot_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chatbot_config_update" ON chatbot_config
  FOR UPDATE TO authenticated USING (get_user_role() = 'ADMIN');

-- chatbot_dept_config
ALTER TABLE chatbot_dept_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_dept_config_select" ON chatbot_dept_config;
DROP POLICY IF EXISTS "chatbot_dept_config_insert" ON chatbot_dept_config;
DROP POLICY IF EXISTS "chatbot_dept_config_update" ON chatbot_dept_config;
DROP POLICY IF EXISTS "chatbot_dept_config_delete" ON chatbot_dept_config;
CREATE POLICY "chatbot_dept_config_select" ON chatbot_dept_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chatbot_dept_config_insert" ON chatbot_dept_config
  FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'ADMIN');
CREATE POLICY "chatbot_dept_config_update" ON chatbot_dept_config
  FOR UPDATE TO authenticated USING (get_user_role() = 'ADMIN');
CREATE POLICY "chatbot_dept_config_delete" ON chatbot_dept_config
  FOR DELETE TO authenticated USING (get_user_role() = 'ADMIN');

-- chatbot_menus
ALTER TABLE chatbot_menus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_menus_select" ON chatbot_menus;
DROP POLICY IF EXISTS "chatbot_menus_insert" ON chatbot_menus;
DROP POLICY IF EXISTS "chatbot_menus_update" ON chatbot_menus;
DROP POLICY IF EXISTS "chatbot_menus_delete" ON chatbot_menus;
CREATE POLICY "chatbot_menus_select" ON chatbot_menus
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chatbot_menus_insert" ON chatbot_menus
  FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'ADMIN');
CREATE POLICY "chatbot_menus_update" ON chatbot_menus
  FOR UPDATE TO authenticated USING (get_user_role() = 'ADMIN');
CREATE POLICY "chatbot_menus_delete" ON chatbot_menus
  FOR DELETE TO authenticated USING (get_user_role() = 'ADMIN');

-- chatbot_sessoes — INSERT/UPDATE via service_role (Edge Functions)
ALTER TABLE chatbot_sessoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_sessoes_select" ON chatbot_sessoes;
CREATE POLICY "chatbot_sessoes_select" ON chatbot_sessoes
  FOR SELECT TO authenticated USING (true);
-- INSERT e UPDATE não têm policy para authenticated: apenas service_role bypassa RLS

-- chatbot_avaliacoes — INSERT via service_role
ALTER TABLE chatbot_avaliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_avaliacoes_select" ON chatbot_avaliacoes;
CREATE POLICY "chatbot_avaliacoes_select" ON chatbot_avaliacoes
  FOR SELECT TO authenticated USING (true);
-- INSERT não tem policy para authenticated: apenas service_role bypassa RLS

-- =============================================================================
-- SEED
-- =============================================================================

-- chatbot_config (singleton)
INSERT INTO chatbot_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- chatbot_dept_config (um por departamento)
INSERT INTO chatbot_dept_config (departamento) VALUES
  ('PESSOAL'),
  ('CONTABIL'),
  ('ADMINISTRATIVO'),
  ('TRIBUTARIO')
ON CONFLICT (departamento) DO NOTHING;

-- chatbot_menus — seed completo (idempotente: pula se já existir algum registro)
DO $$
DECLARE
  cat_id UUID;
BEGIN
  -- Verifica se o seed já foi executado
  IF EXISTS (SELECT 1 FROM chatbot_menus LIMIT 1) THEN
    RETURN;
  END IF;

  -- =========================================================================
  -- PESSOAL
  -- =========================================================================

  -- Admissão
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('PESSOAL', 'Admissão', 1, 1)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('PESSOAL', cat_id, 'Documentação necessária', 2, 1),
    ('PESSOAL', cat_id, 'Prazo de entrega',         2, 2),
    ('PESSOAL', cat_id, 'Outros',                   2, 99);

  -- Rescisão
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('PESSOAL', 'Rescisão', 1, 2)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('PESSOAL', cat_id, 'Cálculo de rescisão', 2, 1),
    ('PESSOAL', cat_id, 'Homologação',          2, 2),
    ('PESSOAL', cat_id, 'Outros',               2, 99);

  -- Folha de Pagamento
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('PESSOAL', 'Folha de Pagamento', 1, 3)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('PESSOAL', cat_id, 'Recálculo de guias',       2, 1),
    ('PESSOAL', cat_id, 'Recálculo da folha',        2, 2),
    ('PESSOAL', cat_id, 'Férias / 13º salário',      2, 3),
    ('PESSOAL', cat_id, 'Outros',                    2, 99);

  -- e-Social / FGTS
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('PESSOAL', 'e-Social / FGTS', 1, 4)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('PESSOAL', cat_id, 'Envio de eventos', 2, 1),
    ('PESSOAL', cat_id, 'Divergências',     2, 2),
    ('PESSOAL', cat_id, 'Outros',           2, 99);

  -- Outros Assuntos (sem sub-itens)
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('PESSOAL', 'Outros Assuntos', 1, 99);

  -- =========================================================================
  -- CONTABIL
  -- =========================================================================

  -- Balanço / DRE
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('CONTABIL', 'Balanço / DRE', 1, 1)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('CONTABIL', cat_id, 'Entrega de demonstrativos', 2, 1),
    ('CONTABIL', cat_id, 'Análise de resultados',     2, 2),
    ('CONTABIL', cat_id, 'Outros',                    2, 99);

  -- Lançamentos Contábeis
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('CONTABIL', 'Lançamentos Contábeis', 1, 2)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('CONTABIL', cat_id, 'Conciliação bancária',    2, 1),
    ('CONTABIL', cat_id, 'Correção de lançamento',  2, 2),
    ('CONTABIL', cat_id, 'Outros',                  2, 99);

  -- Declarações (SPED / ECF)
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('CONTABIL', 'Declarações (SPED / ECF)', 1, 3)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('CONTABIL', cat_id, 'Prazo de entrega', 2, 1),
    ('CONTABIL', cat_id, 'Retificação',      2, 2),
    ('CONTABIL', cat_id, 'Outros',           2, 99);

  -- Certidões / Documentos
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('CONTABIL', 'Certidões / Documentos', 1, 4)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('CONTABIL', cat_id, 'Solicitação de certidão', 2, 1),
    ('CONTABIL', cat_id, 'Autenticação',             2, 2),
    ('CONTABIL', cat_id, 'Outros',                   2, 99);

  -- Outros Assuntos (sem sub-itens)
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('CONTABIL', 'Outros Assuntos', 1, 99);

  -- =========================================================================
  -- TRIBUTARIO
  -- =========================================================================

  -- Imposto de Renda (IRPF)
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('TRIBUTARIO', 'Imposto de Renda (IRPF)', 1, 1)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('TRIBUTARIO', cat_id, 'Entrega da declaração',      2, 1),
    ('TRIBUTARIO', cat_id, 'Malha fina / Pendências',    2, 2),
    ('TRIBUTARIO', cat_id, 'Outros',                     2, 99);

  -- Impostos Empresariais
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('TRIBUTARIO', 'Impostos Empresariais', 1, 2)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('TRIBUTARIO', cat_id, 'Simples Nacional / DAS',  2, 1),
    ('TRIBUTARIO', cat_id, 'IRPJ / CSLL',             2, 2),
    ('TRIBUTARIO', cat_id, 'PIS / COFINS / ISS',      2, 3),
    ('TRIBUTARIO', cat_id, 'Outros',                  2, 99);

  -- Notas Fiscais
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('TRIBUTARIO', 'Notas Fiscais', 1, 3)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('TRIBUTARIO', cat_id, 'Emissão / Cancelamento', 2, 1),
    ('TRIBUTARIO', cat_id, 'Escrituração',            2, 2),
    ('TRIBUTARIO', cat_id, 'Outros',                  2, 99);

  -- Planejamento Tributário
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('TRIBUTARIO', 'Planejamento Tributário', 1, 4)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('TRIBUTARIO', cat_id, 'Enquadramento societário',  2, 1),
    ('TRIBUTARIO', cat_id, 'Redução de carga fiscal',   2, 2),
    ('TRIBUTARIO', cat_id, 'Outros',                    2, 99);

  -- Outros Assuntos (sem sub-itens)
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('TRIBUTARIO', 'Outros Assuntos', 1, 99);

  -- =========================================================================
  -- ADMINISTRATIVO
  -- =========================================================================

  -- Abertura / Alteração de Empresa
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('ADMINISTRATIVO', 'Abertura / Alteração de Empresa', 1, 1)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('ADMINISTRATIVO', cat_id, 'Abertura de empresa',    2, 1),
    ('ADMINISTRATIVO', cat_id, 'Alteração contratual',   2, 2),
    ('ADMINISTRATIVO', cat_id, 'Encerramento',           2, 3),
    ('ADMINISTRATIVO', cat_id, 'Outros',                 2, 99);

  -- Alvarás e Licenças
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('ADMINISTRATIVO', 'Alvarás e Licenças', 1, 2)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('ADMINISTRATIVO', cat_id, 'Renovação de alvará', 2, 1),
    ('ADMINISTRATIVO', cat_id, 'Nova licença',         2, 2),
    ('ADMINISTRATIVO', cat_id, 'Outros',               2, 99);

  -- Financeiro / Honorários
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('ADMINISTRATIVO', 'Financeiro / Honorários', 1, 3)
    RETURNING id INTO cat_id;
  INSERT INTO chatbot_menus (departamento, parent_id, titulo, nivel, ordem) VALUES
    ('ADMINISTRATIVO', cat_id, 'Boleto / Fatura em aberto',  2, 1),
    ('ADMINISTRATIVO', cat_id, 'Negociação de valores',       2, 2),
    ('ADMINISTRATIVO', cat_id, 'Outros',                      2, 99);

  -- Outros Assuntos (sem sub-itens)
  INSERT INTO chatbot_menus (departamento, titulo, nivel, ordem)
    VALUES ('ADMINISTRATIVO', 'Outros Assuntos', 1, 99);

END $$;
