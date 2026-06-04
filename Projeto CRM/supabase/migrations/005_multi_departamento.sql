-- ============================================================
-- SCONT Messenger CRM — Migration 005
-- Multi-departamento: usuarios.departamentos departamento_enum[]
-- ADMIN vê tudo via role; AGENTE vê qualquer depto do seu array.
-- ============================================================

-- 1. Adiciona coluna array (idempotente)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS departamentos departamento_enum[];

-- 2. Migra dados existentes (departamento singular → array)
UPDATE usuarios
SET departamentos = ARRAY[departamento]
WHERE departamento IS NOT NULL
  AND (departamentos IS NULL OR cardinality(departamentos) = 0);

-- 3. Função: retorna array de departamentos do usuário autenticado
CREATE OR REPLACE FUNCTION get_user_departamentos()
RETURNS departamento_enum[] AS $$
  SELECT COALESCE(departamentos, ARRAY[]::departamento_enum[])
  FROM usuarios
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Mantém get_user_departamento (singular) para compatibilidade — retorna o 1º
CREATE OR REPLACE FUNCTION get_user_departamento()
RETURNS departamento_enum AS $$
  SELECT departamentos[1]
  FROM usuarios
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Recria políticas RLS usando = ANY(array)

-- conversas
DROP POLICY IF EXISTS "conversas_select_admin"  ON conversas;
DROP POLICY IF EXISTS "conversas_select_agente" ON conversas;
DROP POLICY IF EXISTS "conversas_update_admin"  ON conversas;
DROP POLICY IF EXISTS "conversas_update_agente" ON conversas;

CREATE POLICY "conversas_select_admin"  ON conversas FOR SELECT TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "conversas_select_agente" ON conversas FOR SELECT TO authenticated
  USING (get_user_role() = 'AGENTE'
         AND departamento = ANY(get_user_departamentos()));

CREATE POLICY "conversas_update_admin"  ON conversas FOR UPDATE TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "conversas_update_agente" ON conversas FOR UPDATE TO authenticated
  USING (get_user_role() = 'AGENTE'
         AND departamento = ANY(get_user_departamentos()));

-- mensagens
DROP POLICY IF EXISTS "mensagens_select" ON mensagens;
CREATE POLICY "mensagens_select" ON mensagens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversas c WHERE c.id = conversa_id
    AND (get_user_role() = 'ADMIN'
         OR c.departamento = ANY(get_user_departamentos()))
  ));

-- transferencias
DROP POLICY IF EXISTS "transferencias_select" ON transferencias;
CREATE POLICY "transferencias_select" ON transferencias FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversas c WHERE c.id = conversa_id
    AND (get_user_role() = 'ADMIN'
         OR c.departamento = ANY(get_user_departamentos()))
  ));

-- anotacoes_internas
DROP POLICY IF EXISTS "anotacoes_select" ON anotacoes_internas;
CREATE POLICY "anotacoes_select" ON anotacoes_internas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversas c WHERE c.id = conversa_id
    AND (get_user_role() = 'ADMIN'
         OR c.departamento = ANY(get_user_departamentos()))
  ));

-- 5. Atualiza RPC get_meu_perfil_crm para retornar array
-- DROP obrigatório: mudança no tipo de retorno (departamento → departamentos[])
DROP FUNCTION IF EXISTS get_meu_perfil_crm();
CREATE OR REPLACE FUNCTION get_meu_perfil_crm()
RETURNS TABLE (
  id            UUID,
  nome          TEXT,
  email         TEXT,
  departamentos departamento_enum[],
  role          role_enum,
  is_admin      BOOLEAN,
  ativo         BOOLEAN
) AS $$
  SELECT
    u.id,
    u.nome,
    u.email,
    COALESCE(u.departamentos, ARRAY[]::departamento_enum[]),
    CASE WHEN COALESCE(u.is_admin, false) THEN 'ADMIN'::role_enum
         ELSE COALESCE(u.role, 'AGENTE'::role_enum)
    END AS role,
    COALESCE(u.is_admin, false),
    COALESCE(u.ativo, true)
  FROM usuarios u
  WHERE u.id = auth.uid()
    AND (
      COALESCE(u.is_admin, false) = true           -- admin sempre tem acesso
      OR (u.departamentos IS NOT NULL
          AND cardinality(u.departamentos) > 0)     -- agente com ao menos 1 depto
    )
$$ LANGUAGE sql SECURITY DEFINER STABLE;
