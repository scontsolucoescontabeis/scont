# Portal do Cliente — checklist de produção (Parte 1: acesso e bloqueio)

> **Documento apenas.** Nada aqui foi executado em produção. Quem aplica é o responsável pelo banco, com autorização, no SQL Editor do Supabase. As consultas da seção B são **somente leitura**.

Arquivos envolvidos (nesta ordem):

1. `_sql/schema_portal_cliente.sql` — tabelas `cliente_usuarios` / `cliente_acessos`, `eh_equipe()`, `empresas_do_cliente()`, `buscar_empresas_publico()`, trigger de cadastro. Aditivo.
2. `_sql/schema_portal_cliente_guardas.sql` — guarda de equipe em funções SECURITY DEFINER (`fn_alertas_sistema`, `contabil_listar_usuarios_aprovados`).
3. `_sql/schema_portal_cliente_bloqueio.sql` — políticas RESTRICTIVE "portal_cliente: …" em `public` e `storage.objects`.
4. Reverter: `_sql/schema_portal_cliente_bloqueio_reverter.sql` (remove todas as políticas `portal_cliente:%` de `public` e `storage`) e a nota "REVERTER" no topo de `schema_portal_cliente_guardas.sql`.

---

## A. Configurações de Auth (Dashboard → Authentication)

- [ ] **Confirm email = ON** (Providers → Email). Sem isso, qualquer pessoa se cadastra com o e-mail de alguém da equipe e `eh_equipe()` (que confia em `auth.jwt()->>'email'`) a trata como equipe.
- [ ] **Secure email change = ON** (exige confirmação nos dois endereços ao trocar e-mail).
- [ ] **Redirect URLs** incluem (com o domínio real do portal):
  - `https://<dominio>/Projeto%20Portal%20Cliente/index.html` (confirmação de cadastro do cliente — `emailRedirectTo` em `Projeto Portal Cliente/js/cliente.js`)
  - `https://<dominio>/redefinir-senha.html` (reset de senha — `redirectTo` em `cliente.js` e no portal interno)
- [ ] **Site URL** = URL raiz do portal (pendência antiga: ver `project_reset_senha_portal`).

---

## B. Conferências antes de aplicar (somente leitura, nesta ordem)

Anote o resultado de cada uma. Qualquer item "não esperado" bloqueia a aplicação até ser resolvido.

### B1. Confirmação de e-mail está mesmo ligada? (detecção de autoconfirm)

```sql
SELECT count(*)                                                        AS cadastros_90d,
       count(*) FILTER (WHERE email_confirmed_at IS NULL)              AS sem_confirmacao,
       count(*) FILTER (WHERE email_confirmed_at IS NOT NULL
                          AND email_confirmed_at - created_at < interval '5 seconds') AS confirmados_instantaneos
FROM auth.users
WHERE created_at > now() - interval '90 days';
```

Esperado: `confirmados_instantaneos` ≈ 0. Se a maioria confirma em segundos, o projeto está (ou esteve) com autoconfirm — **não aplicar** até ligar "Confirm email" e revisar as contas criadas nesse período.

### B2. Políticas atuais em `usuarios` e `solicitacoes_acesso`

```sql
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('usuarios', 'solicitacoes_acesso')
ORDER BY tablename, policyname;
```

Conferir: `"solicitacoes: inserir cadastro"` (FOR INSERT, sem TO, WITH CHECK true) e `usuarios_update_own` (sem WITH CHECK) — ambos são neutralizados pelo bloqueio (`portal_cliente: anon so pendente` e WITH CHECK só-equipe em `usuarios`). Qualquer outra política com `roles` contendo `public`/`anon` precisa ser entendida antes.

### B3. Privilégios do `anon` em tabelas de `public`

```sql
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
```

O bloqueio é `TO authenticated`; o que o `anon` alcança depende só das políticas antigas. Cruzar com B11.

### B4. `usuarios.id` = `auth.uid()`? (divergências)

```sql
SELECT
  (SELECT count(*) FROM public.usuarios u
     WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id))            AS usuarios_sem_auth,
  (SELECT count(*) FROM auth.users a
     WHERE NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = a.id))       AS auth_sem_usuarios,
  (SELECT count(*) FROM public.usuarios u
     JOIN auth.users a ON lower(a.email) = lower(u.email) AND a.id <> u.id)      AS mesmo_email_id_diferente;
```

Esperado: `mesmo_email_id_diferente = 0`. Se > 0, `is_admin()` (que busca por `id = auth.uid()`) não reconhece esse admin e ele perde acesso. `auth_sem_usuarios` > 0 inclui clientes do portal (normal) — conferir pela B7.

### B5. Definição real de `is_admin()` e RLS/dono das tabelas de acesso

```sql
SELECT pg_get_functiondef('public.is_admin()'::regprocedure);

SELECT c.oid::regclass AS tabela, pg_get_userbyid(c.relowner) AS dono,
       c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
FROM pg_class c
WHERE c.oid IN ('public.usuarios'::regclass, 'public.solicitacoes_acesso'::regclass);
```

