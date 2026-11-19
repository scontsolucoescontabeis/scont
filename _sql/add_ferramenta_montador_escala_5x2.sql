-- ============================================================
-- Registra o "Montador de Escala 5x2" como ferramenta do portal.
-- Rodar no SQL editor do Supabase do PORTAL. Depois conceda acesso
-- aos usuários pelo Painel Administrativo.
-- Build estático em ./Projeto Montador Escala 5x2/app (gerado por npm run build
-- em "Projeto Montador Escala 5x2").
-- ============================================================
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem, nova_aba)
SELECT
    'Montador de Escala 5x2',
    'Planeje escalas de trabalho conforme a EC 141/2026 (fim da 6x1), com validação de conformidade, impacto estimado e exportação em PDF/Excel',
    '📅',
    './Projeto Montador Escala 5x2/app/index.html',
    TRUE,
    (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.ferramentas),
    FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.ferramentas WHERE url_base = './Projeto Montador Escala 5x2/app/index.html');
