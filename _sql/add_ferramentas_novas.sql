-- ============================================================
-- Registra ferramentas novas na tabela ferramentas
-- Execute no SQL Editor do Supabase (projeto principal)
-- Idempotente: ON CONFLICT DO NOTHING
-- ============================================================

INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES
    ('Mala Direta',
     'Criação e envio de campanhas de e-mail personalizadas com variáveis de dados',
     '📨', './Projeto Mala Direta/index.html', TRUE, 120),

    ('Central de Alertas',
     'Monitoramento e gestão de alertas e notificações do sistema',
     '🔔', './Projeto Central Alertas/index.html', TRUE, 130),

    ('Gerador de Modelos',
     'Geração de contratos, recibos e documentos textuais com variáveis de dados',
     '📄', './Projeto Gerador Modelos/index.html', TRUE, 140)

ON CONFLICT DO NOTHING;

-- Resultado esperado: 3 linhas inseridas (ou 0 se já existirem)
-- Após executar, o administrador verá as 3 ferramentas automaticamente no portal.
-- Para liberar para usuários comuns, use o Painel Administrativo → Gerenciar Acessos.
