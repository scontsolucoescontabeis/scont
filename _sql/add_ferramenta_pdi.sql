
-- ============================================================
-- Registra a ferramenta "PDI" no portal.
-- Execute no SQL Editor do Supabase (projeto principal — mesmo de
-- `ferramentas`/`usuario_ferramentas`).
-- Idempotente: só insere se ainda não existir.
--
-- Depois de rodar, libere o acesso aos usuários pelo Painel
-- Administrativo → Gerenciar Acessos (colaboradores, gestores e sócios
-- precisam da ferramenta liberada; o papel dentro dela vem do próprio PDI
-- e de pdi_socios).
-- ============================================================
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
SELECT 'PDI — Plano de Desenvolvimento Individual',
       'Apresentação, monitoramento, avaliação e feedback do PDI da equipe Scont: pilares técnicos, comportamentais, performance e melhorias, ciclos trimestrais e ciência eletrônica',
       '🎯', './Projeto PDI/index.html', TRUE, 190
WHERE NOT EXISTS (SELECT 1 FROM public.ferramentas WHERE url_base = './Projeto PDI/index.html');
