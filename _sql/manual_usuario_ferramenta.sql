-- ============================================================
-- Registra o "Manual do Usuário" como ferramenta do portal.
-- Rodar no SQL editor do Supabase do PORTAL (mesmo projeto de
-- `ferramentas`/`usuario_ferramentas`, não os projetos de licenças).
--
-- Depois de rodar, conceda acesso aos usuários pelo Painel
-- Administrativo (aba de ferramentas) como em qualquer outra ferramenta.
-- ============================================================
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES (
    'Manual do Usuário',
    'Guia de uso, funcionalidades e memórias de cálculo das ferramentas do portal',
    '📘',
    './Projeto Manual/index.html',
    TRUE,
    5
)
ON CONFLICT DO NOTHING;
