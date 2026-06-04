-- ============================================================
-- SCONT Messenger CRM — Storage Policies
-- Executar no SQL Editor do Supabase (mesmo banco do portal)
--
-- REGRAS:
--   Upload  → Edge Function usa service_role (bypassa RLS) — sem restrição
--   Download/View → autenticado + tem acesso ao CRM
--   Update/Delete → CRM admin apenas
-- ============================================================

-- 1. Cria ou reconfigura o bucket como PRIVADO
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'crm-midia',
  'crm-midia',
  false,                  -- PRIVADO: URLs públicas não funcionam
  52428800,               -- limite 50 MB por arquivo
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/webm',
    'video/mp4', 'video/webm',
    'application/pdf',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public           = false,
      file_size_limit  = 52428800,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Função auxiliar: verifica se o usuário autenticado tem acesso ao CRM
CREATE OR REPLACE FUNCTION tem_acesso_crm()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
      AND (
        COALESCE(is_admin, false) = true
        OR departamento IS NOT NULL                                  -- coluna singular (pre-migration 005)
        OR (departamentos IS NOT NULL AND cardinality(departamentos) > 0) -- array (pos-migration 005)
      )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Remove policies antigas (idempotente)
DROP POLICY IF EXISTS "crm_midia_select" ON storage.objects;
DROP POLICY IF EXISTS "crm_midia_insert" ON storage.objects;
DROP POLICY IF EXISTS "crm_midia_update" ON storage.objects;
DROP POLICY IF EXISTS "crm_midia_delete" ON storage.objects;

-- 4. SELECT: download de mídia — autenticado com acesso ao CRM
CREATE POLICY "crm_midia_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'crm-midia'
    AND tem_acesso_crm()
  );

-- 5. INSERT: upload de mídia — autenticado com acesso ao CRM
--    (Edge Function usa service_role e bypassa esta policy automaticamente)
CREATE POLICY "crm_midia_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-midia'
    AND tem_acesso_crm()
  );

-- 6. UPDATE: somente admins CRM
CREATE POLICY "crm_midia_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'crm-midia'
    AND get_user_role() = 'ADMIN'
  );

-- 7. DELETE: somente admins CRM
CREATE POLICY "crm_midia_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'crm-midia'
    AND get_user_role() = 'ADMIN'
  );
