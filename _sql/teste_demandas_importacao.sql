-- ============================================================
-- TESTE da RPC demandas_importar() — idempotência, conflito com edição manual e histórico.
-- Rode no SQL Editor do Supabase DEPOIS de aplicar schema_demandas.sql.
-- Tudo roda dentro de uma transação que termina em ROLLBACK: não deixa dados.
-- Troque os dois placeholders pelo id/e-mail de um ADMIN do Portal.
-- Cada bloco "assert" levanta exceção se a expectativa falhar; sem erro = passou.
-- ============================================================
begin;

select set_config('request.jwt.claims',
    json_build_object('sub', '<UUID-DO-ADMIN>', 'email', '<EMAIL-DO-ADMIN>', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  r jsonb;
  v_demandas jsonb := '[
    {"gmail_thread_id":"T-TESTE-1","cliente":"Cliente Teste","status":"Aguardando SCONT","prioridade":"Alta","area":"DP",
     "responsavel":"Ana","demanda_inicial":"Pedido 1","aberta_em":"2026-11-03T12:10:00-03:00","prazo":"2026-11-13",
     "ultimo_movimento":"2026-11-09T11:35:00-03:00","link_email":"https://mail.google.com/mail/u/0/#all/T-TESTE-1"},
    {"gmail_thread_id":"T-TESTE-2","cliente":"Cliente Teste","status":"Concluída","prioridade":"Baixa","area":"Fiscal",
     "demanda_inicial":"Pedido 2","aberta_em":null,"prazo":null,"ultimo_movimento":"2026-11-08T10:00:00-03:00"}]';
  v_trat jsonb := '[
    {"gmail_thread_id":"T-TESTE-1","ocorrida_em":"2026-11-03T12:10:00-03:00","autor_tipo":"Cliente","descricao":"Perguntou"},
    {"gmail_thread_id":"T-TESTE-1","ocorrida_em":"2026-11-04T09:00:00-03:00","autor_tipo":"SCONT","descricao":"Respondeu"}]';
  v_hist_antes int; v_hist_depois int; v_id uuid;
begin
  -- 1) primeira importação: 2 novas, 2 tratativas
  r := public.demandas_importar('teste.xlsx', date '2026-11-09', v_demandas, v_trat);
  assert (r->>'novas')::int = 2 and (r->>'tratativas_novas')::int = 2, 'importação inicial: ' || r::text;
  assert (select concluida_em from public.demandas where gmail_thread_id = 'T-TESTE-2') is not null, 'concluida_em deveria ser preenchida';

  -- 2) reimportar o MESMO arquivo: nada novo, nada atualizado, histórico intacto
  select count(*) into v_hist_antes from public.demanda_historico;
  r := public.demandas_importar('teste.xlsx', date '2026-11-09', v_demandas, v_trat);
  assert (r->>'novas')::int = 0 and (r->>'atualizadas')::int = 0 and (r->>'inalteradas')::int = 2
         and (r->>'tratativas_novas')::int = 0, 'reimportação deveria ser neutra: ' || r::text;
  select count(*) into v_hist_depois from public.demanda_historico;
  assert v_hist_antes = v_hist_depois, 'histórico não pode mudar ao reimportar';
  assert (select count(*) from public.tratativas t join public.demandas d on d.id = t.demanda_id where d.gmail_thread_id = 'T-TESTE-1') = 2, 'sem tratativas duplicadas';

  -- 3) edição manual gera histórico e protege o campo
  select id into v_id from public.demandas where gmail_thread_id = 'T-TESTE-1';
  update public.demandas set prioridade = 'Baixa' where id = v_id;
  assert exists (select 1 from public.demanda_historico where demanda_id = v_id and campo = 'prioridade' and valor_ant = 'Alta' and valor_novo = 'Baixa' and origem = 'manual'), 'histórico da edição manual';
  assert 'prioridade' = any((select campos_manuais from public.demandas where id = v_id)), 'campo deveria constar como manual';

  -- 4) reimportar sem escolher sobrescrever: mantém o valor manual
  r := public.demandas_importar('teste.xlsx', date '2026-11-10', v_demandas, v_trat);
  assert (select prioridade from public.demandas where id = v_id) = 'Baixa', 'edição manual não pode ser sobrescrita em silêncio';

  -- 5) com sobrescrever explícito: planilha vence e a proteção some
  r := public.demandas_importar('teste.xlsx', date '2026-11-10', v_demandas, v_trat, '{"T-TESTE-1":["prioridade"]}'::jsonb);
  assert (select prioridade from public.demandas where id = v_id) = 'Alta', 'sobrescrever deveria aplicar a planilha';
  assert not ('prioridade' = any((select campos_manuais from public.demandas where id = v_id))), 'proteção deveria ser removida';
  assert (r->>'atualizadas')::int = 1, 'conta como atualizada: ' || r::text;

  -- 6) mudança de status gera histórico
  update public.demandas set status = 'Em análise (SCONT)' where id = v_id;
  assert exists (select 1 from public.demanda_historico where demanda_id = v_id and campo = 'status' and valor_novo = 'Em análise (SCONT)'), 'histórico de status';

  -- 7) tratativa é imutável
  begin
    update public.tratativas set descricao = 'x' where demanda_id = v_id;
    assert false, 'update de tratativa deveria falhar';
  exception when others then
    if sqlerrm like 'update de tratativa%' then raise; end if;
  end;

  raise notice 'TODOS OS TESTES PASSARAM';
end $$;

-- 8) sem permissão: usuário comum sem a ferramenta não vê nada (troque pelo UUID/e-mail de um usuário SEM acesso e rode à parte):
--   select set_config('request.jwt.claims', '{"sub":"<UUID-SEM-ACESSO>","email":"<EMAIL-SEM-ACESSO>","role":"authenticated"}', true);
--   select count(*) from public.demandas;   -- esperado: 0

rollback;
