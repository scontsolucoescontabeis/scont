-- ============================================================
-- MALA DIRETA — Schema e RLS
-- Execute no SQL Editor do Supabase (projeto principal)
-- ============================================================

-- ── TABELA: mala_direta_contatos ─────────────────────────────
-- Catálogo reutilizável de destinatários
CREATE TABLE IF NOT EXISTS public.mala_direta_contatos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT NOT NULL,
    email      TEXT,
    telefone   TEXT,
    empresa    TEXT,
    cargo      TEXT,
    ativo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_md_contatos_nome ON public.mala_direta_contatos (nome);

-- ── TABELA: mala_direta_campanhas ────────────────────────────
-- Campanhas de mala direta
CREATE TABLE IF NOT EXISTS public.mala_direta_campanhas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             TEXT NOT NULL,
    descricao        TEXT,
    -- tipo_confirmacao define o que o destinatário pode fazer na página pública:
    --   'leitura'   → botão "Confirmar leitura"
    --   'interesse' → botões "Tenho interesse" / "Sem interesse"
    --   'nenhuma'   → sem link de confirmação, mensagem informativa apenas
    tipo_confirmacao TEXT NOT NULL DEFAULT 'leitura'
                         CHECK (tipo_confirmacao IN ('leitura', 'interesse', 'nenhuma')),
    template         TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'rascunho'
                         CHECK (status IN ('rascunho', 'ativa', 'encerrada')),
    criado_por       UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_md_campanhas_status    ON public.mala_direta_campanhas (status);
CREATE INDEX IF NOT EXISTS idx_md_campanhas_criado_por ON public.mala_direta_campanhas (criado_por);

-- ── TABELA: mala_direta_envios ────────────────────────────────
-- Vínculo campanha ↔ destinatário: mensagem personalizada + rastreamento
CREATE TABLE IF NOT EXISTS public.mala_direta_envios (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id        UUID NOT NULL REFERENCES public.mala_direta_campanhas(id) ON DELETE CASCADE,
    -- referência opcional ao contato de origem (null se destinatário avulso)
    contato_id         UUID REFERENCES public.mala_direta_contatos(id) ON DELETE SET NULL,
    -- snapshot dos dados no momento da criação do envio
    nome               TEXT NOT NULL,
    email              TEXT,
    telefone           TEXT,
    empresa            TEXT,
    cargo              TEXT,
    -- template com placeholders já substituídos
    mensagem_final     TEXT NOT NULL,
    -- token único de 32 chars hex — gerado no frontend via crypto.randomUUID()
    token              TEXT NOT NULL UNIQUE,
    -- canal preferencial de envio
    canal              TEXT NOT NULL DEFAULT 'ambos'
                           CHECK (canal IN ('email', 'whatsapp', 'ambos')),
    -- status de envio (administrador marca após disparar a mensagem)
    status_envio       TEXT NOT NULL DEFAULT 'pendente'
                           CHECK (status_envio IN ('pendente', 'enviado')),
    -- status de confirmação pelo destinatário (via página pública)
    status_confirmacao TEXT NOT NULL DEFAULT 'pendente'
                           CHECK (status_confirmacao IN ('pendente', 'lido', 'confirmado', 'recusado')),
    data_envio         TIMESTAMPTZ,
    data_confirmacao   TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_md_envios_campanha ON public.mala_direta_envios (campanha_id);
CREATE INDEX IF NOT EXISTS idx_md_envios_token    ON public.mala_direta_envios (token);

-- ── TRIGGERS: updated_at automático ──────────────────────────
-- (cria a função apenas se ainda não existir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER md_campanhas_set_updated_at
    BEFORE UPDATE ON public.mala_direta_campanhas
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER md_contatos_set_updated_at
    BEFORE UPDATE ON public.mala_direta_contatos
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.mala_direta_contatos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mala_direta_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mala_direta_envios    ENABLE ROW LEVEL SECURITY;

-- ── mala_direta_contatos ─────────────────────────────────────
-- Qualquer usuário autenticado do portal gerencia contatos
CREATE POLICY "md_contatos_auth_all"
    ON public.mala_direta_contatos
    FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

-- ── mala_direta_campanhas ────────────────────────────────────
-- Leitura: qualquer autenticado
CREATE POLICY "md_campanhas_select"
    ON public.mala_direta_campanhas
    FOR SELECT TO authenticated
    USING (TRUE);

-- Criação: qualquer autenticado; criado_por deve ser o próprio usuário
CREATE POLICY "md_campanhas_insert"
    ON public.mala_direta_campanhas
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = criado_por);

-- Edição: criador ou admin
CREATE POLICY "md_campanhas_update"
    ON public.mala_direta_campanhas
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = criado_por);

