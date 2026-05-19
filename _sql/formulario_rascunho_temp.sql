-- Tabela provisória para salvar rascunhos de formulários de usuários não autenticados
-- Cada linha é identificada por um token UUID único gerado no lado do cliente
-- O registro é deletado automaticamente quando o usuário faz o envio final

CREATE TABLE IF NOT EXISTS formulario_rascunho_temp (
    token       UUID        PRIMARY KEY,
    tipo_formulario TEXT    NOT NULL,          -- 'alteracao', 'registro', 'empregado'
    dados       JSONB       NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Limpar rascunhos antigos (mais de 30 dias) via cron ou manualmente
-- DELETE FROM formulario_rascunho_temp WHERE updated_at < NOW() - INTERVAL '30 days';

-- Sem autenticação: desabilitar RLS para permitir acesso anônimo
ALTER TABLE formulario_rascunho_temp DISABLE ROW LEVEL SECURITY;
