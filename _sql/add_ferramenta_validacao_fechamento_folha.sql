-- ============================================================
-- Registra a ferramenta "Validação de Fechamento de Folha" no portal
-- Execute no SQL Editor do Supabase (projeto principal — mesmo projeto
-- de `ferramentas`/`usuario_ferramentas`, não os projetos de licenças).
-- Idempotente: ON CONFLICT DO NOTHING
--
-- Depois de rodar, conceda acesso aos usuários pelo Painel
-- Administrativo (aba de ferramentas) como em qualquer outra ferramenta.
-- ============================================================
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES (
    'Validação de Fechamento de Folha',
    'Compara o Extrato Mensal da competência atual com a anterior: mudanças de quadro (admissões, saídas, férias) e variação de proventos/descontos/líquido por empregado',
    '🔍',
    './Projeto Validação Fechamento Folha/index.html',
    TRUE,
    16
)
ON CONFLICT DO NOTHING;
