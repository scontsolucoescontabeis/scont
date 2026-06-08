-- ============================================================
-- Migration 013 — Empresa no contexto do chatbot
-- ============================================================

-- 1. CNPJ em contatos_empresas (nullable)
ALTER TABLE contatos_empresas ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- 2. Empresa e CNPJ selecionados na sessão do bot
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS empresa_selecionada TEXT;
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS cnpj_selecionado    TEXT;

-- 3. Empresa e CNPJ na conversa (para histórico e contexto do agente)
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_empresa TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_cnpj    TEXT;