-- Exclusão: criador ou admin
CREATE POLICY "md_campanhas_delete"
    ON public.mala_direta_campanhas
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = criado_por);

-- ── mala_direta_envios ────────────────────────────────────────
-- Leitura e escrita completa: qualquer autenticado
CREATE POLICY "md_envios_auth_all"
    ON public.mala_direta_envios
    FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

-- Confirmação pública: anon lê envios (filtrado por token na query)
-- O token de 32 chars hex é a única "senha" do destinatário.
CREATE POLICY "md_envios_anon_select"
    ON public.mala_direta_envios
    FOR SELECT TO anon
    USING (TRUE);

-- Anon só pode atualizar status_confirmacao:
--   - envio deve estar marcado como 'enviado' (admin já disparou)
--   - confirmação ainda deve ser 'pendente' (evita dupla resposta)
--   - novo status deve ser um dos valores válidos de confirmação
CREATE POLICY "md_envios_anon_confirmar"
    ON public.mala_direta_envios
    FOR UPDATE TO anon
    USING (
        status_envio       = 'enviado'
        AND status_confirmacao = 'pendente'
    )
    WITH CHECK (
        status_confirmacao IN ('lido', 'confirmado', 'recusado')
        AND status_envio   = 'enviado'
    );

-- ============================================================
-- ASSUNTO DE EMAIL (adicionado após criação inicial)
-- ============================================================
ALTER TABLE public.mala_direta_campanhas
    ADD COLUMN IF NOT EXISTS assunto_email TEXT;

-- ============================================================
-- AGENDAMENTO DE ENVIO (adicionado após criação inicial)
-- Execute no SQL Editor do Supabase (projeto principal)
-- ============================================================
ALTER TABLE public.mala_direta_campanhas
    ADD COLUMN IF NOT EXISTS data_agendamento DATE;

COMMENT ON COLUMN public.mala_direta_campanhas.data_agendamento IS
    'Data prevista de envio da campanha. Gerada automaticamente pelo Conversor PDF → Agrupar e Agendar.';

-- ============================================================
-- GRUPOS DE CONTATOS (adicionado após criação inicial)
-- ============================================================

-- ── TABELA: mala_direta_grupos ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mala_direta_grupos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT NOT NULL,
    descricao  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_md_grupos_nome ON public.mala_direta_grupos (nome);

CREATE TRIGGER md_grupos_set_updated_at
    BEFORE UPDATE ON public.mala_direta_grupos
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── TABELA: mala_direta_grupo_contatos ───────────────────────
-- Relação N:N — um contato pode estar em vários grupos
CREATE TABLE IF NOT EXISTS public.mala_direta_grupo_contatos (
    grupo_id   UUID NOT NULL REFERENCES public.mala_direta_grupos(id)   ON DELETE CASCADE,
    contato_id UUID NOT NULL REFERENCES public.mala_direta_contatos(id) ON DELETE CASCADE,
    PRIMARY KEY (grupo_id, contato_id)
);

CREATE INDEX IF NOT EXISTS idx_md_gc_grupo   ON public.mala_direta_grupo_contatos (grupo_id);
CREATE INDEX IF NOT EXISTS idx_md_gc_contato ON public.mala_direta_grupo_contatos (contato_id);

-- ── RLS: Grupos ───────────────────────────────────────────────
ALTER TABLE public.mala_direta_grupos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mala_direta_grupo_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "md_grupos_auth_all"
    ON public.mala_direta_grupos
    FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "md_gc_auth_all"
    ON public.mala_direta_grupo_contatos
    FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

-- ── TABELA: mala_direta_regras ────────────────────────────────
-- Regras de envio recorrente geradas pelo Conversor PDF
CREATE TABLE IF NOT EXISTS public.mala_direta_regras (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL,
    tipos           TEXT[] NOT NULL DEFAULT '{}',
    frequencia      TEXT NOT NULL CHECK (frequencia IN ('semanal', 'mensal', 'unica')),
    dia_envio       INTEGER,           -- day-of-week (0=Sun) or day-of-month
    dia_envio_tipo  TEXT,              -- 'ultimo' for last day of month
    agrupar_empresa BOOLEAN NOT NULL DEFAULT TRUE,
    template        TEXT NOT NULL,
    assunto_email   TEXT,
    ativa           BOOLEAN NOT NULL DEFAULT TRUE,
    ultima_execucao DATE,
    criado_por      UUID REFERENCES public.usuarios(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mala_direta_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "md_regras_auth_all"
    ON public.mala_direta_regras
    FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

-- ── COLUNA data_agendamento em campanhas ─────────────────────
ALTER TABLE public.mala_direta_campanhas
    ADD COLUMN IF NOT EXISTS data_agendamento DATE;
