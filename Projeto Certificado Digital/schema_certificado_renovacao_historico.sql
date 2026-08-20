-- ============================================================
-- Certificado Digital — histórico de renovações
-- Cria (se não existir) a tabela historico_certificados, já
-- referenciada pelo frontend (Página Histórico), e habilita
-- RLS + policies para que o fluxo de "Concluir renovação"
-- consiga gravar um registro por renovação, vinculado ao
-- próprio certificado (certificado_id).
-- Idempotente — pode ser executado mais de uma vez.
-- ============================================================

-- responsavel referencia auth.users(id) (produção já tinha essa FK antes deste
-- script existir). O frontend grava o usuario_id logado e resolve o nome para
-- exibição via public.usuarios (ver resolveResponsavelNomes em js/app.js).
create table if not exists public.historico_certificados (
  id              uuid primary key default gen_random_uuid(),
  certificado_id  uuid references public.certificados(id) on delete cascade,
  empresa_id      text,
  tipo_alteracao  text not null,
  campo_alterado  text,
  valor_anterior  text,
  valor_novo      text,
  responsavel     uuid references auth.users(id),
  data_alteracao  timestamptz not null default now()
);

create index if not exists idx_historico_certificados_certificado_id
  on public.historico_certificados (certificado_id);

create index if not exists idx_historico_certificados_data_alteracao
  on public.historico_certificados (data_alteracao desc);

alter table public.historico_certificados enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'historico_certificados'
      and policyname = 'historico_certificados_select_authenticated'
  ) then
    create policy historico_certificados_select_authenticated
      on public.historico_certificados
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'historico_certificados'
      and policyname = 'historico_certificados_insert_authenticated'
  ) then
    create policy historico_certificados_insert_authenticated
      on public.historico_certificados
      for insert
      to authenticated
      with check (true);
  end if;
end $$;
