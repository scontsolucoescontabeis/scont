-- ============================================================
-- SCONT Messenger CRM — Migration 006
-- Tarefas: registro e acompanhamento de atividades abertas
-- a partir de conversas ou manualmente.
-- ============================================================

DO $$ BEGIN CREATE TYPE status_tarefa AS ENUM ('ABERTA','EM_EXECUCAO','CONCLUIDA','CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE prioridade_tarefa AS ENUM ('BAIXA','NORMAL','ALTA','URGENTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tarefas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id   UUID REFERENCES conversas(id) ON DELETE SET NULL,
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  demandante    TEXT,
  departamento  departamento_enum NOT NULL,
  status        status_tarefa NOT NULL DEFAULT 'ABERTA',
  prioridade    prioridade_tarefa NOT NULL DEFAULT 'NORMAL',
  criado_por    UUID NOT NULL REFERENCES usuarios(id),
  atribuido_a   UUID REFERENCES usuarios(id),
  prazo         TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluido_em  TIMESTAMPTZ,
  concluido_por UUID REFERENCES usuarios(id)
);
-- Garante coluna demandante em instalações anteriores
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS demandante TEXT;

CREATE INDEX IF NOT EXISTS idx_tarefas_status       ON tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_departamento ON tarefas(departamento);
CREATE INDEX IF NOT EXISTS idx_tarefas_atribuido    ON tarefas(atribuido_a);
CREATE INDEX IF NOT EXISTS idx_tarefas_conversa     ON tarefas(conversa_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_criado_em    ON tarefas(criado_em DESC);

-- Trigger: atualiza atualizado_em automaticamente
CREATE OR REPLACE FUNCTION atualizar_tarefa_em()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tarefa_atualizada ON tarefas;
CREATE TRIGGER trigger_tarefa_atualizada
  BEFORE UPDATE ON tarefas
  FOR EACH ROW EXECUTE FUNCTION atualizar_tarefa_em();

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE tarefas;
EXCEPTION WHEN others THEN NULL; END $$;

-- RLS
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarefas_select_admin"  ON tarefas;
DROP POLICY IF EXISTS "tarefas_select_agente" ON tarefas;
DROP POLICY IF EXISTS "tarefas_insert"        ON tarefas;
DROP POLICY IF EXISTS "tarefas_update_admin"  ON tarefas;
DROP POLICY IF EXISTS "tarefas_update_agente" ON tarefas;

-- ADMIN vê tudo; AGENTE vê tarefas do seu departamento ou atribuídas a si
CREATE POLICY "tarefas_select_admin" ON tarefas FOR SELECT TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "tarefas_select_agente" ON tarefas FOR SELECT TO authenticated
  USING (
    get_user_role() = 'AGENTE'
    AND (
      departamento = ANY(get_user_departamentos())
      OR atribuido_a = auth.uid()
      OR criado_por  = auth.uid()
    )
  );

CREATE POLICY "tarefas_insert" ON tarefas FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "tarefas_update_admin" ON tarefas FOR UPDATE TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "tarefas_update_agente" ON tarefas FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'AGENTE'
    AND (
      departamento = ANY(get_user_departamentos())
      OR atribuido_a = auth.uid()
      OR criado_por  = auth.uid()
    )
  );
