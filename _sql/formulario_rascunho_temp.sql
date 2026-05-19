-- Tabela provisória para salvar rascunhos de formulários de usuários não autenticados
-- Cada linha é identificada por um token UUID único gerado no lado do cliente
-- O registro é deletado automaticamente quando o usuário faz o envio final

CREATE TABLE IF NOT EXISTS formulario_rascunho_temp (
    token           UUID        PRIMARY KEY,
    tipo_formulario TEXT        NOT NULL,   -- 'alteracao', 'registro', 'empregado'
    dados           JSONB       NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Limpar rascunhos antigos (mais de 30 dias) via cron ou manualmente
-- DELETE FROM formulario_rascunho_temp WHERE updated_at < NOW() - INTERVAL '30 days';

-- ============================================================
-- RLS: anon só acessa a própria linha via header x-rascunho-token
-- O frontend envia o token no header; a policy valida que
-- o token do header bate com o token da linha.
-- ============================================================
ALTER TABLE formulario_rascunho_temp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rascunho_anon_token" ON formulario_rascunho_temp;

CREATE POLICY "rascunho_anon_token" ON formulario_rascunho_temp
  FOR ALL TO anon
  USING (
    token::text = (current_setting('request.headers', true)::json->>'x-rascunho-token')
  )
  WITH CHECK (
    token::text = (current_setting('request.headers', true)::json->>'x-rascunho-token')
  );

-- Usuários autenticados do portal também podem ler (para suporte/auditoria)
DROP POLICY IF EXISTS "rascunho_auth_read" ON formulario_rascunho_temp;

CREATE POLICY "rascunho_auth_read" ON formulario_rascunho_temp
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
