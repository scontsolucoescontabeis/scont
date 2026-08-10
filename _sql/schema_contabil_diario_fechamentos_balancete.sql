-- ============================================================
-- BALANCETE DO MÊS anexado ao encerramento contábil
-- Diário Contábil — Departamento Contábil
--
-- Ao encerrar um mês (evento "enviado" pelo responsável, ou "aprovado"
-- direto quando quem encerra já é da equipe Scont/admin), a UI passa a
-- exigir o balancete do mês em PDF, guardado no bucket "documentos" já
-- usado pelo Onboarding, em diario-contabil-balancetes/<codigo_empresa>/
-- <ano>-<mes>/<arquivo>.
--
-- Leitura desse caminho é restrita (diferente do resto do bucket, que
-- continua liberado para qualquer autenticado): só admin, equipe SCONT
-- Soluções Contábeis, ou responsável pela empresa dona do balancete.
-- ============================================================

ALTER TABLE public.contabil_diario_fechamentos
    ADD COLUMN IF NOT EXISTS balancete_url  TEXT,
    ADD COLUMN IF NOT EXISTS balancete_nome TEXT;

CREATE OR REPLACE FUNCTION public.contabil_pode_ver_balancete(caminho TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.solicitacoes_acesso
            WHERE email = auth.email()
              AND lower(empresa) = 'scont soluções contábeis'
        )
        OR EXISTS (
            SELECT 1
            FROM public.contabil_empresas_responsaveis r
            JOIN public.solicitacoes_acesso sa ON sa.id = r.usuario_id
            WHERE sa.email = auth.email()
              AND r.codigo_empresa = (storage.foldername(caminho))[2]
        );
$$;

GRANT EXECUTE ON FUNCTION public.contabil_pode_ver_balancete(TEXT) TO authenticated;

-- A policy de leitura geral do bucket "documentos" passa a excluir o
-- prefixo dos balancetes (senão, como policies permissivas se somam por
-- OR, ela continuaria liberando leitura geral mesmo com a policy nova).
DROP POLICY IF EXISTS "storage documentos: leitura authenticated" ON storage.objects;
CREATE POLICY "storage documentos: leitura authenticated"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'documentos' AND NOT (name LIKE 'diario-contabil-balancetes/%'));

DROP POLICY IF EXISTS "storage documentos: leitura balancete restrita" ON storage.objects;
CREATE POLICY "storage documentos: leitura balancete restrita"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'documentos'
        AND name LIKE 'diario-contabil-balancetes/%'
        AND public.contabil_pode_ver_balancete(name)
    );
