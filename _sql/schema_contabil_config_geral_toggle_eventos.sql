-- ============================================================
-- CONFIGURAÇÕES GERAIS — Departamento Contábil
-- Toggle por tipo de evento de e-mail
--
-- Adiciona a `contabil_config_geral` (rodar depois de
-- schema_contabil_config_geral.sql) uma coluna booleana por tipo de
-- evento que hoje dispara e-mail no Diário Contábil, permitindo
-- desligar cada um individualmente pela tela de Configurações →
-- Alertas por E-mail, sem mexer na lista de destinatários. Todas
-- default TRUE para não mudar o comportamento de quem já usa o
-- alerta hoje.
-- ============================================================

ALTER TABLE public.contabil_config_geral
    ADD COLUMN IF NOT EXISTS notificar_validacao_fechamento  BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notificar_fechamento_aprovado   BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notificar_fechamento_rejeitado  BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notificar_pendencia_execucao    BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notificar_pendencia_resolvida   BOOLEAN NOT NULL DEFAULT TRUE;
