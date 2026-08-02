-- ============================================================
-- FLUXO DE ENCERRAMENTO/VALIDAÇÃO DE FECHAMENTO MENSAL
-- Diário Contábil — Departamento Contábil
--
-- Log append-only de eventos do fluxo: o responsável por uma
-- empresa encerra o mês contábil ("enviado"), a equipe Scont
-- aprova ("aprovado") ou rejeita ("rejeitado", com motivo — nesse
-- caso o mês volta a ficar "aberto" e o ciclo pode se repetir).
--
-- O status atual de fechamento de um (codigo_empresa, ano, mes)
-- NÃO é armazenado numa coluna própria — é derivado no cliente a
-- partir do evento mais recente:
--   nenhum evento, ou o mais recente é "rejeitado" -> Aberto
--   mais recente é "enviado"                       -> Aguardando validação
--   mais recente é "aprovado"                       -> Aprovado (travado)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contabil_diario_fechamentos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL,
    ano             INT NOT NULL,
    mes             INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    tipo_evento     TEXT NOT NULL CHECK (tipo_evento IN ('enviado', 'aprovado', 'rejeitado')),
    mensagem        TEXT,
    usuario_id      UUID REFERENCES public.solicitacoes_acesso(id) ON DELETE SET NULL,
    usuario_nome    TEXT,
    usuario_email   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabil_diario_fech_empresa_mes ON public.contabil_diario_fechamentos (codigo_empresa, ano, mes, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contabil_diario_fech_created_at  ON public.contabil_diario_fechamentos (created_at DESC);

ALTER TABLE public.contabil_diario_fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_diario_fechamentos: leitura autenticado" ON public.contabil_diario_fechamentos;
DROP POLICY IF EXISTS "contabil_diario_fechamentos: escrita autenticado" ON public.contabil_diario_fechamentos;

CREATE POLICY "contabil_diario_fechamentos: leitura autenticado"
    ON public.contabil_diario_fechamentos FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "contabil_diario_fechamentos: escrita autenticado"
    ON public.contabil_diario_fechamentos FOR ALL
    TO authenticated USING (true) WITH CHECK (true);
