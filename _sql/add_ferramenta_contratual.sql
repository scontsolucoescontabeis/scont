-- ============================================================
-- Registra a ferramenta "Controle de Alterações Contratuais" no portal.
-- Execute no SQL Editor do Supabase (projeto principal — mesmo de
-- `ferramentas`/`usuario_ferramentas`, NÃO os projetos de licenças).
-- Idempotente: ON CONFLICT DO NOTHING.
--
-- Depois de rodar, libere o acesso aos usuários pelo Painel
-- Administrativo → Gerenciar Acessos, como em qualquer outra ferramenta.
-- ============================================================
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES
    ('Controle de Alterações Contratuais',
     'Compara duas versões do contrato social (PDF ou Word), classifica cada cláusula como alterada, nova ou suprimida e gera o documento de controle para o cliente',
     '📄', './Projeto Contratual/index.html', TRUE, 180)
ON CONFLICT DO NOTHING;

-- Resultado esperado: 1 linha inserida (ou 0 se já existir).
