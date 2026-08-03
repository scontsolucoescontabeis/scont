-- ================================================================
-- SCHEMA: Projeto Licenças — v4
-- Empresas passam a vir de public.rh_empresas (RH), não mais de
-- public.empresas (tela "Clientes", removida da ferramenta).
-- Tipos de Licença passam a ser um catálogo configurável.
-- ================================================================
-- IMPORTANTE: Execute no mesmo projeto Supabase do portal (contém
-- rh_empresas, licencas, alvaras, processos).
-- Confirmado antes de rodar: não há registro real em produção
-- vinculado à antiga public.empresas — nenhuma migração de dado
-- é necessária, só repontar a FK.
-- ================================================================


-- ================================================================
-- 1) Repontar empresa_id: public.empresas(id) → public.rh_empresas(id)
--    ON DELETE SET NULL: excluir uma empresa em rh_empresas não deve
--    ser bloqueado por licenças/alvarás/processos vinculados a ela.
-- ================================================================

ALTER TABLE public.licencas  DROP CONSTRAINT IF EXISTS licencas_empresa_id_fkey;
ALTER TABLE public.alvaras   DROP CONSTRAINT IF EXISTS alvaras_empresa_id_fkey;
ALTER TABLE public.processos DROP CONSTRAINT IF EXISTS processos_empresa_id_fkey;

ALTER TABLE public.licencas
    ADD CONSTRAINT licencas_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.rh_empresas(id) ON DELETE SET NULL;

ALTER TABLE public.alvaras
    ADD CONSTRAINT alvaras_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.rh_empresas(id) ON DELETE SET NULL;

ALTER TABLE public.processos
    ADD CONSTRAINT processos_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES public.rh_empresas(id) ON DELETE SET NULL;

-- Nota: public.empresas NÃO é apagada por este script — fica órfã no
-- banco (sem dado real e sem tela para acessá-la), removível depois
-- se o usuário confirmar que não há mais uso nenhum.


-- ================================================================
-- 2) TABELA: tipos_licenca
--    Catálogo configurável dos tipos de licença (Bombeiros,
--    Vigilância Sanitária, etc.), gerenciável em Configurações.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.tipos_licenca (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            TEXT        NOT NULL UNIQUE,

    ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    criado_por      TEXT
);

COMMENT ON TABLE public.tipos_licenca IS
    'Catálogo configurável de tipos de licença, usado no dropdown "Tipo de Licença"';

CREATE INDEX IF NOT EXISTS idx_tipos_licenca_ativo ON public.tipos_licenca (ativo);

-- Reaproveita fn_audit_insert() já criada em schema_licencas.sql
DROP TRIGGER IF EXISTS trg_audit_insert_tipos_licenca ON public.tipos_licenca;
CREATE TRIGGER trg_audit_insert_tipos_licenca
    BEFORE INSERT ON public.tipos_licenca
    FOR EACH ROW EXECUTE FUNCTION fn_audit_insert();

ALTER TABLE public.tipos_licenca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tipos_licenca_select" ON public.tipos_licenca;
CREATE POLICY "tipos_licenca_select" ON public.tipos_licenca
    FOR SELECT TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "tipos_licenca_insert" ON public.tipos_licenca;
CREATE POLICY "tipos_licenca_insert" ON public.tipos_licenca
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);

-- UPDATE cobre o "excluir" tipo, que é soft delete (ativo = FALSE)
DROP POLICY IF EXISTS "tipos_licenca_update" ON public.tipos_licenca;
CREATE POLICY "tipos_licenca_update" ON public.tipos_licenca
    FOR UPDATE TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- Seed inicial — usuário pode adicionar/remover à vontade em Configurações
INSERT INTO public.tipos_licenca (nome) VALUES
    ('Bombeiros'),
    ('Vigilância Sanitária'),
    ('Meio Ambiente'),
    ('Alvará de Funcionamento'),
    ('ANVISA')
ON CONFLICT (nome) DO NOTHING;


-- ================================================================
-- VERIFICAÇÃO
-- SELECT conname, conrelid::regclass, confrelid::regclass
--   FROM pg_constraint WHERE conname LIKE '%empresa_id_fkey';
-- SELECT * FROM public.tipos_licenca ORDER BY nome;
-- ================================================================
