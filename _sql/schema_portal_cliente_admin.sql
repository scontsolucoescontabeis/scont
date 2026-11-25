-- ============================================================
-- PORTAL DO CLIENTE — administrador visualiza qualquer empresa
--
-- empresas_do_cliente() passa a devolver TODAS as empresas
-- (rh_empresas) quando o usuario e administrador do portal
-- (is_admin()). Para os demais, continua sendo so o que o admin
-- aprovou em cliente_acessos. Como as telas e politicas do portal
-- do cliente usam "codigo_empresa IN (SELECT empresas_do_cliente())",
-- o administrador passa a enxergar qualquer empresa em qualquer
-- ferramenta do portal que siga esse padrao.
--
-- Idempotente. Substitui apenas o corpo da funcao; assinatura e
-- GRANTs (authenticated, nao anon) continuam os de
-- schema_portal_cliente.sql.
--
-- REVERTER: reaplicar o CREATE OR REPLACE de empresas_do_cliente()
-- de _sql/schema_portal_cliente.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.empresas_do_cliente()
RETURNS SETOF TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT e.codigo_empresa
    FROM public.rh_empresas e
    WHERE public.is_admin()
    UNION
    SELECT a.codigo_empresa
    FROM public.cliente_acessos a
    WHERE a.usuario_id = auth.uid()
      AND a.status = 'aprovado';
$$;

REVOKE EXECUTE ON FUNCTION public.empresas_do_cliente() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.empresas_do_cliente() TO authenticated;
