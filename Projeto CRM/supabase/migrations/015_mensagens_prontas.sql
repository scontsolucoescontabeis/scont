-- ============================================================
-- 015 — Mensagens Prontas (respostas pré-definidas)
-- ============================================================

CREATE TABLE IF NOT EXISTS mensagens_prontas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT        NOT NULL,
  conteudo      TEXT        NOT NULL,
  categoria     TEXT,
  departamento  departamento_enum,
  criado_por    UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  compartilhada BOOLEAN     NOT NULL DEFAULT false,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotente: adiciona coluna caso a tabela já exista sem ela
ALTER TABLE mensagens_prontas ADD COLUMN IF NOT EXISTS departamento departamento_enum;

ALTER TABLE mensagens_prontas ENABLE ROW LEVEL SECURITY;

-- Helper reutilizável: verifica se o usuário logado é ADMIN
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- SELECT: próprias + compartilhadas
DROP POLICY IF EXISTS "mp_select" ON mensagens_prontas;
CREATE POLICY "mp_select" ON mensagens_prontas
  FOR SELECT USING (criado_por = auth.uid() OR compartilhada = true);

-- INSERT: próprias (compartilhadas só por admin)
DROP POLICY IF EXISTS "mp_insert" ON mensagens_prontas;
CREATE POLICY "mp_insert" ON mensagens_prontas
  FOR INSERT WITH CHECK (
    criado_por = auth.uid() AND
    (NOT compartilhada OR auth_is_admin())
  );

-- UPDATE: próprias; compartilhadas só por admin
DROP POLICY IF EXISTS "mp_update" ON mensagens_prontas;
CREATE POLICY "mp_update" ON mensagens_prontas
  FOR UPDATE USING (
    criado_por = auth.uid() OR (compartilhada AND auth_is_admin())
  );

-- DELETE: próprias; compartilhadas só por admin
DROP POLICY IF EXISTS "mp_delete" ON mensagens_prontas;
CREATE POLICY "mp_delete" ON mensagens_prontas
  FOR DELETE USING (
    criado_por = auth.uid() OR (compartilhada AND auth_is_admin())
  );
