-- ============================================================
-- Registra a ferramenta "Demandas de Clientes" no portal.
-- Execute no SQL Editor do Supabase (projeto principal).
-- Idempotente: só insere se ainda não existir.
-- Rode ANTES: _sql/schema_demandas.sql
--
-- Depois de rodar, libere o acesso aos usuários pelo Painel
-- Administrativo → Gerenciar Acessos. Admin já tem acesso irrestrito.
-- ============================================================
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
SELECT 'Demandas de Clientes',
       'Controle das demandas dos clientes (leitura diária da caixa de e-mail): importação da planilha, painel de pendências, prazos, tratativas e histórico por cliente',
       '📥', './Projeto Demandas/index.html', TRUE, 195
WHERE NOT EXISTS (SELECT 1 FROM public.ferramentas WHERE url_base = './Projeto Demandas/index.html');
