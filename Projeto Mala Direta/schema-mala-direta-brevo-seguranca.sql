-- ============================================================
-- Mala Direta — tira a chave de API da Brevo do navegador
--
-- Antes: a chave (mala_direta_config.chave='brevo_key') era lida
-- direto pelo cliente (RLS totalmente aberta) e usada num fetch() do
-- próprio navegador pra api.brevo.com — qualquer usuário autenticado
-- do portal conseguia ver a chave (aba Configurações ou direto pela
-- API REST do Supabase) e a chave ficava exposta no DevTools a cada
-- envio.
--
-- Depois: o valor de 'brevo_key' deixa de ser legível por qualquer
-- usuário autenticado (só a Edge Function, via service role, que
-- ignora RLS, consegue ler). O envio de verdade passa a acontecer
-- dentro da Edge Function `enviar-mala-direta-brevo`. Escrita
-- continua liberada (o admin ainda digita/atualiza a chave pela tela
-- de Configurações), só a leitura desse valor específico é que fecha.
--
-- Coluna nova `brevo_configurado`: como o cliente não consegue mais
-- ler 'brevo_key' pra saber se já tem uma chave salva, usamos essa
-- flag booleana (não-secreta) pra decidir se o botão de enviar fica
-- habilitado. Populada como 'true' aqui embaixo porque já existe uma
-- chave configurada nesta base.
-- ============================================================

DROP POLICY IF EXISTS "config_all_authenticated" ON public.mala_direta_config;

CREATE POLICY "mala_direta_config: leitura sem segredo"
    ON public.mala_direta_config FOR SELECT
    TO authenticated USING (chave <> 'brevo_key');

CREATE POLICY "mala_direta_config: insercao autenticado"
    ON public.mala_direta_config FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "mala_direta_config: atualizacao autenticado"
    ON public.mala_direta_config FOR UPDATE
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "mala_direta_config: exclusao autenticado"
    ON public.mala_direta_config FOR DELETE
    TO authenticated USING (true);

INSERT INTO public.mala_direta_config (chave, valor, atualizado_em)
SELECT 'brevo_configurado', 'true', NOW()
WHERE EXISTS (
    SELECT 1 FROM public.mala_direta_config
    WHERE chave = 'brevo_key' AND valor IS NOT NULL AND valor <> ''
)
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = EXCLUDED.atualizado_em;