Esperado: `is_admin()` é SECURITY DEFINER e lê `usuarios.is_admin` por `id = auth.uid()`; `force_rls = false` e dono = dono das funções (`postgres`). Com FORCE RLS, `eh_equipe()`/`is_admin()` passariam a sofrer as políticas e o bloqueio pode travar todo mundo.

### B6. Formato das tabelas `rh_*` usadas pelo portal

```sql
-- UNIQUE(codigo_empresa) em rh_empresas (exigido pela FK de cliente_acessos)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.rh_empresas'::regclass AND contype IN ('u', 'p');

-- As 5 colunas esperadas (devem voltar 5 linhas)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (('rh_empresas', 'cnpj'),
                                    ('rh_socios', 'nome_socio'), ('rh_socios', 'codigo_empresa'),
                                    ('rh_empregados', 'nome_empregado'), ('rh_empregados', 'codigo_empresa'))
ORDER BY 1, 2;
```

### B7. Auditoria de quem continua equipe (parte de `auth.users`)

Rodar `_sql/tests/portal_cliente_auditoria_equipe.sql`:

```sql
SELECT a.id, a.email, a.last_sign_in_at,
       COALESCE(u.is_admin, false) AS adm,
       (COALESCE(u.is_admin, false) OR EXISTS (
           SELECT 1 FROM public.solicitacoes_acesso s
           WHERE lower(s.email) = lower(a.email) AND s.status = 'aprovado')) AS eh_equipe
FROM auth.users a
LEFT JOIN public.usuarios u ON u.id = a.id
ORDER BY eh_equipe, a.last_sign_in_at DESC NULLS LAST;
```

Todas as linhas com `eh_equipe = false` e login recente perdem acesso às ferramentas internas. Conferir uma a uma (Prestadores de Serviço, apps Electron, contas de serviço).

### B8. E-mails aprovados sem conta (órfãos)

```sql
SELECT s.email, s.nome, s.data_avaliacao
FROM public.solicitacoes_acesso s
WHERE s.status = 'aprovado'
  AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE lower(a.email) = lower(s.email))
ORDER BY s.email;
```

Esperado: vazio. Cada linha é um e-mail que vira equipe para quem criar conta com ele (com confirmação de e-mail, quem controla a caixa — p.ex. ex-funcionário). Rejeitar ou remover antes de aplicar.

### B9. Inventário de funções SECURITY DEFINER acessíveis

```sql
SELECT p.oid::regprocedure, pg_get_function_result(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
ORDER BY 1;
```

Cada função que devolve dados de empresas/pessoas ignora o bloqueio. Já cobertas por `schema_portal_cliente_guardas.sql`: `fn_alertas_sistema()`, `contabil_listar_usuarios_aprovados()`. As intencionalmente abertas: `eh_equipe()`, `empresas_do_cliente()`, `buscar_empresas_publico(text)`, `is_admin()`. Para as demais, decidir guarda (`WHERE (SELECT public.eh_equipe())` ou `IF NOT public.eh_equipe() THEN RAISE EXCEPTION`) num arquivo novo, no mesmo padrão.

Conferir também qual versão de `fn_alertas_sistema` está em produção (as duas do repositório divergem; a guarda preserva a que estiver lá):

```sql
SELECT pg_get_functiondef('public.fn_alertas_sistema()'::regprocedure);
```

### B10. Views sem `security_invoker` e tabelas sem RLS

```sql
-- views/matviews de public que rodam com o dono (ignoram o bloqueio)
SELECT c.oid::regclass AS objeto, c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(c.reloptions, '{}')) o
                  WHERE o IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1'))
ORDER BY 1;

-- tabelas de public sem RLS (o bloqueio só avisa, não liga RLS)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND NOT rowsecurity
ORDER BY 1;
```

Cada view listada que um authenticated consegue ler expõe dados ao cliente: `ALTER VIEW … SET (security_invoker = true)` ou `REVOKE SELECT … FROM authenticated`. Tabelas sem RLS: ligar RLS (com política para equipe) ou revogar de `anon`/`authenticated`.

### B11. Políticas para `public`/`anon`

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND roles && ARRAY['public', 'anon']::name[]
ORDER BY 1, 2, 3;
```

O bloqueio não toca `anon`. Atenção especial ao simulador do CRM (`Projeto CRM/supabase/migrations/011_dev_simulator.sql`): `dev_sim_mensagens_read`, `dev_sim_conversas_read` e `dev_sim_usuarios_read` são `FOR SELECT USING (true)` sem `TO` — o `anon` lê **todas** as mensagens, conversas e `usuarios`. Se aparecerem aqui:

```sql
DROP POLICY IF EXISTS "dev_sim_mensagens_read" ON public.mensagens;
DROP POLICY IF EXISTS "dev_sim_conversas_read" ON public.conversas;
DROP POLICY IF EXISTS "dev_sim_usuarios_read"  ON public.usuarios;
```

### B12. Storage e schemas expostos na API

```sql
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;

SELECT id, name, public FROM storage.buckets ORDER BY name;

