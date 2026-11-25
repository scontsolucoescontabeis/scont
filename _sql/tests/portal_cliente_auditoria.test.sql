-- Teste da auditoria: uma conta de auth.users SEM linha em public.usuarios
-- (id divergente/ausente) precisa aparecer. run.sh injeta a auditoria em
-- @@AUDITORIA@@ e procura o e-mail na saida. Tudo em ROLLBACK.
BEGIN;
INSERT INTO auth.users (id, email, last_sign_in_at)
VALUES ('00000000-0000-0000-0000-00000000f001', 'orfao@auditoria.test', now());
DELETE FROM public.usuarios WHERE id = '00000000-0000-0000-0000-00000000f001';
-- @@AUDITORIA@@
ROLLBACK;
