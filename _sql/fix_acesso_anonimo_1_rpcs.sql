-- ============================================================
-- Fechar leitura anônima — PARTE 1 (aditiva, rodar ANTES de publicar o front)
-- Cria as RPCs da página pública de confirmação da Mala Direta.
-- A página deixa de ler/atualizar mala_direta_envios direto e passa a usar
-- estas funções, que só enxergam o envio do token informado.
-- ============================================================

-- Lê o envio do token (e o nome/tipo da campanha). Nada além disso.
CREATE OR REPLACE FUNCTION public.md_confirmacao_obter(p_token text)
RETURNS TABLE (
    status_envio       text,
    status_confirmacao text,
    mensagem_final     text,
    campanha_nome      text,
    tipo_confirmacao   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.status_envio, e.status_confirmacao, e.mensagem_final, c.nome, c.tipo_confirmacao
    FROM public.mala_direta_envios e
    LEFT JOIN public.mala_direta_campanhas c ON c.id = e.campanha_id
    WHERE p_token IS NOT NULL AND length(p_token) >= 16 AND e.token = p_token
    LIMIT 1;
$$;

-- Registra a resposta: só envio já enviado, ainda pendente, com status válido.
-- Devolve o status final (o novo, ou o que já estava registrado).
CREATE OR REPLACE FUNCTION public.md_confirmacao_responder(p_token text, p_status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_atual text;
BEGIN
    IF p_status NOT IN ('lido', 'confirmado', 'recusado') THEN
        RAISE EXCEPTION 'Status inválido';
    END IF;
    IF p_token IS NULL OR length(p_token) < 16 THEN
        RAISE EXCEPTION 'Link inválido';
    END IF;

    UPDATE public.mala_direta_envios
       SET status_confirmacao = p_status,
           data_confirmacao   = now()
     WHERE token = p_token
       AND status_envio = 'enviado'
       AND status_confirmacao = 'pendente'
    RETURNING status_confirmacao INTO v_atual;

    IF v_atual IS NULL THEN
        SELECT status_confirmacao INTO v_atual FROM public.mala_direta_envios WHERE token = p_token;
        IF v_atual IS NULL THEN RAISE EXCEPTION 'Link inválido'; END IF;
    END IF;
    RETURN v_atual;
END;
$$;

REVOKE ALL ON FUNCTION public.md_confirmacao_obter(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.md_confirmacao_responder(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.md_confirmacao_obter(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.md_confirmacao_responder(text, text) TO anon, authenticated;
