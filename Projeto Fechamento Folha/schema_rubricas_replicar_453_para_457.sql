-- ============================================================
-- SCONT – FECHAMENTO FOLHA DE PAGAMENTO
-- Replicação inicial das rubricas da Quadrante Etiquetas (453)
-- para a Quadrante Rótulos (457).
-- Execute uma única vez no SQL Editor do Supabase.
--
-- Copia todas as linhas ativas de fechamento_rubricas_config da
-- empresa 453 para a 457, mantendo coluna_planilha, codigo_rubrica,
-- tipo_processo, tipo_valor, descricao e valor_cota. Idempotente:
-- rodar de novo não duplica (respeita a constraint única
-- codigo_empresa+coluna_planilha). Ajuste depois na tela
-- Configurações · Rubricas caso a 457 precise de códigos diferentes.
-- ============================================================

INSERT INTO public.fechamento_rubricas_config
    (codigo_empresa, coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao, valor_cota, ativo)
SELECT
    '457', coluna_planilha, codigo_rubrica, tipo_processo, tipo_valor, descricao, valor_cota, ativo
FROM public.fechamento_rubricas_config
WHERE codigo_empresa = '453'
ON CONFLICT (codigo_empresa, coluna_planilha) DO NOTHING;
