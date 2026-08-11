-- ============================================================
-- Boas Vindas — fecha vazamento de dados pessoais (LGPD) em
-- `apresentacoes`
--
-- Antes: a policy "apresentacoes: leitura pública ativa" liberava
-- SELECT de QUALQUER linha com ativo=true, pra qualquer papel
-- (nem tinha `TO authenticated`/`TO anon`, então valia pra todo mundo,
-- inclusive requisições anônimas direto na API REST). A tela pública
-- só filtra por `id` no cliente (`.eq('id', id)`) — isso não é
-- enforcement nenhum, é só uma sugestão que a própria página segue;
-- um `GET /rest/v1/apresentacoes?ativo=eq.true&select=*` direto (com
-- a anon key, que já é pública no supabase-config.js do portal) traz
-- razão social, CNPJ, nome do contato, e-mail e telefone de TODOS os
-- clientes ativos, não só o do link que a pessoa recebeu.
--
-- Depois: a leitura pública deixa de ser via SELECT direto na tabela.
-- `fn_buscar_apresentacao_publica(p_id)` é SECURITY DEFINER, devolve
-- só a linha daquele id específico (e só se ativo=true) — index.html
-- passa a chamar essa função em vez de `.from('apresentacoes').select()`.
-- A policy de admin (`apresentacoes: admin gerencia`) não muda; quem
-- é admin continua lendo/escrevendo a tabela inteira normalmente pelo
-- painel administrativo.
-- ============================================================
--
-- Atualização (mesmo levantamento): a tabela tinha uma SEGUNDA policy
-- de leitura pública que não estava em nenhum .sql versionado do
-- repo — "bv_anon_select" (FOR SELECT TO anon USING (ativo=true)),
-- provavelmente criada direto no SQL Editor do Supabase em algum
-- momento. Ela sozinha já era o vazamento (nem precisa de sessão
-- autenticada, só a anon key, que é pública). As duas foram removidas.
-- ============================================================

DROP POLICY IF EXISTS "apresentacoes: leitura pública ativa" ON public.apresentacoes;
DROP POLICY IF EXISTS "bv_anon_select" ON public.apresentacoes;

CREATE OR REPLACE FUNCTION public.fn_buscar_apresentacao_publica(p_id UUID)
RETURNS SETOF public.apresentacoes
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT * FROM public.apresentacoes
    WHERE id = p_id AND ativo = TRUE;
$$;

GRANT EXECUTE ON FUNCTION public.fn_buscar_apresentacao_publica(UUID) TO anon, authenticated;
