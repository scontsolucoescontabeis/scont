-- Registra Benefícios VA/VT na tabela ferramentas do Portal
-- Idempotente
ALTER TABLE public.ferramentas ADD COLUMN IF NOT EXISTS nova_aba BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem, nova_aba)
SELECT
  'Benefícios VA/VT',
  'Lançamento de Vale Transporte e Vale Alimentação — gera TXT para a folha',
  '🎫',
  './Projeto Beneficios/index.html',
  true,
  160,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.ferramentas WHERE nome = 'Benefícios VA/VT');
