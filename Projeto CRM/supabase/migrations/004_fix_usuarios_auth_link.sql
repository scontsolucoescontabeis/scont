-- ============================================================
-- SCONT Messenger CRM — Migration 004
-- Corrige vinculo entre usuarios e auth.users.
-- usuarios.id = auth.users.id (FK direta — confirmado pelo admin-dashboard)
-- REGRA: usuarios.is_admin = true  →  CRM admin
--        usuarios.departamento != null  →  tem acesso ao CRM
-- ============================================================

-- Garante colunas necessárias (idempotente)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email        TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS departamento departamento_enum;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role         role_enum;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo        BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- Corrige get_user_role: usa id = auth.uid() (não email)
-- Portal admin (is_admin=true) → CRM admin automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS role_enum AS $$
  SELECT
    CASE WHEN COALESCE(is_admin, false) THEN 'ADMIN'::role_enum
         ELSE COALESCE(role, 'AGENTE'::role_enum)
    END
  FROM usuarios
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_departamento()
RETURNS departamento_enum AS $$
  SELECT departamento
  FROM usuarios
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RPC: retorna perfil CRM completo do usuário autenticado
-- Retorna vazio se não tem departamento configurado (sem acesso)
-- ============================================================
CREATE OR REPLACE FUNCTION get_meu_perfil_crm()
RETURNS TABLE (
  id           UUID,
  nome         TEXT,
  email        TEXT,
  departamento departamento_enum,
  role         role_enum,
  is_admin     BOOLEAN,
  ativo        BOOLEAN
) AS $$
  SELECT
    u.id,
    u.nome,
    u.email,
    u.departamento,
    CASE WHEN COALESCE(u.is_admin, false) THEN 'ADMIN'::role_enum
         ELSE COALESCE(u.role, 'AGENTE'::role_enum)
    END AS role,
    COALESCE(u.is_admin, false),
    COALESCE(u.ativo, true)
  FROM usuarios u
  WHERE u.id = auth.uid()
    AND u.departamento IS NOT NULL
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS: admin pode ver e editar todos os usuarios
-- ============================================================
DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "usuarios_update_admin" ON usuarios;
CREATE POLICY "usuarios_update_admin" ON usuarios
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'ADMIN');

-- ============================================================
-- Atualizar email nos registros existentes usando auth.users
-- Execute após a migration:
--
-- UPDATE usuarios u
-- SET email = au.email
-- FROM auth.users au
-- WHERE u.id = au.id AND u.email IS NULL;
-- ============================================================
