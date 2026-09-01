-- ============================================================
-- Logout automático por inatividade
-- ------------------------------------------------------------
-- 1. Adiciona a chave de configuração (minutos até desconectar;
--    0 / vazio = recurso desativado; padrão 15).
-- 2. Libera a LEITURA dessa única chave para qualquer usuário
--    autenticado — a tabela configuracoes_scont é, por padrão,
--    restrita a administradores (política "admins_somente").
--    As políticas permissivas são combinadas com OR, então o
--    admin continua enxergando todas as chaves e o usuário comum
--    passa a enxergar SOMENTE 'timeout_inatividade_min'.
--
-- Execute no Supabase SQL Editor do projeto do Portal.
-- ============================================================

INSERT INTO public.configuracoes_scont (chave, valor, descricao) VALUES
    ('timeout_inatividade_min', '15',
     'Minutos de inatividade até logout automático no portal/ferramentas (0 = desativado)')
ON CONFLICT (chave) DO NOTHING;

DROP POLICY IF EXISTS "leitura_timeout_inatividade" ON public.configuracoes_scont;
CREATE POLICY "leitura_timeout_inatividade" ON public.configuracoes_scont
    FOR SELECT
    TO authenticated
    USING (chave = 'timeout_inatividade_min');
