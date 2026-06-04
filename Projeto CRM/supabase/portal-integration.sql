-- ============================================================
-- SCONT Messenger — Integração com o Portal
-- Executar no banco do PROJETO PORTAL (supabase-config.js / SUPABASE_URL)
-- ============================================================

-- 1. Adicionar coluna nova_aba à tabela ferramentas (se ainda não existir)
ALTER TABLE ferramentas ADD COLUMN IF NOT EXISTS nova_aba BOOLEAN NOT NULL DEFAULT false;

-- 2. Inserir o CRM Messenger como ferramenta do portal
--    Ajuste a url_base para o URL real após o deploy:
--    - Desenvolvimento: http://localhost:5173
--    - Produção: https://seu-dominio.com/crm  OU  ./Projeto CRM/dist/index.html
INSERT INTO ferramentas (nome, descricao, icone, url_base, ativa, ordem, nova_aba)
VALUES (
  'CRM Messenger',
  'Atendimento via WhatsApp — receba e responda mensagens dos clientes com roteamento por departamento',
  '💬',
  'http://localhost:5173',
  true,
  10,
  true
)
ON CONFLICT (nome) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      icone     = EXCLUDED.icone,
      url_base  = EXCLUDED.url_base,
      ativa     = EXCLUDED.ativa,
      ordem     = EXCLUDED.ordem,
      nova_aba  = EXCLUDED.nova_aba;
