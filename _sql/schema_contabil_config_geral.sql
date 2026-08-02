-- ============================================================
-- CONFIGURAÇÕES GERAIS — Departamento Contábil
--
-- Linha única (singleton) com ajustes gerais do módulo que não
-- se encaixam em "por empresa". Hoje só guarda o(s) e-mail(is) que
-- recebem o alerta quando um fechamento mensal é enviado para
-- validação (tela de Validações do Diário Contábil). Separado de
-- "configuracoes_scont" (que é sobre COMO o portal envia e-mail —
-- provedor/SMTP — e é restrito a admins do portal); esta tabela é
-- só sobre QUEM recebe este alerta específico, editável por
-- qualquer usuário com acesso à tela de Configurações deste módulo.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contabil_config_geral (
    id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    email_alerta_validacao  TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contabil_config_geral ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_config_geral: leitura autenticado" ON public.contabil_config_geral;
DROP POLICY IF EXISTS "contabil_config_geral: escrita autenticado" ON public.contabil_config_geral;

CREATE POLICY "contabil_config_geral: leitura autenticado"
    ON public.contabil_config_geral FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_config_geral: escrita autenticado"
    ON public.contabil_config_geral FOR ALL
    TO authenticated USING (true) WITH CHECK (true);
