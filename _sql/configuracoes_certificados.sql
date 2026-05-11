-- ============================================================
-- TABELA: configuracoes_certificados
-- Preferências globais do módulo Certificado Digital
-- Execute este script no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracoes_certificados (
    chave         TEXT        PRIMARY KEY,
    valor         TEXT,
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.configuracoes_certificados ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados leem todas as configurações
DROP POLICY IF EXISTS "cert_cfg: autenticado lê" ON public.configuracoes_certificados;
CREATE POLICY "cert_cfg: autenticado lê"
    ON public.configuracoes_certificados FOR SELECT
    USING (auth.role() = 'authenticated');

-- Usuários autenticados podem gravar (INSERT / UPDATE via upsert)
DROP POLICY IF EXISTS "cert_cfg: autenticado grava" ON public.configuracoes_certificados;
CREATE POLICY "cert_cfg: autenticado grava"
    ON public.configuracoes_certificados FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cert_cfg: autenticado atualiza" ON public.configuracoes_certificados;
CREATE POLICY "cert_cfg: autenticado atualiza"
    ON public.configuracoes_certificados FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Dados iniciais
INSERT INTO public.configuracoes_certificados (chave, valor) VALUES
    ('pageSize', '10')
ON CONFLICT (chave) DO NOTHING;
