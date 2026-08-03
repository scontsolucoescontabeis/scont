-- ============================================================
-- GRADE MENSAL — NOVO FLUXO DE STATUS COM RASTREAMENTO DE TEMPO
-- Diário Contábil — Departamento Contábil
--
-- Substitui o ciclo fixo (sem_documentacao -> pendencias -> concluido
-- -> sem_documentacao) por uma máquina de estados:
--   (sem linha) -> em_andamento -> pendencia <-> em_andamento -> concluido
-- "pendencia" exige uma observação obrigatória (motivo). Os tempos de
-- cada mês (total / em pendência / efetivo) são derivados no cliente a
-- partir de contabil_diario_auditoria (ver diario.js:
-- calcularTemposFechamento em contabil-diario-util.js) — não há tabela
-- nova para isso.
-- ============================================================

-- 1. Solta a CHECK constraint antiga ANTES de normalizar os dados — senão
--    o UPDATE abaixo (que grava 'pendencia', valor que a constraint antiga
--    não permitia) falha contra ela mesma.
ALTER TABLE public.contabil_diario_status_mensal DROP CONSTRAINT IF EXISTS contabil_diario_status_mensal_status_check;

-- "sem_documentacao" nunca era persistido (o ciclo antigo apagava a
-- linha ao voltar pra esse estado), mas removemos por segurança.
UPDATE public.contabil_diario_status_mensal SET status = 'pendencia' WHERE status = 'pendencias';
DELETE FROM public.contabil_diario_status_mensal WHERE status = 'sem_documentacao';

ALTER TABLE public.contabil_diario_status_mensal
    ADD CONSTRAINT contabil_diario_status_mensal_status_check CHECK (status IN ('em_andamento', 'pendencia', 'concluido'));

-- Motivo da pendência atual (espelha a observação da última transição
-- para "pendencia", só para exibir um tooltip na célula sem precisar
-- consultar o histórico de auditoria).
ALTER TABLE public.contabil_diario_status_mensal ADD COLUMN IF NOT EXISTS motivo_pendencia TEXT;

-- 2. Observação obrigatória ao abrir uma pendência — guardada na própria
--    linha de auditoria daquela transição, o que também permite
--    reconstruir o histórico de motivos por episódio de pendência.
ALTER TABLE public.contabil_diario_auditoria ADD COLUMN IF NOT EXISTS observacao TEXT;
