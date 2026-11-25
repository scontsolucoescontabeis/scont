-- =====================================================================
-- STUB DO SUPABASE PARA TESTES LOCAIS (NAO e o schema real).
-- Emula apenas o que o teste de isolacao do portal do cliente precisa:
-- roles anon/authenticated, schema auth (users, uid(), jwt()) e copias
-- minimas de usuarios/is_admin/handle_new_user, solicitacoes_acesso e
-- rh_empresas (com cnpj), conforme schema.sql, schema_rh.sql e
-- rh_importacao_campos.sql. Nunca aplicar em producao.
-- =====================================================================
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- Supabase concede privilegios amplos em public; RLS faz o filtro.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, public;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    email_confirmed_at timestamptz,
    last_sign_in_at timestamptz
);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(auth.jwt()->>'sub', '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid() TO anon, authenticated;

CREATE TABLE public.usuarios (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.usuarios (id, nome, email)
    VALUES (NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
            NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE((SELECT is_admin FROM public.usuarios WHERE id = auth.uid()), FALSE);
$$;

CREATE TABLE public.solicitacoes_acesso (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                TEXT NOT NULL,
    email               TEXT NOT NULL,
    empresa             TEXT,
    cargo               TEXT,
    telefone            TEXT,
    status              TEXT NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    motivo_rejeicao     TEXT,
    data_solicitacao    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_avaliacao      TIMESTAMPTZ,
    avaliado_por        TEXT,
    CONSTRAINT solicitacoes_email_unique UNIQUE (email)
);
ALTER TABLE public.solicitacoes_acesso ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rh_empresas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL UNIQUE,
    nome_empresa    TEXT NOT NULL,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cnpj            TEXT
);
ALTER TABLE public.rh_empresas ENABLE ROW LEVEL SECURITY;

-- Schema storage (minimo): storage.objects com RLS, como no Supabase.
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
CREATE TABLE storage.objects (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text,
    name      text
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects TO anon, authenticated;
