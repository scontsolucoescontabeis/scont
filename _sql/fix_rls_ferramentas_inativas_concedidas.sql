-- ============================================================================
-- FIX: ferramentas dentro do hub Departamento Pessoal redirecionando
--      usuários não-admin para o login/portal principal.
--
-- CAUSA RAIZ:
-- A policy de RLS "ferramentas: autenticado lê ativas" só permitia
-- SELECT em linhas com ativa = TRUE. A migração da reorganização do hub
-- (reorganizar_ferramentas_dp.sql) marcou como ativa = FALSE as 7
-- ferramentas antigas (Folha de Ponto, Lançamentos de Folha, Simulador de
-- Folha de Pagamento, Fechamento Folha de Pagamento, Validação de
-- Fechamento de Folha, Calendário da Folha, Admin – Módulo RH), que agora
-- são acessadas como cards dentro do hub.
--
-- O portal-auth-guard.js (usado por TODAS as ferramentas, inclusive as que
-- ficam fora da pasta do hub) autoriza o acesso consultando:
--     usuario_ferramentas -> ferramentas ( url_base )
-- Como a RLS bloqueia a leitura da linha de "ferramentas" quando ativa =
-- FALSE, esse join volta nulo para usuários não-admin, mesmo quando eles
-- têm uma concessão válida em usuario_ferramentas. O resultado: a lista de
-- URLs autorizadas fica sem essas 7 pastas, e o guard redireciona para o
-- login ao entrar em qualquer uma delas a partir do hub.
--
-- Admin não é afetado porque o guard pula essa consulta inteira para
-- auth.isAdmin = true (ver portal-auth-guard.js linhas 86-97) — por isso
-- "como administrador está funcionando".
--
-- FIX: a policy passa a também permitir a leitura de ferramentas inativas
-- quando o usuário autenticado já possui uma concessão em
-- usuario_ferramentas para aquela ferramenta. A grade principal do portal
-- (portal.html) já filtra `ativa` no próprio JavaScript, então isso NÃO
-- faz ferramentas inativas reaparecerem na tela principal — só desbloqueia
-- o join usado pelo guard de autenticação.
--
-- Idempotente: pode ser rodado mais de uma vez sem efeito colateral.
-- ============================================================================

DROP POLICY IF EXISTS "ferramentas: autenticado lê ativas" ON public.ferramentas;
CREATE POLICY "ferramentas: autenticado lê ativas"
    ON public.ferramentas FOR SELECT
    USING (
        auth.role() = 'authenticated' AND (
            ativa = TRUE
            OR id IN (
                SELECT ferramenta_id FROM public.usuario_ferramentas
                WHERE usuario_id IN (
                    SELECT id FROM public.solicitacoes_acesso WHERE email = auth.email()
                )
            )
        )
    );
