-- ============================================================
-- Triagem de Atendimentos — tabelas no Supabase (projeto principal)
-- Execute no SQL Editor do Supabase antes de usar o upload.html
-- ============================================================

-- Linhas da aba "Triagem"
CREATE TABLE IF NOT EXISTS public.triagem_demandas (
  id        SERIAL PRIMARY KEY,
  num       INTEGER,
  cliente   TEXT,
  dept      TEXT,
  cat       TEXT,
  sub       TEXT,
  func      TEXT,
  prazo     TEXT,
  prio      TEXT,
  dados     TEXT,
  pend      TEXT,
  dom       TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dados da aba "Resumo" + alertas + encaminhamento (sempre 1 linha, id fixo = 1)
CREATE TABLE IF NOT EXISTS public.triagem_resumo (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  total      INTEGER,
  by_dept    JSONB,
  by_prio    JSONB,
  data_hora  TEXT,
  alerts     JSONB,
  enc_text   TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversas da aba "Triagem Completa"
CREATE TABLE IF NOT EXISTS public.triagem_conversas (
  id           SERIAL PRIMARY KEY,
  contact_key  TEXT,
  raw_name     TEXT,
  aba          TEXT,
  msgs         JSONB,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.triagem_demandas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triagem_resumo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triagem_conversas ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
DROP POLICY IF EXISTS "triagem_read"  ON public.triagem_demandas;
DROP POLICY IF EXISTS "triagem_read"  ON public.triagem_resumo;
DROP POLICY IF EXISTS "triagem_read"  ON public.triagem_conversas;
CREATE POLICY "triagem_read" ON public.triagem_demandas  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "triagem_read" ON public.triagem_resumo    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "triagem_read" ON public.triagem_conversas FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita: qualquer usuário autenticado (upload via ferramenta protegida pelo auth guard)
DROP POLICY IF EXISTS "triagem_write" ON public.triagem_demandas;
DROP POLICY IF EXISTS "triagem_write" ON public.triagem_resumo;
DROP POLICY IF EXISTS "triagem_write" ON public.triagem_conversas;
CREATE POLICY "triagem_write" ON public.triagem_demandas  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "triagem_write" ON public.triagem_resumo    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "triagem_write" ON public.triagem_conversas FOR ALL USING (auth.role() = 'authenticated');
