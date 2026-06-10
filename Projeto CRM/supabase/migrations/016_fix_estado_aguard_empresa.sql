-- ============================================================
-- 016 — Adiciona AGUARD_EMPRESA ao CHECK constraint de chatbot_sessoes.estado
-- ============================================================
-- O estado AGUARD_EMPRESA foi adicionado ao chatbot-processor mas não ao
-- CHECK constraint da tabela, causando falha silenciosa no UPDATE e loop
-- infinito no menu de seleção de empresa.

ALTER TABLE chatbot_sessoes
  DROP CONSTRAINT IF EXISTS chatbot_sessoes_estado_check;

ALTER TABLE chatbot_sessoes
  ADD CONSTRAINT chatbot_sessoes_estado_check
  CHECK (estado IN (
    'NOVO',
    'AGUARD_EMPRESA',
    'AGUARD_DEPT',
    'AGUARD_CAT',
    'AGUARD_SUB',
    'AGUARD_CONF',
    'AGUARD_AVAL',
    'CONCLUIDO'
  ));
