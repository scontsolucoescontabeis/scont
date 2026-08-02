-- ============================================================
-- BANCOS UTILIZADOS — restringe leitura/escrita a Admin / Equipe Scont
-- Execute no SQL Editor do Supabase
--
-- Contexto: contabil_mapeamento_bancos guarda login e SENHA EM TEXTO PURO
-- dos acessos bancários (decisão deliberada do usuário, sem criptografia).
-- Até aqui a RLS liberava leitura/escrita para qualquer usuário autenticado
-- (TO authenticated USING (true)) — a tela já escondia esses dados de quem
-- não pode editar o Mapeamento (Prestador de Serviço), mas um usuário desse
-- tipo ainda conseguiria ler a tabela direto pela API do Supabase, já que
-- a RLS não impunha nenhuma restrição real. Este script fecha essa brecha
-- no banco, não só na tela.
-- ============================================================

CREATE OR REPLACE FUNCTION public.contabil_pode_ver_bancos()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT public.is_admin() OR EXISTS (
        SELECT 1 FROM public.solicitacoes_acesso
        WHERE email = auth.email()
          AND lower(empresa) = 'scont soluções contábeis'
    );
$$;

GRANT EXECUTE ON FUNCTION public.contabil_pode_ver_bancos() TO authenticated;

DROP POLICY IF EXISTS "contabil_bancos: leitura autenticado" ON public.contabil_mapeamento_bancos;
DROP POLICY IF EXISTS "contabil_bancos: escrita autenticado"  ON public.contabil_mapeamento_bancos;
DROP POLICY IF EXISTS "contabil_bancos: leitura restrita scont/admin" ON public.contabil_mapeamento_bancos;
DROP POLICY IF EXISTS "contabil_bancos: escrita restrita scont/admin" ON public.contabil_mapeamento_bancos;

CREATE POLICY "contabil_bancos: leitura restrita scont/admin"
    ON public.contabil_mapeamento_bancos FOR SELECT
    TO authenticated USING (public.contabil_pode_ver_bancos());

CREATE POLICY "contabil_bancos: escrita restrita scont/admin"
    ON public.contabil_mapeamento_bancos FOR ALL
    TO authenticated USING (public.contabil_pode_ver_bancos()) WITH CHECK (public.contabil_pode_ver_bancos());
