-- ============================================================
-- GRADE MENSAL — NOVO ESTADO "PENDÊNCIA SANADA"
-- Diário Contábil — Departamento Contábil
--
-- Adiciona um estado intermediário entre "pendencia" e o retorno ao
-- fluxo normal: ao resolver uma pendência, o mês passa a ir para
-- "pendencia_sanada" (cor azul) em vez de voltar direto para
-- "em_andamento". A partir de "pendencia_sanada" só é permitido seguir
-- para "em_andamento" ou "concluido" — nunca de volta para "pendencia".
--
-- Máquina de estados atualizada:
--   (sem linha) -> em_andamento -> pendencia -> pendencia_sanada
--                     -> em_andamento / concluido
--
-- O popover de admin do portal (alterarStatusMesAdmin) continua podendo
-- pular livremente para qualquer status a partir de qualquer origem,
-- incluindo "pendencia_sanada" — essa restrição de transição vale só
-- para o fluxo normal (ver diario.js: abrirPopoverPendenciaSanada).
-- ============================================================

-- Solta a CHECK constraint antes de qualquer coisa — nenhum UPDATE é
-- necessário aqui (nenhuma linha existente usa o valor novo), mas segue
-- o mesmo padrão idempotente das migrações anteriores desta tabela.
ALTER TABLE public.contabil_diario_status_mensal DROP CONSTRAINT IF EXISTS contabil_diario_status_mensal_status_check;

ALTER TABLE public.contabil_diario_status_mensal
    ADD CONSTRAINT contabil_diario_status_mensal_status_check CHECK (status IN ('em_andamento', 'pendencia', 'pendencia_sanada', 'concluido'));
