-- ============================================================
-- Boas Vindas — alíquotas por CNAE (Lucro Presumido e Simples Nacional)
-- Fonte: planilha Mapa_Aliquotas_CNAE_... (Econet, coleta 16/10/2026).
-- Valores guardados como texto, exatamente como na planilha: quando o CNAE
-- tem mais de uma atividade, os campos vêm separados por "/" na mesma ordem
-- de base_presuncao (que separa atividades por ";").
-- Leitura pública só via função, por lista de códigos (nada de SELECT direto).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cnae_aliquotas (
    codigo            TEXT PRIMARY KEY,   -- 0000-0/00
    descricao         TEXT,
    base_presuncao    TEXT,
    irpj_pres_ate5    TEXT,
    irpj_pres_acima5  TEXT,
    csll_pres_ate5    TEXT,
    csll_pres_acima5  TEXT,
    irpj_aliq         TEXT,
    csll_aliq         TEXT,
    pis               TEXT,
    cofins            TEXT,
    ibs               TEXT,
    cbs               TEXT,
    rat               TEXT,
    terceiros         TEXT,
    sn_situacao       TEXT,
    sn_anexo          TEXT,
    obs_lp            TEXT
);

ALTER TABLE public.cnae_aliquotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cnae_aliquotas: admin gerencia" ON public.cnae_aliquotas;
CREATE POLICY "cnae_aliquotas: admin gerencia"
    ON public.cnae_aliquotas FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.fn_buscar_aliquotas_cnae(p_codigos TEXT[])
RETURNS SETOF public.cnae_aliquotas
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT * FROM public.cnae_aliquotas WHERE codigo = ANY (p_codigos);
$$;
GRANT EXECUTE ON FUNCTION public.fn_buscar_aliquotas_cnae(TEXT[]) TO anon, authenticated;
