-- ============================================================
-- Fechar leitura anônima — PARTE 2 (rodar DEPOIS do front publicado)
-- Com a chave pública (anon, presente no supabase-config.js do repositório)
-- qualquer pessoa lia: usuarios, conversas/mensagens do CRM, formulários
-- (formularios/empregados/dependentes/socios), Mala Direta e o storage
-- "documentos". O anônimo continua podendo ENVIAR formulários/arquivos;
-- só perde a leitura (e a atualização livre de envios da Mala Direta).
-- Reverter: _sql/fix_acesso_anonimo_2_reverter.sql
-- ============================================================

-- CRM: políticas do simulador de desenvolvimento (USING true, sem TO)
DROP POLICY IF EXISTS "dev_sim_mensagens_read" ON public.mensagens;
DROP POLICY IF EXISTS "dev_sim_conversas_read" ON public.conversas;
DROP POLICY IF EXISTS "dev_sim_usuarios_read"  ON public.usuarios;

-- Gerenciador de Formulários: o formulário público só insere (id gerado no navegador)
DROP POLICY IF EXISTS "formularios: anon select"  ON public.formularios;
DROP POLICY IF EXISTS "empregados: anon select"   ON public.empregados;
DROP POLICY IF EXISTS "dependentes: anon select"  ON public.dependentes;
DROP POLICY IF EXISTS "socios: anon select"       ON public.socios;

-- Mala Direta: a página de confirmação usa md_confirmacao_obter/_responder (parte 1)
DROP POLICY IF EXISTS "campanhas_confirm_select"  ON public.mala_direta_campanhas;
DROP POLICY IF EXISTS "envios_confirm_select"     ON public.mala_direta_envios;
DROP POLICY IF EXISTS "envios_confirm_update"     ON public.mala_direta_envios;
DROP POLICY IF EXISTS "md_envios_anon_select"     ON public.mala_direta_envios;
DROP POLICY IF EXISTS "md_envios_anon_confirmar"  ON public.mala_direta_envios;

-- Storage: anônimo só envia arquivos para "documentos", não lista/baixa
DROP POLICY IF EXISTS "storage documentos: anon select" ON storage.objects;
