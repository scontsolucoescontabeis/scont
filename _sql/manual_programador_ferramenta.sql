-- ============================================================
-- Registra o "Manual do Programador" como ferramenta do portal.
-- Rodar no SQL editor do Supabase do PORTAL (mesmo projeto de
-- `ferramentas`/`usuario_ferramentas`, não os projetos de licenças).
--
-- Depois de rodar, conceda acesso aos usuários pelo Painel
-- Administrativo (aba de ferramentas) como em qualquer outra ferramenta.
-- Mesma convenção de acesso do "Manual do Usuário": quem já tem acesso
-- a uma ferramenta X também precisa ter acesso a ESTA ferramenta pra
-- ver a especificação técnica de X (dois controles independentes —
-- primeiro entrar no Manual do Programador, depois o grupo daquela
-- ferramenta aparecer, igual ao Manual do Usuário).
-- ============================================================
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES (
    'Manual do Programador',
    'Especificações técnicas, modelo de dados e diagramas das ferramentas do portal, para manutenção e evolução por programadores',
    '🛠️',
    './Projeto Manual Programador/index.html',
    TRUE,
    6
)
ON CONFLICT DO NOTHING;
