-- ================================================================
-- PERMISSÃO: ver_senhas — Projeto Certificado Digital
-- Permite que usuários autorizados decifrem senhas de certificados.
-- Execute no SQL Editor do Supabase (projeto principal)
-- ================================================================

-- 1. Ativar pgcrypto (necessário para pgp_sym_decrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- 2. Registrar a sub-permissão "ver_senhas" na ferramenta Certificado Digital
--    A função buildFerCheckboxes do admin-dashboard lê sub_permissoes
--    automaticamente e renderiza o checkbox na tela de aprovação/edição.
UPDATE public.ferramentas
SET sub_permissoes =
    COALESCE(sub_permissoes, '[]'::jsonb)
    || '[{"key":"ver_senhas","label":"Ver Senhas dos Certificados"}]'::jsonb
WHERE lower(url_base) LIKE '%certificado%'
  AND (
      sub_permissoes IS NULL
      OR NOT (sub_permissoes @> '[{"key":"ver_senhas"}]'::jsonb)
  );


-- 3. Chave de criptografia — preencha o campo "valor" com a mesma
--    chave usada na migração pgp_sym_encrypt (ponto 2 da LGPD).
--    Se as senhas ainda estão em base64 (não migradas), deixe vazio:
--    o fallback trata os dois formatos automaticamente.
INSERT INTO public.configuracoes_scont (chave, valor, descricao)
VALUES (
    'cert_encryption_key',
    '',
    'Chave pgp_sym_encrypt das senhas de certificados. '
    'Deve ser idêntica à usada na migração LGPD. '
    'Vazio = senhas ainda no formato base64 legado.'
)
ON CONFLICT (chave) DO NOTHING;


-- 4. Função RPC — decifra a senha de um certificado específico
--    SECURITY DEFINER: executa como dono da função, lê
--    configuracoes_scont (admin-only) sem expor a chave ao caller.
--    Verificações internas:
--      • usuário autenticado
--      • is_admin()  OU  sub-permissão ver_senhas no certificados
--    Suporte a ambos os formatos:
--      • pgp_sym_encrypt  (formato seguro, pós-migração LGPD)
--      • base64           (formato legado, pré-migração)
DROP FUNCTION IF EXISTS public.fn_decifrar_senha_certificado(UUID);

CREATE FUNCTION public.fn_decifrar_senha_certificado(p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pgsodium AS $$
DECLARE
    v_senha_hash TEXT;
    v_chave      TEXT;
    v_decrypted  TEXT;
BEGIN
    -- Autenticação obrigatória
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: autenticação necessária';
    END IF;

    -- Verificar permissão
    IF NOT public.is_admin() THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.usuario_ferramentas uf
            JOIN public.ferramentas f ON f.id = uf.ferramenta_id
            WHERE uf.usuario_id IN (
                SELECT id FROM public.solicitacoes_acesso
                WHERE email = auth.email()
            )
            AND lower(f.url_base) LIKE '%certificado%'
            AND (
                uf.permissoes = '{}'::text[]        -- acesso total = sem restrição
                OR 'ver_senhas' = ANY(uf.permissoes)
            )
        ) THEN
            RAISE EXCEPTION 'Acesso negado: permissão ver_senhas não concedida';
        END IF;
    END IF;

    -- Buscar senha do certificado
    SELECT senha_hash INTO v_senha_hash
    FROM public.certificados
    WHERE id = p_id
      AND deleted_at IS NULL;

    IF v_senha_hash IS NULL OR v_senha_hash = '' THEN
        RETURN '';
    END IF;

    -- Ler chave do Supabase Vault
    SELECT decrypted_secret INTO v_chave
    FROM vault.decrypted_secrets
    WHERE name = 'cert_encryption_key'
    LIMIT 1;

    -- Tentar pgp_sym_decrypt (formato pós-migração)
    IF v_chave IS NOT NULL AND v_chave <> '' THEN
        BEGIN
            v_decrypted := pgp_sym_decrypt(
                decode(v_senha_hash, 'base64'),
                v_chave
            );
            RETURN v_decrypted;
        EXCEPTION WHEN OTHERS THEN
            NULL;  -- cai no fallback base64
        END;
    END IF;

    -- Fallback base64 (formato legado pré-migração)
    BEGIN
        RETURN convert_from(decode(v_senha_hash, 'base64'), 'UTF8');
    EXCEPTION WHEN OTHERS THEN
        RETURN v_senha_hash;  -- texto simples
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_decifrar_senha_certificado(UUID) TO authenticated;
