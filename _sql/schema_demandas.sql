-- ============================================================
-- SCONT – DEMANDAS DE CLIENTES (leitura diária da caixa de e-mail)
-- Execute no SQL Editor do Supabase (projeto principal do Portal).
-- Idempotente: pode rodar mais de uma vez.
--
-- Pré-requisitos já existentes: public.is_admin(), public.solicitacoes_acesso,
-- public.usuario_ferramentas, public.ferramentas, public.rh_empresas.
--
-- Depois de rodar: _sql/add_ferramenta_demandas.sql (registra no menu) e
-- liberar o acesso em Painel Administrativo → Gerenciar Acessos.
--
-- Diferenças em relação à proposta inicial (schema_demandas_portal_scont.sql):
--  * RLS segue o Portal: admin irrestrito + usuário com a ferramenta liberada.
--  * hash_dedup virou coluna preenchida por trigger (a expressão original usava
--    timestamptz::text, que NÃO é imutável e é recusada em coluna gerada).
--  * cliente_id liga a rh_empresas (cliente = nome original da planilha).
--  * campos_manuais registra o que foi editado à mão no Portal, para a
--    importação não sobrescrever em silêncio.
--  * Importação transacional via RPC demandas_importar().
--  * Datas "de hoje" no fuso de Brasília.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 0. Acesso ao módulo (admin OU ferramenta liberada ao usuário)
-- ------------------------------------------------------------
create or replace function public.demandas_tem_acesso()
returns boolean language sql stable security definer set search_path = public as $$
    select public.is_admin()
        or exists (
            select 1
            from public.solicitacoes_acesso sa
            join public.usuario_ferramentas uf on uf.usuario_id = sa.id
            join public.ferramentas f on f.id = uf.ferramenta_id
            where lower(sa.email) = lower(auth.email())
              and f.url_base = './Projeto Demandas/index.html'
        );
$$;

