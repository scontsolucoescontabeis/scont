-- ============================================================
-- SCONT Messenger CRM — Migration 001 (idempotente)
-- ============================================================

-- ENUMs (ignorados se já existirem)
DO $$ BEGIN CREATE TYPE departamento_enum AS ENUM ('PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE role_enum AS ENUM ('ADMIN', 'AGENTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE status_conversa AS ENUM ('ABERTA', 'EM_ATENDIMENTO', 'ENCERRADA', 'AGUARDANDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE origem_mensagem AS ENUM ('CLIENTE', 'AGENTE', 'SISTEMA', 'BOT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Tabelas
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  departamento departamento_enum NOT NULL,
  role         role_enum NOT NULL DEFAULT 'AGENTE',
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Garante colunas mesmo quando a tabela já existia com esquema anterior
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS departamento departamento_enum;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role         role_enum NOT NULL DEFAULT 'AGENTE';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS contatos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone      TEXT NOT NULL UNIQUE,
  nome          TEXT,
  empresa       TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id    UUID NOT NULL REFERENCES contatos(id),
  departamento  departamento_enum NOT NULL DEFAULT 'ADMINISTRATIVO',
  status        status_conversa NOT NULL DEFAULT 'ABERTA',
  agente_id     UUID REFERENCES usuarios(id),
  protocolo     TEXT NOT NULL UNIQUE DEFAULT '',
  aberto_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrado_em  TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS departamento  departamento_enum NOT NULL DEFAULT 'ADMINISTRATIVO';
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS status        status_conversa NOT NULL DEFAULT 'ABERTA';
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS agente_id     UUID REFERENCES usuarios(id);
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS protocolo     TEXT NOT NULL DEFAULT '';
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS encerrado_em  TIMESTAMPTZ;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS mensagens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id     UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  origem          origem_mensagem NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'text',
  conteudo        TEXT NOT NULL,
  media_url       TEXT,
  whatsapp_msg_id TEXT UNIQUE,
  agente_id       UUID REFERENCES usuarios(id),
  lida            BOOLEAN NOT NULL DEFAULT false,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS tipo            TEXT NOT NULL DEFAULT 'text';
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS media_url       TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS whatsapp_msg_id TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS agente_id       UUID REFERENCES usuarios(id);
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS lida            BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS transferencias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id       UUID NOT NULL REFERENCES conversas(id),
  de_departamento   departamento_enum,
  para_departamento departamento_enum NOT NULL,
  de_agente_id      UUID REFERENCES usuarios(id),
  para_agente_id    UUID REFERENCES usuarios(id),
  motivo            TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anotacoes_internas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  agente_id   UUID NOT NULL REFERENCES usuarios(id),
  conteudo    TEXT NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor  TEXT NOT NULL DEFAULT '#888480'
);

CREATE TABLE IF NOT EXISTS conversa_tags (
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (conversa_id, tag_id)
);

-- ============================================================
-- Triggers
-- ============================================================

CREATE OR REPLACE FUNCTION gerar_protocolo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.protocolo IS NULL OR NEW.protocolo = '' THEN
    NEW.protocolo := 'SCT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                     LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protocolo ON conversas;
CREATE TRIGGER trigger_protocolo
  BEFORE INSERT ON conversas
  FOR EACH ROW
  EXECUTE FUNCTION gerar_protocolo();

CREATE OR REPLACE FUNCTION atualizar_conversa_em_mensagem()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversas SET atualizado_em = NOW() WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualiza_conversa ON mensagens;
CREATE TRIGGER trigger_atualiza_conversa
  AFTER INSERT ON mensagens
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_conversa_em_mensagem();

-- ============================================================
-- Indices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa     ON mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_conversas_departamento ON conversas(departamento);
CREATE INDEX IF NOT EXISTS idx_conversas_status       ON conversas(status);
CREATE INDEX IF NOT EXISTS idx_conversas_agente       ON conversas(agente_id);
CREATE INDEX IF NOT EXISTS idx_conversas_atualizado   ON conversas(atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_contatos_telefone      ON contatos(telefone);

-- ============================================================
-- Supabase Realtime
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversas;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE anotacoes_internas;
EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE anotacoes_internas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversa_tags      ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS role_enum AS $$
  SELECT role FROM usuarios WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_departamento()
RETURNS departamento_enum AS $$
  SELECT departamento FROM usuarios WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Policies (drop + recreate para ser idempotente)
-- ============================================================

-- usuarios
DROP POLICY IF EXISTS "usuarios_select"     ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON usuarios;
CREATE POLICY "usuarios_select"     ON usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios_update_own" ON usuarios FOR UPDATE TO authenticated USING (id = auth.uid());

-- contatos
DROP POLICY IF EXISTS "contatos_select" ON contatos;
DROP POLICY IF EXISTS "contatos_insert" ON contatos;
DROP POLICY IF EXISTS "contatos_update" ON contatos;
CREATE POLICY "contatos_select" ON contatos FOR SELECT TO authenticated USING (true);
CREATE POLICY "contatos_insert" ON contatos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contatos_update" ON contatos FOR UPDATE TO authenticated USING (true);

-- conversas
DROP POLICY IF EXISTS "conversas_select_admin"  ON conversas;
DROP POLICY IF EXISTS "conversas_select_agente" ON conversas;
DROP POLICY IF EXISTS "conversas_insert"        ON conversas;
DROP POLICY IF EXISTS "conversas_update_admin"  ON conversas;
DROP POLICY IF EXISTS "conversas_update_agente" ON conversas;
CREATE POLICY "conversas_select_admin"  ON conversas FOR SELECT TO authenticated
  USING (get_user_role() = 'ADMIN');
CREATE POLICY "conversas_select_agente" ON conversas FOR SELECT TO authenticated
  USING (get_user_role() = 'AGENTE' AND departamento = get_user_departamento());
CREATE POLICY "conversas_insert"        ON conversas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "conversas_update_admin"  ON conversas FOR UPDATE TO authenticated
  USING (get_user_role() = 'ADMIN');
CREATE POLICY "conversas_update_agente" ON conversas FOR UPDATE TO authenticated
  USING (get_user_role() = 'AGENTE' AND departamento = get_user_departamento());

-- mensagens
DROP POLICY IF EXISTS "mensagens_select" ON mensagens;
DROP POLICY IF EXISTS "mensagens_insert" ON mensagens;
CREATE POLICY "mensagens_select" ON mensagens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversas c WHERE c.id = conversa_id
    AND (get_user_role() = 'ADMIN' OR c.departamento = get_user_departamento())
  ));