-- schemas expostos pelo PostgREST (também em Dashboard → API → Exposed schemas)
SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'authenticator';
```

Buckets `public = true` são servidos sem RLS (URL pública) — o bloqueio não os protege. Esperado nos schemas expostos: só `public` (e `graphql_public`). Qualquer outro schema exposto fica fora do bloqueio. Confirmar também que o papel que aplica o SQL consegue criar política em `storage.objects` (o arquivo de bloqueio pula com NOTICE se a tabela não existir, mas falha se não houver permissão).

### B13. Triggers em `auth.users`

```sql
SELECT tgname, tgfoid::regprocedure AS funcao, tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
ORDER BY tgname;
```

Esperado: `on_auth_user_created` (`handle_new_user`) e, após o passo C2, `on_auth_user_created_cliente` (`handle_novo_cliente`). Outros triggers podem conceder papéis/linhas a qualquer cadastro — revisar.

### B14. Fotografia das políticas (guardar antes de aplicar)

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
ORDER BY schemaname, tablename, policyname;
```

Exportar como CSV e guardar junto do registro da mudança.

---

## C. Sequência de aplicação

1. **Merge** da branch com as correções da revisão final (este checklist inclusive).
2. **Aplicar `_sql/schema_portal_cliente.sql`** (aditivo; não muda acesso de ninguém). Atenção: a FK `cliente_acessos.codigo_empresa` é `ON DELETE RESTRICT` — excluir em Configurações do DP uma empresa que tenha acesso de cliente passa a dar erro (antes apagaria os acessos em silêncio). O "apaga tudo e reinsere" de `Projeto Departamento Pessoal/configuracoes.js` falhará para empresas com clientes vinculados; tratar antes de liberar clientes.
3. **Corrigir o que a seção B encontrou** (órfãos, `dev_sim_*`, views, funções DEFINER sem guarda, IDs divergentes, Auth settings).
4. **Aplicar guardas + bloqueio numa transação**, com conferência de um admin e de um Prestador dentro dela:

   ```sql
   BEGIN;
   -- conteúdo de _sql/schema_portal_cliente_guardas.sql
   -- conteúdo de _sql/schema_portal_cliente_bloqueio.sql

   -- admin (trocar <uuid>/<email> por um admin real)
   SELECT set_config('request.jwt.claims', '{"sub":"<uuid-admin>","email":"<email-admin>","role":"authenticated"}', true);
   SET LOCAL ROLE authenticated;
   SELECT public.eh_equipe();               -- esperado: true
   SELECT count(*) FROM public.rh_empresas; -- esperado: total de empresas
   RESET ROLE;

   -- Prestador de Serviço (solicitacoes_acesso aprovada, sem is_admin)
   SELECT set_config('request.jwt.claims', '{"sub":"<uuid-prestador>","email":"<email-prestador>","role":"authenticated"}', true);
   SET LOCAL ROLE authenticated;
   SELECT public.eh_equipe();               -- esperado: true
   SELECT count(*) FROM public.rh_empresas; -- esperado: total de empresas
   RESET ROLE;

   -- se algum resultado não for o esperado: ROLLBACK;
   COMMIT;
   ```

5. **Regressão manual** (logado como admin e como Prestador): RH (empregados, sócios, frequência, benefícios), Certificado Digital, Diário/Central Contábil, Fechamento Folha, CRM, Central de Alertas, Gerenciador de Formulários (inclusive upload público como anônimo), apps Electron (Importação Domínio etc.), **cadastro e login de equipe** (`login.html`: solicitação pendente como anônimo).
6. **Publicar a aba "Acessos de clientes"** do `admin-dashboard.html`.
7. **Publicar o Portal do Cliente por último** (`Projeto Portal Cliente/`).

Durante todo o processo, manter aberto numa aba o `_sql/schema_portal_cliente_bloqueio_reverter.sql` (e a nota REVERTER do arquivo de guardas) para desfazer em segundos.

---

## D. Requisitos do modelo de confiança de `eh_equipe()`

`eh_equipe()` = `is_admin()` OU existe `solicitacoes_acesso` **aprovada** com o mesmo e-mail do JWT. Isso só é seguro se, ao mesmo tempo:

- [ ] **Confirm email = ON** — o e-mail do JWT pertence de fato a quem logou.
- [ ] **Secure email change = ON** — ninguém troca o próprio e-mail para o de alguém da equipe sem confirmar nas duas caixas.
- [ ] **Nenhum e-mail aprovado órfão** (B8 vazio) — senão o primeiro a cadastrar aquele e-mail vira equipe.
- [ ] **Política `portal_cliente: anon so pendente` aplicada** — o anônimo não cria solicitação já aprovada.
- [ ] **Auto-edição de `usuarios` fechada** (WITH CHECK só-equipe no bloqueio) — ninguém marca `is_admin = true` na própria linha.
- [ ] Ao aprovar solicitações na aba Solicitações, respeitar o aviso **"e-mail de cliente — aprovar dá acesso interno"**: um cliente que preencha o cadastro de equipe vira equipe se for aprovado.
