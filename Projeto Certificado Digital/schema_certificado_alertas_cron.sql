-- ============================================================
-- Certificado Digital — agendamento diário do alerta de vencimento
-- Primeiro job agendado (pg_cron) deste projeto Supabase.
-- Roda a Edge Function alerta-certificados-vencimento 1x/dia às
-- 11:00 UTC (~08:00 horário de Brasília, sem horário de verão).
-- Ajuste o horário no cron.schedule abaixo se preferir outro.
-- Idempotente — pode ser executado mais de uma vez.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'alerta-certificados-vencimento-diario';

select cron.schedule(
  'alerta-certificados-vencimento-diario',
  '0 11 * * *',
  $$
  select net.http_post(
    url     := 'https://dsdqwigopzrdmxtmhsez.supabase.co/functions/v1/alerta-certificados-vencimento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzZHF3aWdvcHpyZG14dG1oc2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODM2OTUsImV4cCI6MjA5MjI1OTY5NX0.MPxbcKh6N_BNh0zTTb-jtNigQwCp-e6g3xboBbNbRmw'
    ),
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
