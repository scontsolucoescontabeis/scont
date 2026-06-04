-- ============================================================
-- SCONT CRM — Seed inicial
-- ============================================================

-- Tags padrão SCONT
INSERT INTO tags (nome, cor) VALUES
  ('Urgente',           '#b83232'),
  ('Aguardando Doc',    '#b87a00'),
  ('Retorno Pendente',  '#7a1e1e'),
  ('Concluído',         '#2d7a4f')
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- Usuário admin inicial
-- INSTRUÇÕES:
--   1. Crie o usuário no Supabase Auth Dashboard (Authentication > Users)
--      usando o email herbertscont@gmail.com
--   2. Copie o UUID gerado pelo Auth
--   3. Execute este INSERT substituindo 'UUID-DO-AUTH' pelo UUID copiado
-- ============================================================
-- INSERT INTO usuarios (auth_id, nome, email, departamento, role)
-- VALUES (
--   'UUID-DO-AUTH',
--   'Herbert',
--   'herbertscont@gmail.com',
--   'PESSOAL',
--   'ADMIN'
-- );

-- ============================================================
-- Dados de exemplo para desenvolvimento local
-- (remover antes de produção)
-- ============================================================
-- Contatos de exemplo
INSERT INTO contatos (nome, telefone, empresa) VALUES
  ('João Silva',       '5561991110001', 'Empresa ABC Ltda'),
  ('Maria Oliveira',   '5561991110002', 'Comércio XYZ ME'),
  ('Carlos Pereira',   '5561991110003', NULL)
ON CONFLICT (telefone) DO NOTHING;
