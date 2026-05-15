-- ============================================================
-- MIGRAÇÃO: permitir mesmo CPF em empresas diferentes
--           + garantir permissões anon na tabela dependentes
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Remover o UNIQUE simples em cpf (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.empregados'::regclass
          AND contype = 'u'
          AND conname LIKE '%cpf%'
    ) THEN
        ALTER TABLE public.empregados DROP CONSTRAINT IF EXISTS empregados_cpf_key;
    END IF;
END $$;

-- 2. Criar unique composto (cpf + nome_empresa)
ALTER TABLE public.empregados
    DROP CONSTRAINT IF EXISTS empregados_cpf_empresa_key;

ALTER TABLE public.empregados
    ADD CONSTRAINT empregados_cpf_empresa_key
    UNIQUE (cpf, nome_empresa);

-- 3. Garantir que o role anon pode inserir dependentes
--    (necessário para o formulário externo que opera sem autenticação)
GRANT INSERT, SELECT ON public.dependentes TO anon;

-- 4. Garantir que o role anon pode inserir empregados
GRANT INSERT, SELECT ON public.empregados TO anon;
