# Portal do Cliente — Parte 1: Acesso e bloqueio por empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente pede acesso a uma empresa, o administrador aprova no painel, e o cliente só enxerga dados da(s) empresa(s) vinculadas — garantido por regras no banco.

**Architecture:** Mesmo projeto Supabase do portal. Duas tabelas novas (`cliente_usuarios`, `cliente_acessos`) e funções `SECURITY DEFINER`. Uma política `RESTRICTIVE` em todas as tabelas atuais deixa passar apenas a equipe (`eh_equipe()`, lista de permissão). Páginas do cliente em `Projeto Portal Cliente/` (HTML/JS puro); aba nova no `admin-dashboard.html`.

**Tech Stack:** PostgreSQL/Supabase (RLS, triggers, RPC), supabase-js v2 (CDN), HTML/CSS/JS puro, `node --test` para o helper de nomes. SQL aplicado com `supabase db query --linked` (ver Task 6).

**Spec:** `docs/superpowers/specs/2026-11-25-portal-cliente-acesso-design.md`

## Global Constraints

- Sem CPF no pedido de acesso (decisão do responsável).
- Cliente nunca lê nem escreve em tabela existente do `public`; nem altera o próprio `status`.
- Bloqueio por **lista de permissão** (`eh_equipe()`), nunca lista de bloqueio de clientes.
- Não reescrever políticas antigas: usar política `AS RESTRICTIVE` por tabela.
- Funções `SECURITY DEFINER` sempre com `SET search_path = public, pg_temp`.
- Stack do portal: HTML/JS puro, paleta do `login.html` (`--primary:#8B3A3A`, `--secondary:#2C3E50`), `supabase-config.js` com `SUPABASE_URL`/`SUPABASE_KEY`. Nada de framework.
- O fluxo de cadastro do cliente **não** cria linha em `solicitacoes_acesso` (isso daria status de equipe).
- Todo SQL novo vai em `_sql/` com nome `schema_portal_cliente_*.sql`, idempotente (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
- Códigos de estado do vínculo: `pendente | aprovado | recusado | revogado`.
- Mensagens de interface em português.

## Review Focus

- Cliente tenta `UPDATE cliente_acessos SET status='aprovado'` pela API: deve falhar (teste na Task 1).
- Cliente aprovado da empresa A consulta dados com `codigo_empresa` da B: vazio (Task 1).
- Cadastro avulso no Supabase Auth (sem passar pelo portal do cliente) tenta ler `rh_empresas`: bloqueado (Task 2).
- Código de empresa inexistente ou vazio nos metadados do cadastro: pedido não é criado, sem erro que impeça o cadastro (Task 1).
- Mesmo cliente pede a mesma empresa duas vezes: segundo pedido ignorado, não duplica (Task 1).
- Cliente revogado com sessão aberta: perde acesso na próxima requisição (Task 1).
- E-mail de cliente igual ao de usuário da equipe: continua sendo equipe, sem ganhar nem perder acesso (Task 2).
- Nomes com acento, caixa e espaços diferentes na conferência de apoio: reconhecidos como iguais (Task 3).
- Busca pública de empresas sem texto mínimo, ou varrendo o cadastro: retorna vazio (Task 1).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `_sql/schema_portal_cliente.sql` | Tabelas, funções, trigger de cadastro, políticas das tabelas novas |
| `_sql/schema_portal_cliente_bloqueio.sql` | Política restritiva nas tabelas atuais + `_reverter` |
| `_sql/tests/portal_cliente_isolamento.test.sql` | Asserções de isolação, executadas em transação com `ROLLBACK` |
| `_sql/tests/portal_cliente_auditoria_equipe.sql` | Lista quem `eh_equipe()` barraria hoje (conferência humana) |
| `assets/nome-apoio.js` | Helper puro: normaliza nomes e acha correspondência |
| `assets/nome-apoio.test.js` | Testes `node --test` do helper |
| `Projeto Portal Cliente/index.html` | Login, cadastro, "aguardando", seletor de empresa, casca da home |
| `Projeto Portal Cliente/js/cliente.js` | Sessão, guarda de rota, chamadas ao Supabase |
| `Projeto Portal Cliente/css/cliente.css` | Estilos (paleta do portal) |
| `admin-dashboard.html` | Modificar: aba "Acessos de clientes" |

---

### Task 1: Tabelas, funções e cadastro do cliente (com testes de isolação)

**Files:**
- Create: `_sql/schema_portal_cliente.sql`
- Test: `_sql/tests/portal_cliente_isolamento.test.sql`

**Interfaces:**
- Produces (SQL):
  - `public.cliente_usuarios(id uuid pk → auth.users, nome text, email text, cargo text, telefone text, created_at timestamptz)`
  - `public.cliente_acessos(id uuid pk, usuario_id uuid → cliente_usuarios, codigo_empresa text → rh_empresas(codigo_empresa), status text check in ('pendente','aprovado','recusado','revogado'), motivo text, decidido_por text, decidido_em timestamptz, created_at timestamptz, unique(usuario_id, codigo_empresa))`
  - `public.eh_equipe() returns boolean` (STABLE, SECURITY DEFINER): `is_admin()` OU existe `solicitacoes_acesso` com `lower(email) = lower(auth.jwt()->>'email')` e `status = 'aprovado'`.
  - `public.empresas_do_cliente() returns setof text`: códigos com vínculo `aprovado` do `auth.uid()`.
  - `public.buscar_empresas_publico(p_texto text) returns table(codigo_empresa text, nome_empresa text)`: executável por `anon` e `authenticated`; só responde se `length(trim(p_texto)) >= 4` ou se `p_texto` (só dígitos) igual ao CNPJ; máximo 8 linhas.
  - Trigger `AFTER INSERT ON auth.users` → `public.handle_novo_cliente()`: se `raw_user_meta_data->>'portal' = 'cliente'`, cria `cliente_usuarios` e, se `raw_user_meta_data->>'codigo_empresa'` existir em `rh_empresas`, cria `cliente_acessos` `pendente` (`ON CONFLICT DO NOTHING`). Nunca lança erro.

- [ ] **Step 1: Escrever o teste de isolação** em `_sql/tests/portal_cliente_isolamento.test.sql`. Um único `BEGIN; ... ROLLBACK;` com `DO $$` e `ASSERT`. Montar no próprio teste: 2 empresas fictícias em `rh_empresas` (`T-A`, `T-B`), 2 usuários em `auth.users` com `raw_user_meta_data` `{"portal":"cliente","codigo_empresa":"T-A"}` e `T-B`, 1 admin (`usuarios.is_admin = true`). Simular cada usuário com `SELECT set_config('request.jwt.claims', json_build_object('sub', <uuid>, 'email', <email>)::text, true); SET LOCAL ROLE authenticated;` e voltar com `RESET ROLE`. Asserções, cada uma com mensagem nomeada:
  - `cadastro_cria_pedido_pendente`: após o INSERT em `auth.users`, existe 1 `cliente_acessos` `pendente` para cada cliente.
  - `cadastro_empresa_inexistente_nao_quebra`: usuário com `codigo_empresa` `'NAO-EXISTE'` e outro sem o campo → existe `cliente_usuarios` e **nenhum** `cliente_acessos`.
  - `pedido_duplicado_ignorado`: reinserir pedido da mesma empresa não duplica (count = 1).
  - `cliente_nao_se_aprova`: como cliente A, `UPDATE cliente_acessos SET status='aprovado'` afeta 0 linhas.
  - `cliente_ve_so_o_proprio`: como A, `SELECT count(*) FROM cliente_acessos` = 1; `cliente_usuarios` = 1.
  - `empresas_do_cliente_so_aprovadas`: pendente → vazio; após admin aprovar → `{T-A}`; após admin revogar → vazio (mesma sessão, sem relogin).
  - `admin_aprova_e_ve_todos`: como admin, vê os 2 pedidos e consegue `UPDATE` de status.
  - `busca_publica_exige_minimo`: como `anon`, `buscar_empresas_publico('ab')` retorna 0 linhas; `buscar_empresas_publico('T-A')` (3 caracteres) também 0; com texto de 4+ caracteres que bate com a empresa fictícia retorna só colunas `codigo_empresa, nome_empresa` e no máximo 8 linhas.
  - `eh_equipe_admin_e_aprovado`: admin → true; cliente → false; usuário com `solicitacoes_acesso.status='aprovado'` e mesmo e-mail → true; mesmo e-mail com `status='pendente'` → false.

- [ ] **Step 2: Rodar o teste e ver falhar**
  Run: `supabase db query --linked -f _sql/tests/portal_cliente_isolamento.test.sql`
  Expected: erro de relação/função inexistente (`cliente_acessos`, `eh_equipe`).

- [ ] **Step 3: Implementar `_sql/schema_portal_cliente.sql`** com os objetos da seção Interfaces. Políticas das tabelas novas (RLS ligada nas duas):
  - `cliente_usuarios`: SELECT `id = auth.uid() OR is_admin()`; sem INSERT/UPDATE/DELETE para `authenticated` (quem insere é o trigger); `FOR ALL` para `is_admin()`.
  - `cliente_acessos`: SELECT `usuario_id = auth.uid() OR is_admin()`; INSERT/UPDATE/DELETE só `is_admin()` (o trigger insere por `SECURITY DEFINER`).
  - Revogar tudo de `anon` nas duas tabelas; `GRANT EXECUTE` de `buscar_empresas_publico` a `anon, authenticated`; `REVOKE EXECUTE ... FROM public` nas demais funções e dar `authenticated`.
  - Normalizar CNPJ na busca removendo caracteres não numéricos (`regexp_replace(cnpj, '\D', '', 'g')`).

- [ ] **Step 4: Aplicar e rodar o teste**
  Run: `supabase db query --linked -f _sql/schema_portal_cliente.sql` e depois o comando do Step 2.
  Expected: sem `ASSERT` falho; resultado final `ROLLBACK`.

- [ ] **Step 5: Commit**
  ```bash
  git add _sql/schema_portal_cliente.sql _sql/tests/portal_cliente_isolamento.test.sql
  git commit -m "feat(portal-cliente): tabelas de acesso, eh_equipe e cadastro por trigger"
  ```

---

### Task 2: Bloqueio nas tabelas atuais (política restritiva)

**Files:**
- Create: `_sql/schema_portal_cliente_bloqueio.sql`, `_sql/tests/portal_cliente_auditoria_equipe.sql`
- Modify: `_sql/tests/portal_cliente_isolamento.test.sql` (acrescentar asserções)

**Interfaces:**
- Consumes: `public.eh_equipe()` da Task 1.
- Produces: em cada tabela de `public` com RLS ligada, **exceto** `cliente_usuarios`, `cliente_acessos` e as que o spec exclui, a política `"portal_cliente: somente equipe"` (`AS RESTRICTIVE FOR ALL TO authenticated USING (public.eh_equipe()) WITH CHECK (public.eh_equipe())`). Produz também `_sql/schema_portal_cliente_bloqueio_reverter.sql` (dropa essas políticas).

- [ ] **Step 1: Escrever a auditoria** `portal_cliente_auditoria_equipe.sql`: lista `usuarios` (id, email, is_admin, `eh_equipe_hoje`) calculando a mesma regra de `eh_equipe()` por e-mail, e uma segunda consulta com `solicitacoes_acesso` por status. Serve para conferência humana de quem seria barrado.

- [ ] **Step 2: Acrescentar ao teste de isolação** (devem falhar antes do bloqueio):
  - `cliente_nao_le_tabela_atual`: como cliente A aprovado, `SELECT count(*) FROM public.rh_empresas` = 0; `INSERT` em `rh_empresas` falha.
  - `cadastro_avulso_nao_le_tabela_atual`: usuário no `auth.users` sem metadados de cliente e sem `solicitacoes_acesso` → `rh_empresas` = 0.
  - `equipe_continua_lendo`: usuário com `solicitacoes_acesso` `aprovado` lê `rh_empresas` (count > 0 se existir dado, caso contrário a consulta não lança erro).
  - `email_igual_cliente_equipe`: e-mail de `solicitacoes_acesso` aprovado que também tem `cliente_usuarios` continua `eh_equipe() = true` e continua lendo `rh_empresas`.

- [ ] **Step 3: Rodar e ver falhar**
  Run: `supabase db query --linked -f _sql/tests/portal_cliente_isolamento.test.sql`
  Expected: falha em `cliente_nao_le_tabela_atual`.

- [ ] **Step 4: Rodar a auditoria e conferir com o responsável**
  Run: `supabase db query --linked -f _sql/tests/portal_cliente_auditoria_equipe.sql`
  Expected: todo usuário que usa o portal hoje (Admin, SCONT, Prestadores) aparece com `eh_equipe_hoje = true`. **Parar aqui e mostrar a lista ao responsável**; qualquer legítimo com `false` precisa de ajuste em `eh_equipe()` antes de seguir (ver Review Focus e "Deixado para o construtor" do spec).

- [ ] **Step 5: Implementar `schema_portal_cliente_bloqueio.sql`**: bloco `DO $$` que varre `pg_tables WHERE schemaname='public'`, pula as tabelas excluídas, e para cada uma faz `DROP POLICY IF EXISTS "portal_cliente: somente equipe"` + `CREATE POLICY ... AS RESTRICTIVE` (só em tabelas com RLS ligada; para tabelas sem RLS, `RAISE NOTICE` com o nome — não ligar RLS sozinho). Escrever também o `_reverter.sql`.

- [ ] **Step 6: Aplicar e testar**
  Run: `supabase db query --linked -f _sql/schema_portal_cliente_bloqueio.sql` e o teste do Step 3.
  Expected: asserções passam. Anotar as tabelas que apareceram sem RLS (`NOTICE`) e levar ao responsável.

- [ ] **Step 7: Regressão manual como equipe** (Admin, SCONT e Prestador): login no `portal.html`, abrir RH, Certificado Digital, Diário e Fechamento Folha e carregar a primeira tela de cada. Expected: dados aparecem como antes. Se algo sumir, executar o `_reverter.sql` e corrigir `eh_equipe()`.

- [ ] **Step 8: Commit**
  ```bash
  git add _sql/schema_portal_cliente_bloqueio.sql _sql/schema_portal_cliente_bloqueio_reverter.sql _sql/tests
  git commit -m "feat(portal-cliente): política restritiva somente-equipe nas tabelas atuais"
  ```

---

### Task 3: Helper de nomes para a conferência de apoio

**Files:**
- Create: `assets/nome-apoio.js`
- Test: `assets/nome-apoio.test.js`

**Interfaces:**
- Produces:
  - `normalizarNome(s: string): string` — minúsculas, sem acentos, sem pontuação, espaços colapsados, trim.
  - `acharApoio(nome: string, pessoas: {nome: string, origem: string}[]): {nome: string, origem: string, tipo: 'exato' | 'parcial'}[]` — `exato` se os nomes normalizados são iguais; `parcial` se todos os termos do menor nome (mínimo 2 termos) estão no maior. Ordena exatos primeiro. Retorna `[]` para nome vazio.
  - Exporta como `window.NomeApoio` no navegador e `module.exports` no Node.

- [ ] **Step 1: Escrever os testes** (`node:test` + `node:assert`):
  - `normalizarNome('  José  da SILVA. ')` → `'jose da silva'`
  - `acharApoio('JOSE DA SILVA', [{nome:'José da Silva', origem:'sócio'}])` → 1 item, `tipo:'exato'`
  - `acharApoio('Jose Silva', [{nome:'José Carlos da Silva', origem:'empregado'}])` → 1 item, `tipo:'parcial'`
  - `acharApoio('Maria', [{nome:'Maria Souza', origem:'sócio'}])` → `[]` (nome com 1 termo não faz parcial)
  - `acharApoio('', [...])` → `[]`
  - Ordem: exato antes de parcial.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `node --test assets/nome-apoio.test.js`
  Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `assets/nome-apoio.js`** com as duas funções e a exportação dupla. Usar `String.prototype.normalize('NFD')` e remover `\p{Diacritic}`.

- [ ] **Step 4: Rodar e ver passar**
  Run: `node --test assets/nome-apoio.test.js`
  Expected: todos passando.

- [ ] **Step 5: Commit**
  ```bash
  git add assets/nome-apoio.js assets/nome-apoio.test.js
  git commit -m "feat(portal-cliente): helper de conferência de nomes"
  ```

---

### Task 4: Páginas do cliente

**Files:**
- Create: `Projeto Portal Cliente/index.html`, `Projeto Portal Cliente/js/cliente.js`, `Projeto Portal Cliente/css/cliente.css`

**Interfaces:**
- Consumes: `buscar_empresas_publico(p_texto)`, `empresas_do_cliente()`, tabelas `cliente_usuarios` / `cliente_acessos` (Task 1); `supabase-config.js` (`../supabase-config.js`).
- Produces em `cliente.js` (funções globais usadas pelo HTML):
  - `entrar(email: string, senha: string): Promise<void>` — `signInWithPassword`; depois `rotearPorEstado()`.
  - `cadastrar(dados: {nome, email, senha, cargo, telefone, codigo_empresa}): Promise<void>` — `signUp` com `options.data = { portal: 'cliente', nome, cargo, telefone, codigo_empresa }` e `emailRedirectTo` apontando para o `index.html` do portal do cliente.
  - `buscarEmpresas(texto: string): Promise<{codigo_empresa, nome_empresa}[]>` — chama o RPC; só dispara com 4+ caracteres.
  - `rotearPorEstado(): Promise<void>` — lê vínculos do usuário: nenhum aprovado e algum pendente → tela "Aguardando análise"; todos recusados/revogados → tela "Acesso não liberado" com o motivo; um aprovado → casca da home; mais de um aprovado → seletor.
  - `sair(): Promise<void>`; link "Esqueci a senha" usa `resetPasswordForEmail` com `redirectTo` para `../redefinir-senha.html`.

- [ ] **Step 1: Esqueleto de `index.html`** com 6 estados num único arquivo (`login`, `cadastro`, `aguardando`, `negado`, `seletor`, `home`), controlados por `mostrarEstado(nome)`. Estilo copiado do `login.html` (cores, cartão, logo `assets/`). Casca da home: nome da empresa selecionada, botão sair, e um cartão "Montador de Escala 5x2 — em breve" (será ligado na Parte 3).

- [ ] **Step 2: Implementar `cliente.js`** com as funções acima. Regras: nunca inserir em `solicitacoes_acesso`; guardar a empresa escolhida em `sessionStorage` (`cliente_empresa`) apenas como conveniência (o banco é quem autoriza); se o usuário logado não tiver `cliente_usuarios`, mostrar "Esta área é para clientes" e `signOut`.

- [ ] **Step 3: Busca de empresa no cadastro**: campo com debounce de 400 ms, lista de até 8 resultados clicáveis (mostra nome e código), mensagem "Digite ao menos 4 letras ou o CNPJ".

- [ ] **Step 4: Verificação manual no navegador** (servir a pasta com `npx http-server` na raiz do portal, abrir `/Projeto Portal Cliente/`):
  1. Cadastrar cliente fictício → tela de confirmação de e-mail; após confirmar, login mostra "Aguardando análise".
  2. No SQL, aprovar o vínculo → recarregar → cai na casca da home com o nome da empresa.
  3. Aprovar um segundo vínculo → seletor aparece.
  4. Revogar → próxima ação do cliente leva a "Acesso não liberado".
  5. Logar como usuário da equipe na página do cliente → mensagem "Esta área é para clientes".
  Expected: os cinco passos se comportam como descrito. Registrar o resultado.

- [ ] **Step 5: Commit**
  ```bash
  git add "Projeto Portal Cliente"
  git commit -m "feat(portal-cliente): login, cadastro, estados de acesso e casca da home"
  ```

---

### Task 5: Aba "Acessos de clientes" no painel do administrador

**Files:**
- Modify: `admin-dashboard.html` (menu em ~207–212, bloco `.tab-content` junto a `#acessos` ~283, navegação em ~1596–1604, funções novas ao final do script)

**Interfaces:**
- Consumes: `window.NomeApoio.acharApoio` (Task 3, incluir `<script src="assets/nome-apoio.js">`); `cliente_usuarios`, `cliente_acessos`, `rh_empresas`, `rh_socios`, `rh_empregados`.
- Produces: `loadAcessosClientes()` (chamada pela navegação quando `tab === 'acessos_clientes'`), `decidirAcessoCliente(acessoId: string, status: 'aprovado' | 'recusado' | 'revogado', motivo?: string): Promise<void>`, `vincularEmpresaCliente(usuarioId: string, codigoEmpresa: string): Promise<void>` (cria vínculo já `aprovado`).

- [ ] **Step 1: Menu e painel**: botão `data-tab="acessos_clientes"` ("🏢 Acessos de clientes") e `<div id="acessos_clientes" class="tab-content">` com filtros Pendentes / Liberados / Recusados-Revogados (reaproveitar as classes `.tabs`/`.tab-btn` e `.table-wrap`).

- [ ] **Step 2: `loadAcessosClientes()`**: busca `cliente_acessos` com `cliente_usuarios(nome,email,cargo,telefone)` e o nome da empresa (`rh_empresas` por `codigo_empresa`). Para cada pedido pendente, buscar `rh_socios(nome_socio)` e `rh_empregados(nome_empregado)` da empresa e mostrar o apoio de `acharApoio`: "✔ Exato: sócio" / "~ Parcial: empregado" / "Nenhuma correspondência". Usar `sanitize()` já existente em tudo que vier do banco.

- [ ] **Step 3: Ações**: **Liberar** (confirmação simples), **Recusar** (pede motivo, obrigatório), **Revogar** (nos liberados; pede motivo). Ao decidir, gravar `status`, `motivo`, `decidido_por` (e-mail do admin logado) e `decidido_em = now()`. Tratar erro de RLS com a mesma mensagem usada nas outras abas.

- [ ] **Step 4: Ocultar clientes da aba "Usuários" existente** (`loadUsuarios`, o `handle_new_user` cria linha em `usuarios` para todo cadastro): excluir ids presentes em `cliente_usuarios`.

- [ ] **Step 5: Verificação manual**: com o cliente fictício da Task 4 pendente, abrir a aba como admin → pedido aparece com o apoio correto; Liberar → cliente entra; Revogar → cliente perde acesso. Conferir que o cliente fictício não aparece em "Usuários". Expected: tudo como descrito.

- [ ] **Step 6: Commit**
  ```bash
  git add admin-dashboard.html
  git commit -m "feat(portal-cliente): aba de acessos de clientes no painel do administrador"
  ```

---

### Task 6: Fechamento — aplicar em produção e documentar

**Files:**
- Modify: `docs/superpowers/specs/2026-11-25-portal-cliente-acesso-design.md` (status)
- Memória (fora do repositório, não entra no commit): criar `project_portal_cliente.md` e a linha no `MEMORY.md`

**Interfaces:** nenhuma nova.

- [ ] **Step 1: Pré-checagem de produção**: confirmar com o responsável (a) quem tem permissão de aplicar SQL (`supabase db query --linked` exige login; o classificador pode negar na 1ª tentativa — repetir), (b) que o SMTP/confirmação de e-mail do Supabase está ativo para o cadastro do cliente.

- [ ] **Step 2: Aplicar na ordem** `schema_portal_cliente.sql` → rodar auditoria → `schema_portal_cliente_bloqueio.sql` → teste de isolação completo. Expected: `ROLLBACK` sem asserção falha.

- [ ] **Step 3: Regressão final** repetindo o Step 7 da Task 2 como Admin, SCONT e Prestador **depois** do bloqueio em produção.

- [ ] **Step 4: Documentar**: atualizar o status do spec para "implementado"; salvar a memória do projeto (arquitetura, `eh_equipe()`, como reverter, partes 2–4 pendentes).

- [ ] **Step 5: Commit**
  ```bash
  git add docs
  git commit -m "docs(portal-cliente): parte 1 concluída"
  ```
