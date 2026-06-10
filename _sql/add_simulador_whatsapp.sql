-- ============================================================
-- Registra o Simulador WhatsApp na tabela ferramentas do Portal
-- Executar no SQL Editor do Supabase (projeto Portal)
-- Idempotente: não insere se já existir
-- ============================================================

-- Garante que a coluna nova_aba existe (criada pelo portal-integration.sql do CRM)
ALTER TABLE public.ferramentas ADD COLUMN IF NOT EXISTS nova_aba BOOLEAN NOT NULL DEFAULT false;

-- Insere somente se ainda não existir
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem, nova_aba)
SELECT
  'Simulador WhatsApp',
  'Simule conversas WhatsApp para testar o fluxo de atendimento do CRM',
  '📱',
  './Projeto CRM/public/docs/simulador-whatsapp.html',
  true,
  155,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.ferramentas WHERE nome = 'Simulador WhatsApp'
);

-- ============================================================
-- Após executar:
-- 1. O administrador verá "Simulador WhatsApp" na aba Ferramentas
--    do painel admin-dashboard.html
-- 2. Para liberar acesso a um usuário: Painel Admin → Solicitações
--    → Aprovar → marcar ✓ "Simulador WhatsApp"
-- 3. O guard bloqueia automaticamente quem não tem acesso
-- ============================================================
