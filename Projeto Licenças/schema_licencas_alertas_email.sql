-- ============================================================
-- Controle de Licenças — alertas de vencimento por e-mail
-- Mesmo padrão já usado em Certificado Digital
-- (Projeto Certificado Digital/schema_certificado_alertas_email.sql):
-- 1) Colunas em licencas/alvaras para não repetir o mesmo alerta de
--    nível mais de uma vez (dedupe do job diário).
-- 2) Tabela configuracoes_licencas (chave/valor) — a tela de
--    Configurações passa a gravar aqui em vez de localStorage, para
--    que a Edge Function agendada (roda fora do navegador) leia o
--    mesmo "ativar alertas / dias / e-mail" configurado na tela.
-- Idempotente — pode ser executado mais de uma vez.
-- ============================================================

ALTER TABLE public.licencas
  ADD COLUMN IF NOT EXISTS ultimo_alerta_nivel TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_alerta_em     TIMESTAMPTZ;

ALTER TABLE public.alvaras
  ADD COLUMN IF NOT EXISTS ultimo_alerta_nivel TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_alerta_em     TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.configuracoes_licencas (
    chave         TEXT PRIMARY KEY,
    valor         TEXT,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.configuracoes_licencas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracoes_licencas: leitura autenticado" ON public.configuracoes_licencas;
DROP POLICY IF EXISTS "configuracoes_licencas: escrita autenticado" ON public.configuracoes_licencas;

CREATE POLICY "configuracoes_licencas: leitura autenticado"
    ON public.configuracoes_licencas FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "configuracoes_licencas: escrita autenticado"
    ON public.configuracoes_licencas FOR ALL
    TO authenticated USING (true) WITH CHECK (true);
