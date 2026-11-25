-- Auditoria (somente leitura): quem seria barrado pela politica
-- "portal_cliente: somente equipe". Conferencia humana ANTES de aplicar
-- schema_portal_cliente_bloqueio.sql. Replica a regra de public.eh_equipe()
-- por e-mail (admin OU solicitacao aprovada).

-- 1) Usuarios existentes e se continuariam com acesso.
SELECT u.id,
       u.email,
       u.is_admin,
       (u.is_admin OR EXISTS (
           SELECT 1 FROM public.solicitacoes_acesso s
           WHERE lower(s.email) = lower(u.email) AND s.status = 'aprovado'
       )) AS eh_equipe_hoje
FROM public.usuarios u
ORDER BY eh_equipe_hoje DESC, u.email;

-- 2) Solicitacoes de acesso por status.
SELECT s.status, count(*) AS total, array_agg(s.email ORDER BY s.email) AS emails
FROM public.solicitacoes_acesso s
GROUP BY s.status
ORDER BY s.status;
