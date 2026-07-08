-- Migração: valores diários de VT/VA por empregado (rh_valores_va_vt)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.rh_valores_va_vt (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa      TEXT NOT NULL,
    codigo_empregado    TEXT NOT NULL,
    valor_vt            NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_va            NUMERIC(10,2) NOT NULL DEFAULT 0,
    data_atualizacao    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rh_valores_va_vt_empresa_empregado_unique UNIQUE (codigo_empresa, codigo_empregado)
);

CREATE INDEX IF NOT EXISTS idx_rh_valores_va_vt_empresa ON public.rh_valores_va_vt (codigo_empresa);

ALTER TABLE public.rh_valores_va_vt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_valores_va_vt: leitura autenticado" ON public.rh_valores_va_vt;
DROP POLICY IF EXISTS "rh_valores_va_vt: escrita autenticado" ON public.rh_valores_va_vt;

CREATE POLICY "rh_valores_va_vt: leitura autenticado"
    ON public.rh_valores_va_vt FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "rh_valores_va_vt: escrita autenticado"
    ON public.rh_valores_va_vt FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);