CREATE POLICY "mensagens_insert" ON mensagens FOR INSERT TO authenticated WITH CHECK (true);

-- transferencias
DROP POLICY IF EXISTS "transferencias_select" ON transferencias;
DROP POLICY IF EXISTS "transferencias_insert" ON transferencias;
CREATE POLICY "transferencias_select" ON transferencias FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversas c WHERE c.id = conversa_id
    AND (get_user_role() = 'ADMIN' OR c.departamento = get_user_departamento())
  ));
CREATE POLICY "transferencias_insert" ON transferencias FOR INSERT TO authenticated WITH CHECK (true);

-- anotacoes_internas
DROP POLICY IF EXISTS "anotacoes_select" ON anotacoes_internas;
DROP POLICY IF EXISTS "anotacoes_insert" ON anotacoes_internas;
CREATE POLICY "anotacoes_select" ON anotacoes_internas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversas c WHERE c.id = conversa_id
    AND (get_user_role() = 'ADMIN' OR c.departamento = get_user_departamento())
  ));
CREATE POLICY "anotacoes_insert" ON anotacoes_internas FOR INSERT TO authenticated WITH CHECK (true);

-- tags
DROP POLICY IF EXISTS "tags_select" ON tags;
DROP POLICY IF EXISTS "tags_insert" ON tags;
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'ADMIN');

-- conversa_tags
DROP POLICY IF EXISTS "conversa_tags_select" ON conversa_tags;
DROP POLICY IF EXISTS "conversa_tags_insert" ON conversa_tags;
DROP POLICY IF EXISTS "conversa_tags_delete" ON conversa_tags;
CREATE POLICY "conversa_tags_select" ON conversa_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "conversa_tags_insert" ON conversa_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "conversa_tags_delete" ON conversa_tags FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Storage bucket para midias
-- Executar separadamente no SQL Editor se ainda nao existir:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('crm-midia', 'crm-midia', true)
-- ON CONFLICT (id) DO NOTHING;
-- ============================================================
