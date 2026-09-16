-- ============================================================
-- Reajustes salariais de empregados — painel "Convenções (CCT)"
-- ------------------------------------------------------------
-- Consolida os eventos de reajuste salarial de EMPREGADOS
-- (contribuintes excluídos) extraídos do relatório "Alterações
-- Salariais — todas as empresas" (competência 01/2025 a 08/2026),
-- usados pela página reajustes_convencoes.html na raiz do portal.
--
-- Só schema aqui — os dados (nomes de empregados e salários) são
-- sensíveis e NÃO entram no git; são inseridos à parte via CLI
-- (supabase db query --linked) direto contra o banco.
--
-- RLS: leitura liberada para qualquer usuário autenticado no
-- portal (mesmo critério do PortalAuthGuard.init com
-- skipToolCheck:true — não é uma ferramenta com sub-permissões,
-- só exige estar logado). Nenhuma política de INSERT/UPDATE/DELETE
-- é criada; a tabela é alimentada manualmente.
--
-- Execute no Supabase SQL Editor do projeto do Portal.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_reajustes_convencoes (
    id                  bigint generated always as identity primary key,
    empresa_codigo      text NOT NULL,
    empresa_nome        text NOT NULL,
    cnpj                text,
    funcionario_codigo  text NOT NULL,
    funcionario_nome    text NOT NULL,
    data_reajuste       date,
    salario_anterior    numeric(12,2),
    novo_salario        numeric(12,2),
    percentual          numeric(6,2),
    motivo              text,
    forma_reajuste      text,
    categoria           text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reajustes_convencoes_categoria
    ON public.rh_reajustes_convencoes (categoria);
CREATE INDEX IF NOT EXISTS idx_reajustes_convencoes_empresa
    ON public.rh_reajustes_convencoes (empresa_codigo);

ALTER TABLE public.rh_reajustes_convencoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_autenticados" ON public.rh_reajustes_convencoes;
CREATE POLICY "leitura_autenticados" ON public.rh_reajustes_convencoes
    FOR SELECT
    TO authenticated
    USING (true);
