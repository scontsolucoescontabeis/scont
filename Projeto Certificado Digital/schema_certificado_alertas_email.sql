-- ============================================================
-- Certificado Digital — alertas de vencimento por e-mail
-- 1) Colunas em certificados para não repetir o mesmo alerta
--    de limiar mais de uma vez (dedupe do job diário).
-- 2) Tabela configuracoes_certificados (chave/valor), já usada
--    pelo frontend para "pageSize" — agora também guarda os
--    limiares de alerta e a lista de e-mails destinatários, para
--    que a Edge Function agendada (roda fora do navegador) leia
--    os mesmos valores configurados na tela.
-- Idempotente — pode ser executado mais de uma vez.
-- ============================================================

alter table public.certificados
  add column if not exists ultimo_alerta_nivel text,
  add column if not exists ultimo_alerta_em     timestamptz;

create table if not exists public.configuracoes_certificados (
  chave         text primary key,
  valor         text,
  atualizado_em timestamptz not null default now()
);

alter table public.configuracoes_certificados enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'configuracoes_certificados'
      and policyname = 'configuracoes_certificados_select_authenticated'
  ) then
    create policy configuracoes_certificados_select_authenticated
      on public.configuracoes_certificados
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'configuracoes_certificados'
      and policyname = 'configuracoes_certificados_upsert_authenticated'
  ) then
    create policy configuracoes_certificados_upsert_authenticated
      on public.configuracoes_certificados
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'configuracoes_certificados'
      and policyname = 'configuracoes_certificados_update_authenticated'
  ) then
    create policy configuracoes_certificados_update_authenticated
      on public.configuracoes_certificados
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
