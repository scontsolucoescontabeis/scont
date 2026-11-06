-- Habilita o Realtime (sincronismo automático) para as tabelas da ferramenta de Licenças.
-- Idempotente: pode ser executado mais de uma vez.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['licencas','alvaras','processos','rh_empresas'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
