-- ============================================================================
-- Controle de Licenças — sub-permissão "excluir"
--
-- Além do administrador, usuários específicos podem excluir licenças, alvarás
-- e processos. A concessão é feita em Admin > Usuários > Editar Acesso
-- (checkbox da ferramenta "Controle de Licenças").
--
-- Diferente das demais sub-permissões (array vazio = acesso total), esta é
-- OPT-IN: só vale quando 'excluir' está explicitamente em
-- usuario_ferramentas.permissoes. Usuários existentes (permissoes = '{}')
-- NÃO ganham a permissão. A flag "optin" faz o admin-dashboard.html tratar o
-- checkbox dessa forma.
--
-- A exclusão continua sendo lógica (trigger fn_soft_delete: ativo = false,
-- deletado_por = e-mail de quem excluiu).
-- Idempotente.
-- ============================================================================

-- 1. Registra a sub-permissão na ferramenta
UPDATE public.ferramentas
SET sub_permissoes = '[{"key":"excluir","label":"Excluir licenças, alvarás e processos","optin":true}]'::jsonb
WHERE lower(url_base) LIKE '%licen%';

-- 2. Função de checagem (admin OU sub-permissão concedida)
CREATE OR REPLACE FUNCTION public.can_excluir_licencas()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT public.is_admin() OR EXISTS (
        SELECT 1
        FROM public.usuario_ferramentas uf
        JOIN public.ferramentas f ON f.id = uf.ferramenta_id
        WHERE uf.usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
        )
        AND lower(f.url_base) LIKE '%licen%'
        AND 'excluir' = ANY(uf.permissoes)
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_excluir_licencas() TO authenticated;

-- 3. Políticas de DELETE
DROP POLICY IF EXISTS "licencas_delete" ON public.licencas;
CREATE POLICY "licencas_delete" ON public.licencas
    FOR DELETE TO authenticated
    USING (public.can_excluir_licencas() AND ativo = TRUE AND deletado_em IS NULL);

DROP POLICY IF EXISTS "alvaras_delete" ON public.alvaras;
CREATE POLICY "alvaras_delete" ON public.alvaras
    FOR DELETE TO authenticated
    USING (public.can_excluir_licencas() AND ativo = TRUE AND deletado_em IS NULL);

DROP POLICY IF EXISTS "processos_delete" ON public.processos;
CREATE POLICY "processos_delete" ON public.processos
    FOR DELETE TO authenticated
    USING (public.can_excluir_licencas() AND ativo = TRUE AND deletado_em IS NULL);
