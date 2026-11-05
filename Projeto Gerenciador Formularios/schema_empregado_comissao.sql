-- Empregado comissionado no formulário de cadastro de novos empregados
ALTER TABLE public.empregados ADD COLUMN IF NOT EXISTS comissionado BOOLEAN DEFAULT FALSE;
ALTER TABLE public.empregados ADD COLUMN IF NOT EXISTS valor_comissao NUMERIC(5,2); -- percentual (0 a 100)
