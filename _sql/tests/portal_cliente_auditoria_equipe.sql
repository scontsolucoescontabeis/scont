-- Auditoria (somente leitura): quem seria barrado pela politica
-- "portal_cliente: somente equipe". Conferencia humana ANTES de aplicar
-- schema_portal_cliente_bloqueio.sql. Replica a regra de public.eh_equipe()
-- por e-mail (admin OU solicitacao aprovada).

-- 1) TODAS as contas de auth.users (inclusive sem linha em public.usuarios ou
--    com id divergente) e se continuariam com acesso. eh_equipe = false no topo.
SELECT a.id,
       a.email,
       a.last_sign_in_at,
       COALESCE(u.is_admin, false) AS adm,
       (COALESCE(u.is_admin, false) OR EXISTS (
           SELECT 1 FROM public.solicitacoes_acesso s
           WHERE lower(s.email) = lower(a.email) AND s.status = 'aprovado'
       )) AS eh_equipe
FROM auth.users a
LEFT JOIN public.usuarios u ON u.id = a.id
ORDER BY eh_equipe, a.last_sign_in_at DESC NULLS LAST;

-- 2) Solicitacoes de acesso por status.
SELECT s.status, count(*) AS total, array_agg(s.email ORDER BY s.email) AS emails
FROM public.solicitacoes_acesso s
GROUP BY s.status
ORDER BY s.status;
