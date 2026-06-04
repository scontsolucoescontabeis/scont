-- ============================================================
-- SCONT Messenger — Integração com o Portal
-- Executar no banco do PROJETO PORTAL (supabase-config.js / SUPABASE_URL)
-- ============================================================

-- 1. Adicionar coluna nova_aba à tabela ferramentas (se ainda não existir)
ALTER TABLE ferramentas ADD COLUMN IF NOT EXISTS nova_aba BOOLEAN NOT NULL DEFAULT false;

-- 2. Inserir o CRM Messenger (somente se ainda não existir pelo nome)
INSERT INTO ferramentas (nome, descricao, icone, url_base, ativa, ordem, nova_aba)
SELECT
  'CRM Messenger',
  'Atendimento via WhatsApp — receba e responda mensagens dos clientes com roteamento por departamento',
  '💬',
  'http://localhost:5173',
  true,
  10,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ferramentas WHERE nome = 'CRM Messenger'
);

-- 3. Se já existir, atualiza a URL e garante nova_aba = true
UPDATE ferramentas
SET
  descricao = 'Atendimento via WhatsApp — receba e responda mensagens dos clientes com roteamento por departamento',
  icone     = '💬',
  nova_aba  = true
WHERE nome = 'CRM Messenger';

-- ============================================================
-- Após rodar este SQL:
-- 1. Edite a ferramenta "CRM Messenger" no painel admin → aba Ferramentas
-- 2. Ajuste a URL para o endereço real do CRM (dev ou produção)
-- ============================================================
