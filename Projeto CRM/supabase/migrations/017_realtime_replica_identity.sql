-- ============================================================
-- 017 — REPLICA IDENTITY FULL nas tabelas de Realtime
-- ============================================================
-- Sem FULL, o Supabase Realtime não consegue aplicar o filtro
-- RLS em eventos UPDATE (precisa dos valores antigos da linha).
-- Isso faz com que UPDATE events não sejam entregues ao cliente
-- quando a policy usa colunas que não fazem parte do PK.

ALTER TABLE conversas REPLICA IDENTITY FULL;
ALTER TABLE mensagens REPLICA IDENTITY FULL;
ALTER TABLE chatbot_sessoes REPLICA IDENTITY FULL;
