-- ============================================================
-- Controle de Licenças — agendamento diário do alerta de vencimento
-- Mesmo padrão de Certificado Digital
-- (Projeto Certificado Digital/schema_certificado_alertas_cron.sql).
-- Roda a Edge Function alerta-licencas-vencimento 1x/dia às 11:15 UTC
-- (~08:15 horário de Brasília, sem horário de verão) — 15 min depois
-- do job de Certificado Digital, para não disparar os dois juntos.
-- Idempotente — pode ser executado mais de uma vez.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'alerta-licencas-vencimento-diario';

select cron.schedule(
  'alerta-licencas-vencimento-diario',
  '15 11 * * *',
  $$
  select net.http_post(
    url     := 'https://dsdqwigopzrdmxtmhsez.supabase.co/functions/v1/alerta-licencas-vencimento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzZHF3aWdvcHpyZG14dG1oc2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODM2OTUsImV4cCI6MjA5MjI1OTY5NX0.MPxbcKh6N_BNh0zTTb-jtNigQwCp-e6g3xboBbNbRmw'
    ),
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
