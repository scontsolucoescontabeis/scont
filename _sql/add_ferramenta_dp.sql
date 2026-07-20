-- ============================================================
-- Registra a ferramenta "Departamento Pessoal" no portal
-- Execute no SQL Editor do Supabase (projeto principal)
-- Idempotente: ON CONFLICT DO NOTHING
-- ============================================================

INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES
    ('Departamento Pessoal',
     'Fluxos operacionais do DP (rescisões, admissões, férias) com passo a passo textual e fluxograma visual',
     '📋', './Projeto Departamento Pessoal/index.html', TRUE, 160)

ON CONFLICT DO NOTHING;

-- Resultado esperado: 1 linha inserida (ou 0 se já existir)
-- Após executar, o administrador verá a ferramenta no portal.
-- Para liberar para usuários comuns: Painel Administrativo → Gerenciar Acessos.
