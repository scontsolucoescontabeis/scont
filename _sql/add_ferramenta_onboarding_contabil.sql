-- ============================================================
-- Registra a ferramenta "Onboarding Contábil" no portal
-- Execute no SQL Editor do Supabase (projeto principal)
-- Idempotente: ON CONFLICT DO NOTHING
-- ============================================================

INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES
    ('Onboarding Contábil',
     'Levantamento de documentos e balanço inicial para empresas ingressantes na SCONT',
     '🧾', './Projeto Onboarding Contabil/index.html', TRUE, 170)

ON CONFLICT DO NOTHING;

-- Resultado esperado: 1 linha inserida (ou 0 se já existir)
-- Após executar, o administrador verá a ferramenta no portal.
-- Para liberar para usuários comuns: Painel Administrativo → Gerenciar Acessos.
