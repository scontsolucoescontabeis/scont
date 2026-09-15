-- ============================================================================
-- ATENÇÃO: Confirmar nomes exatos contra a tabela public.ferramentas ANTES
-- de rodar este script contra produção!
-- ============================================================================
--
-- Os nomes abaixo são os documentados na spec do plano, mas podem divergir
-- no banco de produção. Nomes divergentes silenciosamente não afetarão
-- nenhuma linha (UPDATE onde o nome não existe não retorna erro, só 0 rows).
--
-- Query de conferência (rodar manualmente em produção):
--
-- SELECT nome, url_base, ativa FROM public.ferramentas
-- WHERE nome ILIKE '%folha%' OR nome ILIKE '%frequência%' OR nome ILIKE '%frequencia%'
--    OR nome ILIKE '%simulador%' OR nome ILIKE '%validação%' OR nome ILIKE '%validacao%'
--    OR nome ILIKE '%calendário%' OR nome ILIKE '%calendario%' OR nome ILIKE '%departamento pessoal%'
--    OR nome ILIKE '%admin%rh%' OR nome ILIKE '%módulo rh%' OR nome ILIKE '%modulo rh%';
--
-- ============================================================================

-- Reorganiza as ferramentas de Departamento Pessoal num hub único.
-- Idempotente: pode ser rodado mais de uma vez sem efeito colateral.

-- 1. O card "Departamento Pessoal" passa a apontar para o novo hub.
UPDATE public.ferramentas
SET url_base = './Projeto Departamento Pessoal/index.html',
    descricao = 'Hub com todas as ferramentas de Departamento Pessoal: Controle de Frequência, Lançamentos, Simulador, Fechamento, Validação, Calendário, Fluxos Operacionais e Configurações.'
WHERE nome = 'Departamento Pessoal';

-- 2. As ferramentas que entraram como cards dentro do hub saem da tela
--    principal do portal (soft-deactivate, não delete — preserva
--    usuario_ferramentas e permite reverter facilmente).
UPDATE public.ferramentas
SET ativa = false
WHERE nome IN (
    'Folha de Ponto',                        -- Controle de Frequência - Ponto
    'Lançamentos de Folha',
    'Simulador de Folha de Pagamento',
    'Fechamento Folha de Pagamento',
    'Validação de Fechamento de Folha',
    'Calendário da Folha',
    'Admin – Módulo RH'
);
