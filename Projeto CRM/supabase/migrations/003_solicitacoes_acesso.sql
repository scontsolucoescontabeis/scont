-- ============================================================
-- SCONT Messenger CRM — Migration 003
-- Solicitações de acesso ao CRM (integração com fluxo do portal)
-- ============================================================

DO $$ BEGIN CREATE TYPE status_solicitacao AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS solicitacoes_acesso (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  nome            TEXT NOT NULL,
  departamento    departamento_enum NOT NULL,
  justificativa   TEXT,
  status          status_solicitacao NOT NULL DEFAULT 'PENDENTE',
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondido_em   TIMESTAMPTZ,
  respondido_por  UUID REFERENCES usuarios(id),
  role_aprovada   role_enum,
  motivo_recusa   TEXT,
  UNIQUE (auth_user_id)   -- um pedido por usuário
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes_acesso(status);

ALTER TABLE solicitacoes_acesso ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado vê/cria apenas o próprio pedido
DROP POLICY IF EXISTS "solicitacoes_select_own" ON solicitacoes_acesso;
DROP POLICY IF EXISTS "solicitacoes_insert_own" ON solicitacoes_acesso;
DROP POLICY IF EXISTS "solicitacoes_select_admin" ON solicitacoes_acesso;
DROP POLICY IF EXISTS "solicitacoes_update_admin" ON solicitacoes_acesso;

CREATE POLICY "solicitacoes_select_own" ON solicitacoes_acesso
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "solicitacoes_insert_own" ON solicitacoes_acesso
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());

-- Admin vê e responde todas
CREATE POLICY "solicitacoes_select_admin" ON solicitacoes_acesso
  FOR SELECT TO authenticated USING (get_user_role() = 'ADMIN');

CREATE POLICY "solicitacoes_update_admin" ON solicitacoes_acesso
  FOR UPDATE TO authenticated USING (get_user_role() = 'ADMIN');

-- Realtime para admin receber notificação de novo pedido
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE solicitacoes_acesso;
EXCEPTION WHEN others THEN NULL; END $$;
