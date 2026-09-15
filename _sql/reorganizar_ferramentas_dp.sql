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

-- 1b. Concede acesso ao hub para todo usuário que já tinha acesso a
--     qualquer uma das 7 ferramentas que estão sendo desativadas (evita
--     que quem usava Folha de Ponto/Simulador/etc. no dia a dia perca o
--     acesso quando o card correspondente sumir da tela principal — o
--     guard do portal autoriza por pasta, e a pasta mudou para
--     "Projeto Departamento Pessoal").
--     Idempotente via ON CONFLICT na constraint usuario_ferramenta_unique
--     (usuario_id, ferramenta_id).
INSERT INTO public.usuario_ferramentas (usuario_id, ferramenta_id)
SELECT DISTINCT uf.usuario_id, hub.id
FROM public.usuario_ferramentas uf
JOIN public.ferramentas f ON f.id = uf.ferramenta_id
CROSS JOIN LATERAL (
    SELECT id FROM public.ferramentas WHERE nome = 'Departamento Pessoal'
) hub
WHERE f.nome IN (
    'Folha de Ponto',                        -- Controle de Frequência - Ponto
    'Lançamentos de Folha',
    'Simulador de Folha de Pagamento',
    'Fechamento Folha de Pagamento',
    'Validação de Fechamento de Folha',
    'Calendário da Folha',
    'Admin – Módulo RH'
)
ON CONFLICT ON CONSTRAINT usuario_ferramenta_unique DO NOTHING;

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
