-- Reverte fix_acesso_anonimo_2_politicas.sql: recria as políticas exatamente como estavam em 26/11/2026.

CREATE POLICY "dev_sim_conversas_read" ON public.conversas AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "dependentes: anon select" ON public.dependentes AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "empregados: anon select" ON public.empregados AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "formularios: anon select" ON public.formularios AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "campanhas_confirm_select" ON public.mala_direta_campanhas AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "envios_confirm_select" ON public.mala_direta_envios AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "envios_confirm_update" ON public.mala_direta_envios AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "md_envios_anon_confirmar" ON public.mala_direta_envios AS PERMISSIVE FOR UPDATE TO anon USING (((status_envio = 'enviado'::text) AND (status_confirmacao = 'pendente'::text))) WITH CHECK (((status_confirmacao = ANY (ARRAY['lido'::text, 'confirmado'::text, 'recusado'::text])) AND (status_envio = 'enviado'::text)));
CREATE POLICY "md_envios_anon_select" ON public.mala_direta_envios AS PERMISSIVE FOR SELECT TO anon USING ((status_envio = 'enviado'::text));
CREATE POLICY "dev_sim_mensagens_read" ON public.mensagens AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "socios: anon select" ON public.socios AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "dev_sim_usuarios_read" ON public.usuarios AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "storage documentos: anon select" ON storage.objects AS PERMISSIVE FOR SELECT TO anon USING ((bucket_id = 'documentos'::text));
