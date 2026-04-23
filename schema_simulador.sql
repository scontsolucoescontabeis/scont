-- ============================================================
-- SCONT - SIMULADOR DE FOLHA DE PAGAMENTO
-- Schema PostgreSQL / Supabase
-- Execute no SQL Editor do Supabase
-- ============================================================


-- ============================================================
-- 1. sim_cenarios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sim_cenarios (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID          NOT NULL REFERENCES public.solicitacoes_acesso(id) ON DELETE CASCADE,
    nome             TEXT          NOT NULL,
    regime           TEXT          NOT NULL DEFAULT 'simples',
    faturamento      NUMERIC(15,2) NOT NULL DEFAULT 0,
    dias_uteis       INTEGER       NOT NULL DEFAULT 22,
    vale_alimentacao NUMERIC(10,2) NOT NULL DEFAULT 0,
    plano_saude      NUMERIC(10,2) NOT NULL DEFAULT 0,
    av_alvo          NUMERIC(6,4)  NOT NULL DEFAULT 0.10,
    criado_em        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    atualizado_em    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT sim_cenarios_regime_check CHECK (regime IN ('simples', 'lucro'))
);

CREATE INDEX IF NOT EXISTS idx_sim_cenarios_usuario ON public.sim_cenarios (usuario_id);
CREATE INDEX IF NOT EXISTS idx_sim_cenarios_criado  ON public.sim_cenarios (usuario_id, criado_em);


-- ============================================================
-- 2. sim_colaboradores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sim_colaboradores (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    cenario_id UUID          NOT NULL REFERENCES public.sim_cenarios(id) ON DELETE CASCADE,
    ordem      INTEGER       NOT NULL DEFAULT 0,
    nome       TEXT          NOT NULL DEFAULT '',
    cargo      TEXT          NOT NULL DEFAULT 'vendedor',
    tipo       TEXT          NOT NULL DEFAULT 'celetista',
    salario    NUMERIC(12,2) NOT NULL DEFAULT 0,
    comissao   NUMERIC(6,2)  NOT NULL DEFAULT 0,

    CONSTRAINT sim_colaboradores_tipo_check CHECK (tipo IN ('celetista', 'comissionado'))
);

CREATE INDEX IF NOT EXISTS idx_sim_colaboradores_cenario ON public.sim_colaboradores (cenario_id, ordem);


-- ============================================================
-- 3. sim_configuracoes  (uma linha por usuário — upsert)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sim_configuracoes (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID         NOT NULL REFERENCES public.solicitacoes_acesso(id) ON DELETE CASCADE,
    aliquota_simples NUMERIC(6,4) NOT NULL DEFAULT 0.06,
    aliquota_lucro   NUMERIC(6,4) NOT NULL DEFAULT 0.15,
    inss_lucro       NUMERIC(6,4) NOT NULL DEFAULT 0.20,
    rat_lucro        NUMERIC(6,4) NOT NULL DEFAULT 0.02,
    terceiros_lucro  NUMERIC(6,4) NOT NULL DEFAULT 0.018,
    atualizado_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT sim_configuracoes_usuario_unique UNIQUE (usuario_id)
);


-- ============================================================
-- 4. sim_cargos  (cargos personalizados por usuário)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sim_cargos (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID    NOT NULL REFERENCES public.solicitacoes_acesso(id) ON DELETE CASCADE,
    nome       TEXT    NOT NULL,
    ordem      INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT sim_cargos_usuario_nome_unique UNIQUE (usuario_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_sim_cargos_usuario ON public.sim_cargos (usuario_id, ordem);


-- ============================================================
-- 5. RLS — Row Level Security
-- Usa auth.email() em vez de subquery em auth.users
-- (auth.email() é função nativa do Supabase, sem restrição de permissão)
-- ============================================================

ALTER TABLE public.sim_cenarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_cargos        ENABLE ROW LEVEL SECURITY;


-- 5.1 sim_cenarios
DROP POLICY IF EXISTS "sim_cenarios_select" ON public.sim_cenarios;
CREATE POLICY "sim_cenarios_select" ON public.sim_cenarios
    FOR SELECT USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_cenarios_insert" ON public.sim_cenarios;
CREATE POLICY "sim_cenarios_insert" ON public.sim_cenarios
    FOR INSERT WITH CHECK (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_cenarios_update" ON public.sim_cenarios;
CREATE POLICY "sim_cenarios_update" ON public.sim_cenarios
    FOR UPDATE USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_cenarios_delete" ON public.sim_cenarios;
CREATE POLICY "sim_cenarios_delete" ON public.sim_cenarios
    FOR DELETE USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );


-- 5.2 sim_colaboradores
DROP POLICY IF EXISTS "sim_colaboradores_select" ON public.sim_colaboradores;
CREATE POLICY "sim_colaboradores_select" ON public.sim_colaboradores
    FOR SELECT USING (
        cenario_id IN (
            SELECT id FROM public.sim_cenarios
            WHERE usuario_id IN (
                SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
            )
        )
    );

DROP POLICY IF EXISTS "sim_colaboradores_insert" ON public.sim_colaboradores;
CREATE POLICY "sim_colaboradores_insert" ON public.sim_colaboradores
    FOR INSERT WITH CHECK (
        cenario_id IN (
            SELECT id FROM public.sim_cenarios
            WHERE usuario_id IN (
                SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
            )
        )
    );

DROP POLICY IF EXISTS "sim_colaboradores_update" ON public.sim_colaboradores;
CREATE POLICY "sim_colaboradores_update" ON public.sim_colaboradores
    FOR UPDATE USING (
        cenario_id IN (
            SELECT id FROM public.sim_cenarios
            WHERE usuario_id IN (
                SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
            )
        )
    );

DROP POLICY IF EXISTS "sim_colaboradores_delete" ON public.sim_colaboradores;
CREATE POLICY "sim_colaboradores_delete" ON public.sim_colaboradores
    FOR DELETE USING (
        cenario_id IN (
            SELECT id FROM public.sim_cenarios
            WHERE usuario_id IN (
                SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
            )
        )
    );


-- 5.3 sim_configuracoes
DROP POLICY IF EXISTS "sim_configuracoes_select" ON public.sim_configuracoes;
CREATE POLICY "sim_configuracoes_select" ON public.sim_configuracoes
    FOR SELECT USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_configuracoes_insert" ON public.sim_configuracoes;
CREATE POLICY "sim_configuracoes_insert" ON public.sim_configuracoes
    FOR INSERT WITH CHECK (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_configuracoes_update" ON public.sim_configuracoes;
CREATE POLICY "sim_configuracoes_update" ON public.sim_configuracoes
    FOR UPDATE USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_configuracoes_delete" ON public.sim_configuracoes;
CREATE POLICY "sim_configuracoes_delete" ON public.sim_configuracoes
    FOR DELETE USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );


-- 5.4 sim_cargos
DROP POLICY IF EXISTS "sim_cargos_select" ON public.sim_cargos;
CREATE POLICY "sim_cargos_select" ON public.sim_cargos
    FOR SELECT USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_cargos_insert" ON public.sim_cargos;
CREATE POLICY "sim_cargos_insert" ON public.sim_cargos
    FOR INSERT WITH CHECK (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_cargos_update" ON public.sim_cargos;
CREATE POLICY "sim_cargos_update" ON public.sim_cargos
    FOR UPDATE USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "sim_cargos_delete" ON public.sim_cargos;
CREATE POLICY "sim_cargos_delete" ON public.sim_cargos
    FOR DELETE USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
    );
