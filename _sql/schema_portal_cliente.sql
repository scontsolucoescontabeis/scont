-- ============================================================
-- Portal do Cliente - Parte 1: tabelas, funcoes e cadastro por trigger
-- Idempotente. Depende de: public.usuarios, public.is_admin(),
-- public.solicitacoes_acesso, public.rh_empresas (com coluna cnpj).
-- ============================================================

-- 1. Tabelas ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cliente_usuarios (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome        TEXT,
    email       TEXT,
    cargo       TEXT,
    telefone    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cliente_acessos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES public.cliente_usuarios(id) ON DELETE CASCADE,
    codigo_empresa  TEXT NOT NULL REFERENCES public.rh_empresas(codigo_empresa) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'aprovado', 'recusado', 'revogado')),
    motivo          TEXT,
    decidido_por    TEXT,
    decidido_em     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cliente_acessos_usuario_empresa_unique UNIQUE (usuario_id, codigo_empresa)
);

CREATE INDEX IF NOT EXISTS idx_cliente_acessos_usuario ON public.cliente_acessos (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_cliente_acessos_empresa ON public.cliente_acessos (codigo_empresa);

-- 2. Funcoes ---------------------------------------------------
-- Equipe = admin OU solicitacao de acesso aprovada com o mesmo e-mail.
CREATE OR REPLACE FUNCTION public.eh_equipe()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.solicitacoes_acesso s
            WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
              AND s.status = 'aprovado'
        );
$$;

CREATE OR REPLACE FUNCTION public.empresas_do_cliente()
RETURNS SETOF TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT a.codigo_empresa
    FROM public.cliente_acessos a
    WHERE a.usuario_id = auth.uid()
      AND a.status = 'aprovado';
$$;

-- Busca publica (tela de cadastro, antes do login). Limitada para
-- dificultar enumeracao: 4+ caracteres ou CNPJ completo; max. 8 linhas.
CREATE OR REPLACE FUNCTION public.buscar_empresas_publico(p_texto TEXT)
RETURNS TABLE (codigo_empresa TEXT, nome_empresa TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_texto  TEXT := trim(COALESCE(p_texto, ''));
    v_digits TEXT := regexp_replace(trim(COALESCE(p_texto, '')), '\D', '', 'g');
    v_like   TEXT;
BEGIN
    IF length(v_texto) < 4 AND v_digits = '' THEN
        RETURN;
    END IF;
    v_like := '%' || replace(replace(replace(v_texto, '\', '\\'), '%', '\%'), '_', '\_') || '%';

    RETURN QUERY
    SELECT e.codigo_empresa, e.nome_empresa
    FROM public.rh_empresas e
    WHERE (length(v_texto) >= 4
           AND (e.nome_empresa ILIKE v_like OR e.codigo_empresa ILIKE v_like))
       OR (v_digits <> ''
           AND regexp_replace(COALESCE(e.cnpj, ''), '\D', '', 'g') = v_digits)
    ORDER BY e.nome_empresa
    LIMIT 8;
END;
$$;

-- 3. Trigger de cadastro ---------------------------------------
-- Nunca pode lancar erro: nao deve bloquear o signup.
CREATE OR REPLACE FUNCTION public.handle_novo_cliente()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_codigo TEXT;
BEGIN
    BEGIN
        IF COALESCE(NEW.raw_user_meta_data ->> 'portal', '') = 'cliente' THEN
            INSERT INTO public.cliente_usuarios (id, nome, email, cargo, telefone)
            VALUES (
                NEW.id,
                COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
                NEW.email,
                NEW.raw_user_meta_data ->> 'cargo',
                NEW.raw_user_meta_data ->> 'telefone'
            )
            ON CONFLICT (id) DO NOTHING;

            v_codigo := NEW.raw_user_meta_data ->> 'codigo_empresa';
            IF v_codigo IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.rh_empresas WHERE codigo_empresa = v_codigo
            ) THEN
                INSERT INTO public.cliente_acessos (usuario_id, codigo_empresa, status)
                VALUES (NEW.id, v_codigo, 'pendente')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_novo_cliente: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_cliente ON auth.users;
CREATE TRIGGER on_auth_user_created_cliente
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_novo_cliente();

-- 4. RLS -------------------------------------------------------
ALTER TABLE public.cliente_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_acessos  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cliente_usuarios_select ON public.cliente_usuarios;
CREATE POLICY cliente_usuarios_select ON public.cliente_usuarios
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS cliente_usuarios_admin_all ON public.cliente_usuarios;
CREATE POLICY cliente_usuarios_admin_all ON public.cliente_usuarios
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS cliente_acessos_select ON public.cliente_acessos;
CREATE POLICY cliente_acessos_select ON public.cliente_acessos
    FOR SELECT TO authenticated
    USING (usuario_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS cliente_acessos_admin_all ON public.cliente_acessos;
CREATE POLICY cliente_acessos_admin_all ON public.cliente_acessos
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Grants ----------------------------------------------------
REVOKE ALL ON public.cliente_usuarios FROM anon;
REVOKE ALL ON public.cliente_acessos  FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_usuarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_acessos  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.eh_equipe()            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.empresas_do_cliente()  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_novo_cliente()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buscar_empresas_publico(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.eh_equipe()            TO authenticated;
GRANT  EXECUTE ON FUNCTION public.empresas_do_cliente()  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.buscar_empresas_publico(TEXT) TO anon, authenticated;
