-- ============================================================
-- SCONT - GERENCIADOR DE FORMULÁRIOS
-- Validação do preenchimento pelo cliente (por e-mail, sem login)
-- Execute este arquivo no SQL Editor do Supabase
-- Ver spec: docs/superpowers/specs/2026-08-11-gerenciador-formularios-validacao-cliente-design.md
-- ============================================================


-- ============================================================
-- 1. formularios / empregados: status novos + colunas de vínculo
-- ============================================================

-- 1.1 CHECK de status ampliado (mesma constraint recriada com os 2 valores novos)
ALTER TABLE public.formularios DROP CONSTRAINT IF EXISTS formularios_status_check;
ALTER TABLE public.formularios ADD CONSTRAINT formularios_status_check
    CHECK (status IN ('recebido', 'validado', 'rejeitado', 'excluido',
                       'aguardando_validacao_cliente', 'pendencia_preenchimento_documentacao'));

ALTER TABLE public.empregados DROP CONSTRAINT IF EXISTS empregados_status_check;
ALTER TABLE public.empregados ADD CONSTRAINT empregados_status_check
    CHECK (status IN ('recebido', 'validado', 'rejeitado', 'excluido',
                       'aguardando_validacao_cliente', 'pendencia_preenchimento_documentacao'));

-- 1.2 Colunas novas (rh_empresa_id, e-mail usado no pedido, token de uso único)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='rh_empresa_id') THEN
        ALTER TABLE public.formularios ADD COLUMN rh_empresa_id UUID REFERENCES public.rh_empresas(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='email_validacao_cliente') THEN
        ALTER TABLE public.formularios ADD COLUMN email_validacao_cliente TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='formularios' AND column_name='token_validacao') THEN
        ALTER TABLE public.formularios ADD COLUMN token_validacao UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='rh_empresa_id') THEN
        ALTER TABLE public.empregados ADD COLUMN rh_empresa_id UUID REFERENCES public.rh_empresas(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='email_validacao_cliente') THEN
        ALTER TABLE public.empregados ADD COLUMN email_validacao_cliente TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='empregados' AND column_name='token_validacao') THEN
        ALTER TABLE public.empregados ADD COLUMN token_validacao UUID;
    END IF;
END $$;


-- ============================================================
-- 2. Nova tabela: formularios_config_email
--    E-mail interno da Scont que recebe o aviso quando o cliente
--    valida ou reporta pendência, por tipo de formulário.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.formularios_config_email (
    tipo_formulario TEXT PRIMARY KEY CHECK (tipo_formulario IN ('registro', 'alteracao', 'empregado')),
    email           TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.formularios_config_email (tipo_formulario, email)
VALUES ('registro', NULL), ('alteracao', NULL), ('empregado', NULL)
ON CONFLICT (tipo_formulario) DO NOTHING;

ALTER TABLE public.formularios_config_email ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formularios_config_email: staff select" ON public.formularios_config_email;
DROP POLICY IF EXISTS "formularios_config_email: staff update" ON public.formularios_config_email;

CREATE POLICY "formularios_config_email: staff select"
    ON public.formularios_config_email FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "formularios_config_email: staff update"
    ON public.formularios_config_email FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

-- Sem policy de INSERT/DELETE para authenticated: as 3 linhas já existem
-- (seed acima) e a tela de Configurações só faz UPDATE. anon sem acesso.