create or replace function public.demandas_hoje() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- ------------------------------------------------------------
-- 1. Demandas (uma linha por conversa do Gmail)
-- ------------------------------------------------------------
create table if not exists public.demandas (
  id                 uuid primary key default gen_random_uuid(),
  gmail_thread_id    text not null unique,
  cliente            text not null,                       -- nome como veio da planilha
  cliente_id         text references public.rh_empresas (codigo_empresa) on update cascade on delete set null,
  solicitante        text,
  area               text check (area in ('DP','DP – eSocial','Contábil','Fiscal','Outra')),
  tipo               text,
  prioridade         text check (prioridade in ('Alta','Média','Baixa')),
  status             text not null check (status in
                       ('Aguardando SCONT','Em análise (SCONT)','Aguardando cliente','Concluída','Informativo')),
  responsavel        text,
  demanda_inicial    text,
  aberta_em          timestamptz,                         -- null = "n/d" (não consta na conversa)
  prazo              date,
  prazo_obs          text,
  proxima_acao       text,
  ultimo_movimento   timestamptz,
  concluida_em       timestamptz,
  link_email         text,
  campos_manuais     text[] not null default '{}',        -- campos editados no Portal (protegidos da planilha)
  primeira_leitura   date not null default public.demandas_hoje(),
  ultima_leitura     date not null default public.demandas_hoje(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists demandas_status_idx  on public.demandas (status);
create index if not exists demandas_prazo_idx   on public.demandas (prazo) where status not in ('Concluída','Informativo');
create index if not exists demandas_cliente_idx on public.demandas (cliente);
create index if not exists demandas_cliente_id_idx on public.demandas (cliente_id);

-- ------------------------------------------------------------
-- 2. Tratativas (histórico só de acréscimo)
-- ------------------------------------------------------------
create table if not exists public.tratativas (
  id               uuid primary key default gen_random_uuid(),
  demanda_id       uuid not null references public.demandas(id) on delete cascade,
  ocorrida_em      timestamptz not null,
  autor_tipo       text check (autor_tipo in ('SCONT','Cliente','Terceiro')),
  autor            text,
  descricao        text not null,
  origem           text not null default 'importacao' check (origem in ('importacao','manual')),
  criado_por       uuid default auth.uid(),
  hash_dedup       text,
  created_at       timestamptz not null default now(),
  unique (demanda_id, hash_dedup)
);
create index if not exists tratativas_demanda_idx on public.tratativas (demanda_id, ocorrida_em);

create or replace function public.fn_tratativa_hash() returns trigger
language plpgsql as $$
begin
  new.hash_dedup := md5(extract(epoch from new.ocorrida_em)::text || '|' || lower(btrim(new.descricao)));
  return new;
end $$;

drop trigger if exists trg_tratativa_hash on public.tratativas;
create trigger trg_tratativa_hash before insert on public.tratativas
for each row execute function public.fn_tratativa_hash();

-- Histórico imutável: ninguém altera nem apaga tratativa (só some junto da demanda).
create or replace function public.fn_tratativa_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'Tratativas são imutáveis (somente acréscimo).';
end $$;

drop trigger if exists trg_tratativa_imutavel on public.tratativas;
create trigger trg_tratativa_imutavel before update on public.tratativas
for each row execute function public.fn_tratativa_imutavel();

-- ------------------------------------------------------------
-- 3. Histórico de mudanças (alimentado por trigger)
-- ------------------------------------------------------------
create table if not exists public.demanda_historico (
  id            bigint generated always as identity primary key,
  demanda_id    uuid not null references public.demandas(id) on delete cascade,
  campo         text not null,
  valor_ant     text,
  valor_novo    text,
  origem        text not null default 'manual' check (origem in ('manual','importacao')),
  alterado_por  uuid default auth.uid(),
  alterado_em   timestamptz not null default now()
);
create index if not exists demanda_historico_demanda_idx on public.demanda_historico (demanda_id, alterado_em desc);

create or replace function public.fn_demanda_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_import boolean := coalesce(current_setting('demandas.importando', true), '') = 'on';
  v_origem text    := case when v_import then 'importacao' else 'manual' end;
  v_campo  text;
  v_ant    text;
  v_novo   text;
begin
  if tg_op <> 'UPDATE' then return new; end if;

  -- updated_at só muda quando algo de conteúdo mudou (reimportar o mesmo arquivo não mexe).
  if (to_jsonb(new) - 'updated_at' - 'ultima_leitura') is distinct from (to_jsonb(old) - 'updated_at' - 'ultima_leitura') then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'Concluída' and new.concluida_em is null then new.concluida_em := now(); end if;
    if new.status <> 'Concluída' then new.concluida_em := null; end if;
  end if;

  foreach v_campo in array array['status','prioridade','prazo','responsavel','proxima_acao'] loop
    v_ant  := to_jsonb(old) ->> v_campo;
    v_novo := to_jsonb(new) ->> v_campo;
    if v_ant is distinct from v_novo then
      insert into public.demanda_historico (demanda_id, campo, valor_ant, valor_novo, origem)
      values (new.id, v_campo, v_ant, v_novo, v_origem);
      if not v_import and not (v_campo = any(new.campos_manuais)) then
        new.campos_manuais := array_append(new.campos_manuais, v_campo);
      end if;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists trg_demanda_auditoria on public.demandas;
create trigger trg_demanda_auditoria before update on public.demandas
for each row execute function public.fn_demanda_auditoria();

-- ------------------------------------------------------------
-- 4. Log de importações
-- ------------------------------------------------------------
create table if not exists public.leituras_diarias (
  id                bigint generated always as identity primary key,
  data_leitura      date not null,
  arquivo           text,
  conversas         int,
  novas             int,
  atualizadas       int,
  inalteradas       int,
  tratativas_novas  int,
  linhas_com_erro   int not null default 0,
  importado_por     uuid references auth.users(id) default auth.uid(),
  importado_por_nome text,
  importado_em      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. View gerencial (respeita a RLS de quem consulta)
-- ------------------------------------------------------------
create or replace view public.v_pendencias with (security_invoker = true) as
select d.*,
       (d.prazo - public.demandas_hoje())                                   as dias_para_prazo,
       (d.prazo is not null and d.prazo < public.demandas_hoje())           as vencida,
       (public.demandas_hoje() - (d.aberta_em at time zone 'America/Sao_Paulo')::date) as dias_em_aberto
from public.demandas d
where d.status not in ('Concluída','Informativo');

-- ------------------------------------------------------------
-- 6. RLS — nenhuma tabela sem política
-- ------------------------------------------------------------
alter table public.demandas          enable row level security;
alter table public.tratativas        enable row level security;
alter table public.demanda_historico enable row level security;
alter table public.leituras_diarias  enable row level security;

-- Remove a política genérica da proposta inicial, se alguém já a aplicou.
drop policy if exists "equipe_all" on public.demandas;
drop policy if exists "equipe_all" on public.tratativas;
drop policy if exists "equipe_all" on public.demanda_historico;
drop policy if exists "equipe_all" on public.leituras_diarias;

-- demandas: lê e edita quem tem acesso; INSERT só pela RPC; DELETE só admin.
drop policy if exists demandas_select on public.demandas;
create policy demandas_select on public.demandas for select to authenticated using (public.demandas_tem_acesso());
drop policy if exists demandas_update on public.demandas;
create policy demandas_update on public.demandas for update to authenticated
    using (public.demandas_tem_acesso()) with check (public.demandas_tem_acesso());
drop policy if exists demandas_delete on public.demandas;
create policy demandas_delete on public.demandas for delete to authenticated using (public.is_admin());

-- tratativas: lê e acrescenta (manual); sem update/delete.
drop policy if exists tratativas_select on public.tratativas;
create policy tratativas_select on public.tratativas for select to authenticated using (public.demandas_tem_acesso());
drop policy if exists tratativas_insert on public.tratativas;
create policy tratativas_insert on public.tratativas for insert to authenticated
    with check (public.demandas_tem_acesso() and origem = 'manual' and criado_por = auth.uid());

-- histórico e log: somente leitura (escritos por trigger / RPC).
drop policy if exists demanda_historico_select on public.demanda_historico;
create policy demanda_historico_select on public.demanda_historico for select to authenticated using (public.demandas_tem_acesso());
drop policy if exists leituras_diarias_select on public.leituras_diarias;
create policy leituras_diarias_select on public.leituras_diarias for select to authenticated using (public.demandas_tem_acesso());

-- Privilégios por coluna: pela API só as colunas que a tela edita (o resto muda só via RPC/trigger).
revoke all on public.demandas, public.tratativas, public.demanda_historico, public.leituras_diarias from authenticated, anon;
grant select on public.demandas to authenticated;
grant update (status, prioridade, responsavel, prazo, proxima_acao, cliente_id) on public.demandas to authenticated;
grant delete on public.demandas to authenticated;            -- a policy restringe a admin
grant select, insert on public.tratativas to authenticated;
grant select on public.demanda_historico, public.leituras_diarias to authenticated;
grant select on public.v_pendencias to authenticated;

-- ------------------------------------------------------------
-- 7. Importação transacional (tudo ou nada por arquivo)
--
--  p_demandas:    [{gmail_thread_id, cliente, solicitante, area, tipo, prioridade, status,
--                   responsavel, demanda_inicial, aberta_em, prazo, prazo_obs, proxima_acao,
--                   ultimo_movimento, link_email}, ...]
--  p_tratativas:  [{gmail_thread_id, ocorrida_em, autor_tipo, autor, descricao}, ...]
--  p_sobrescrever: {"<thread_id>": ["prioridade","responsavel", ...]}  (conflitos que o
--                   usuário escolheu sobrescrever; o resto dos campos manuais é mantido)
-- ------------------------------------------------------------
create or replace function public.demandas_importar(
    p_arquivo text, p_data_leitura date, p_demandas jsonb, p_tratativas jsonb,
    p_sobrescrever jsonb default '{}'::jsonb, p_linhas_com_erro int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d jsonb; t jsonb;
  v_thread text; v_old public.demandas; v_new public.demandas;
  v_sobre text[]; v_cli text;
  v_novas int := 0; v_atual int := 0; v_inalt int := 0; v_trat int := 0; v_n int;
  v_id uuid;
begin
  if not public.demandas_tem_acesso() then
    raise exception 'Sem permissão para importar demandas.' using errcode = '42501';
  end if;

  perform set_config('demandas.importando', 'on', true);   -- vale só nesta transação

  for d in select * from jsonb_array_elements(coalesce(p_demandas, '[]'::jsonb)) loop
    v_thread := d->>'gmail_thread_id';
    select codigo_empresa into v_cli from public.rh_empresas
      where lower(btrim(nome_empresa)) = lower(btrim(d->>'cliente')) limit 1;

    select * into v_old from public.demandas where gmail_thread_id = v_thread;
    if not found then
      insert into public.demandas (gmail_thread_id, cliente, cliente_id, solicitante, area, tipo, prioridade, status,
          responsavel, demanda_inicial, aberta_em, prazo, prazo_obs, proxima_acao, ultimo_movimento, link_email,
          concluida_em, primeira_leitura, ultima_leitura)
      values (v_thread, d->>'cliente', v_cli, d->>'solicitante', d->>'area', d->>'tipo', d->>'prioridade', d->>'status',
          d->>'responsavel', d->>'demanda_inicial', (d->>'aberta_em')::timestamptz, (d->>'prazo')::date,
          d->>'prazo_obs', d->>'proxima_acao', (d->>'ultimo_movimento')::timestamptz, d->>'link_email',
          case when d->>'status' = 'Concluída'
               then coalesce((d->>'ultimo_movimento')::timestamptz, now()) end,
          p_data_leitura, p_data_leitura);
      v_novas := v_novas + 1;
    else
      v_sobre := coalesce(array(select jsonb_array_elements_text(coalesce(p_sobrescrever->v_thread, '[]'::jsonb))), '{}');
      update public.demandas x set
          cliente          = d->>'cliente',
          cliente_id       = coalesce(x.cliente_id, v_cli),
          solicitante      = d->>'solicitante',
          area             = d->>'area',
          tipo             = d->>'tipo',
          demanda_inicial  = d->>'demanda_inicial',
          aberta_em        = (d->>'aberta_em')::timestamptz,
          prazo_obs        = d->>'prazo_obs',
          ultimo_movimento = (d->>'ultimo_movimento')::timestamptz,
          link_email       = d->>'link_email',
          status      = case when 'status'      = any(x.campos_manuais) and 'status'      <> all(v_sobre) then x.status      else d->>'status' end,
          prioridade  = case when 'prioridade'  = any(x.campos_manuais) and 'prioridade'  <> all(v_sobre) then x.prioridade  else d->>'prioridade' end,
          responsavel = case when 'responsavel' = any(x.campos_manuais) and 'responsavel' <> all(v_sobre) then x.responsavel else d->>'responsavel' end,
          prazo       = case when 'prazo'       = any(x.campos_manuais) and 'prazo'       <> all(v_sobre) then x.prazo       else (d->>'prazo')::date end,
          proxima_acao= case when 'proxima_acao'= any(x.campos_manuais) and 'proxima_acao'<> all(v_sobre) then x.proxima_acao else d->>'proxima_acao' end,
          campos_manuais = array(select c from unnest(x.campos_manuais) c where c <> all(v_sobre)),
          ultima_leitura = greatest(x.ultima_leitura, p_data_leitura)
      where x.id = v_old.id
      returning * into v_new;

      if (to_jsonb(v_new) - 'updated_at' - 'ultima_leitura') is distinct from (to_jsonb(v_old) - 'updated_at' - 'ultima_leitura') then
        v_atual := v_atual + 1;
      else
        v_inalt := v_inalt + 1;
      end if;
    end if;
  end loop;

  for t in select * from jsonb_array_elements(coalesce(p_tratativas, '[]'::jsonb)) loop
    select id into v_id from public.demandas where gmail_thread_id = t->>'gmail_thread_id';
    if v_id is null then continue; end if;   -- tratativa de conversa que não veio na aba Demandas
    insert into public.tratativas (demanda_id, ocorrida_em, autor_tipo, autor, descricao, origem, criado_por)
    values (v_id, (t->>'ocorrida_em')::timestamptz, t->>'autor_tipo', t->>'autor', t->>'descricao', 'importacao', auth.uid())
    on conflict (demanda_id, hash_dedup) do nothing;
    get diagnostics v_n = row_count;
    v_trat := v_trat + v_n;
  end loop;

  insert into public.leituras_diarias (data_leitura, arquivo, conversas, novas, atualizadas, inalteradas,
      tratativas_novas, linhas_com_erro, importado_por_nome)
  values (p_data_leitura, p_arquivo, jsonb_array_length(coalesce(p_demandas, '[]'::jsonb)), v_novas, v_atual, v_inalt,
      v_trat, coalesce(p_linhas_com_erro, 0),
      (select nome from public.usuarios where id = auth.uid()));

  return jsonb_build_object('novas', v_novas, 'atualizadas', v_atual, 'inalteradas', v_inalt, 'tratativas_novas', v_trat);
end $$;

revoke all on function public.demandas_importar(text, date, jsonb, jsonb, jsonb, int) from public;
grant execute on function public.demandas_importar(text, date, jsonb, jsonb, jsonb, int) to authenticated;
